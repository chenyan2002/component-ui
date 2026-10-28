import * as WIT from './wit';
import { AnswerSource } from './answering';
import { CallEntry, CallLog } from './call-log';
import { callTypes } from './call-record';
import { allCallables, Callable, ExportCallables, exportCallables, heldResources } from './callables';
import { call, drop, ExportsContext } from './calls';
import { ComponentInstance, Stopped } from './component-instance';
import { draftErrors, Giver, INVALID, parseDraft } from './draft';
import { LoadedComponent, loadComponent } from './loader';
import { Platform } from './platform';
import { ResourceRegistry, undroppable } from './resources';
import { parseWave } from './wave';

export type { Stopped };

// Runs a component without the UI, for frontends like the CLI: calls written as the console shows
// them, logged in `log`, and answers to the imports that ask from an `AnswerSource`.

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function byCallee(callables: Callable[]): Map<string, Callable> {
  return new Map(callables.map((callable) => [callable.callee, callable]));
}

// Splits a call into what is called and its arguments, e.g. `new x` and `1, 2` for `new x(1, 2)`.
export function splitCall(text: string): [string, string] {
  const open = text.indexOf('(');
  if (open < 0 || !text.trimEnd().endsWith(')')) {
    throw new Error(`Expected a call like f(1, 2), got ${text}`);
  }
  return [text.slice(0, open).trim(), text.trimEnd().slice(open + 1, -1)];
}

export class Driver {
  // The calls, the imports the guest made during them, and its output, in order.
  public readonly log = new CallLog();
  private instance!: ComponentInstance;
  private readonly exports: ExportCallables;
  // The functions of the exports and of the resources they use, by callee.
  private readonly callables: Map<string, Callable>;
  private stopped?: (stopped: Stopped) => void;

  private constructor(public readonly component: LoadedComponent) {
    this.exports = exportCallables(component.interfaces);
    this.callables = byCallee(allCallables(this.exports.interfaces, this.exports.hostResources));
  }

  // Loads and instantiates a component. `importCode` implements imports in JavaScript, by
  // package as jco names them, e.g. `docs:adder/add`; the others ask `answers`, including WASI's
  // without `wasiShim`.
  public static async start(
    platform: Platform, bytes: Uint8Array, answers: AnswerSource, importCode: Record<string, string> = {}, wasiShim = true,
  ): Promise<Driver> {
    const driver = new Driver(await loadComponent(platform, bytes, wasiShim));
    driver.instance = await ComponentInstance.create(platform, driver.component, driver.log, {
      importCode, answers,
      stopped: (stopped) => driver.stopped?.(stopped),
      // A trap's frames are in the log.
      report: () => {},
    });
    return driver;
  }

  public get registry(): ResourceRegistry {
    return this.instance.registry;
  }

  private get ctx(): ExportsContext {
    return this.instance.ctx;
  }

  // The last call that failed other than by returning an `err`, e.g. by trapping.
  public lastFailure(): CallEntry | undefined {
    return [...this.log.entries].reverse().find((e): e is CallEntry => e.kind === 'call' && e.record !== undefined && e.failed === true);
  }

  // Runs a call written as the console shows it, e.g. `exports/x.get-a(#borrow-x-1)`, until what
  // it did is all in the log. Returns what stopped it, if an import's answer did; then the guest
  // stays suspended in the call.
  public async run(text: string): Promise<Stopped | undefined> {
    // Drops an instance, e.g. `drop #x-1`, as the UI's resource table does: only one the UI holds,
    // not one that moved into a call, say, which the log shows already.
    const dropped = /^drop #(\S+)$/.exec(text.trim());
    if (dropped) {
      const instance = this.registry.instance(dropped[1]);
      if (!instance) {
        throw new Error(`No instance #${dropped[1]}`);
      }
      const reason = undroppable(instance);
      if (reason) {
        throw new Error(`No instance #${instance.id} to drop: ${reason}`);
      }
      drop(this.ctx, dropped[1]);
      return undefined;
    }
    const [callee, argText] = splitCall(text);
    const { target, key, func } = this.resolve(callee);
    const args = this.parseArgs(func, target.type === 'func' ? undefined : target.resource, argText);
    const stopped = new Promise<Stopped>((resolve) => (this.stopped = resolve));
    const done = call(this.ctx, target, key, func, args).then(() => this.instance.settled()).then(() => undefined);
    try {
      return await Promise.race([done, stopped]);
    } finally {
      this.stopped = undefined;
    }
  }

  private resolve(callee: string): Callable {
    const found = this.callables.get(callee);
    if (found) {
      return found;
    }
    // Methods of the host resources the exports don't use, but whose instances the UI holds.
    const runtime = byCallee(allCallables([], heldResources(this.registry, this.exports)));
    const method = runtime.get(callee);
    if (method) {
      return method;
    }
    const name = callee.slice(callee.lastIndexOf('.') + 1);
    const similar = [...this.callables.keys(), ...runtime.keys()].filter((c) => c.endsWith(`.${name}`) || c === name || c.endsWith(` ${name}`));
    throw new Error(`No export ${callee}${similar.length > 0 ? `; did you mean ${similar.join(', ')}?` : ''}`);
  }

  // The arguments, as written, of a call to `func`, a method of `resource` if given.
  private parseArgs(func: WIT.FuncClass, resource: WIT.ResourceClass | undefined, text: string): any[] {
    const types = callTypes(func, resource);
    if (types.length === 0) {
      if (text.trim() !== '') {
        throw new Error('The function takes no arguments');
      }
      return [];
    }
    const tuple = WIT.Tuple(types);
    let value: any = INVALID;
    let errors: string[];
    try {
      const draft = parseWave(tuple, `(${text})`);
      value = parseDraft(tuple, draft, this.registry, this.ctx.mocks, 'ui');
      errors = draftErrors(draft);
    } catch (err) {
      errors = [errorText(err)];
    }
    if (value === INVALID) {
      throw new Error(['Invalid arguments: ' + errors.join('; '), ...this.instancesFor(types, 'ui')].join('; '));
    }
    return value;
  }

  // The instances that could be passed as handles in values of the types, one line per resource,
  // e.g. `instances of x: #x-1 (from new exports/x(5))`; none for a resource with none to choose.
  public instancesFor(types: WIT.Type[], giver: Giver): string[] {
    return this.instance.instancesFor(types, giver);
  }
}

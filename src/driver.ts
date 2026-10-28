import * as WIT from './wit';
import { AnswerSource } from './answering';
import { CallEntry, CallLog } from './call-log';
import { callTypes, qualified, qualifiedResource } from './call-record';
import { call, CallTarget, drop, ExportsContext } from './calls';
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

// What a call written as the console shows it, e.g. `iface.func(1, 2)`, calls.
interface Callable {
  target: CallTarget;
  // jco's name for the function.
  key: string;
  func: WIT.FuncClass;
}

// Splits a call into what is called and its arguments, e.g. `new x` and `1, 2` for `new x(1, 2)`.
export function splitCall(text: string): [string, string] {
  const open = text.indexOf('(');
  if (open < 0 || !text.trimEnd().endsWith(')')) {
    throw new Error(`Expected a call like f(1, 2), got ${text}`);
  }
  return [text.slice(0, open).trim(), text.trimEnd().slice(open + 1, -1)];
}

// Adds the functions of a resource, e.g. `new exports/x`, `exports/x.add` and `exports/x.get-a`;
// constructors and statics only with the interface they are called through.
function addResource(map: Map<string, Callable>, iface: WIT.InterfaceClass | undefined, resource: WIT.ResourceClass) {
  const name = qualifiedResource(resource);
  for (const [key, func] of Object.entries(resource._fields)) {
    const callKind = func.callKind;
    if (callKind === 'method') {
      map.set(`${name}.${func.displayName(key)}`, { target: { type: 'method', resource }, key, func });
    } else if (iface && (callKind === 'constructor' || callKind === 'static')) {
      map.set(callKind === 'constructor' ? `new ${name}` : `${name}.${func.displayName(key)}`, { target: { type: callKind, iface, resource }, key, func });
    }
  }
}

// The callables of the exports by callee, as the console shows them: functions, e.g.
// `docs:calc/calc@0.1.0.eval`, and the functions of resources, e.g. `new exports/x` and
// `exports/x.get-a`, including the imported resources the exports use.
function callables(interfaces: WIT.InterfaceClass[]): Map<string, Callable> {
  const map = new Map<string, Callable>();
  const seen = new Set<WIT.ResourceClass>();
  for (const iface of interfaces) {
    for (const [key, func] of Object.entries(iface._fields)) {
      map.set(qualified(iface._name, func.displayName(key)), { target: { type: 'func', iface }, key, func });
    }
    for (const resource of iface.get_resources().filter((r) => !seen.has(r))) {
      seen.add(resource);
      addResource(map, iface, resource);
    }
  }
  return map;
}

export class Driver {
  // The calls, the imports the guest made during them, and its output, in order.
  public readonly log = new CallLog();
  private instance!: ComponentInstance;
  private readonly callables: Map<string, Callable>;
  private stopped?: (stopped: Stopped) => void;

  private constructor(public readonly component: LoadedComponent) {
    this.callables = callables(component.interfaces);
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

  // Runs a call written as the console shows it, e.g. `exports/x.get-a(#borrow-x-1)`. Returns
  // what stopped it, if an import's answer did; then the guest stays suspended in the call.
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
    const done = call(this.ctx, target, key, func, args).then(() => undefined);
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
    const runtime = new Map<string, Callable>();
    this.registry.resources().forEach((resource) => addResource(runtime, undefined, resource));
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

import * as WIT from './wit';
import { CallRecord, qualified, qualifiedResource } from './call-record';
import { call, CallActivity, CallTarget, ExportsContext } from './calls';
import { ImportDialogs } from './dialog';
import { Draft, draftErrors, INVALID, parseDraft } from './draft';
import { HostResources } from './host-resources';
import { ImportLog, ImportPrompt, LogEntry } from './log';
import { instantiate, LoadedComponent, loadComponent } from './loader';
import { Platform } from './platform';
import { clashingNames, ResourceRegistry } from './resources';
import { parseWave } from './wave';

// Runs a component without the UI, for frontends like the CLI: calls written as the console shows
// them, events for what happens, and answers to the imports that ask from an `AnswerSource`.

// What happens as calls run, in order. A call's imports come between its `call` and its end.
export type DriverEvent =
  | { type: 'call'; record: CallRecord }
  | { type: 'result'; record: CallRecord; text: string }
  | { type: 'error'; record: CallRecord; text: string }
  // A result shown apart from the call, e.g. the HTTP response of a WASI HTTP handler.
  | { type: 'detail'; record: CallRecord; text: string }
  | { type: 'output'; stream: 'stdout' | 'stderr'; text: string }
  // An import is waiting for an answer, a value of the type `expects`.
  | { type: 'ask'; record: CallRecord; expects: string };

// An answer to an import: a value, or a trap of the guest.
export type Answer = { kind: 'value'; draft: Draft } | { kind: 'trap' };

// Answers the imports that ask, in the order the guest calls them, with a value of the type
// `func` returns. Returns undefined when it has no answer, and throws when it can't answer, e.g.
// as its next answer is for another import; either stops the run.
export interface AnswerSource {
  answer(record: CallRecord, func: WIT.FuncClass): Answer | undefined;
}

// Why a run stopped before all its calls finished, at the import `record`: it had no answer, or
// one that failed, e.g. for another import.
export interface Stopped {
  record: CallRecord;
  expects: string;
  unanswered: boolean;
  reason: string;
}

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

// The callables of the exports by callee, as the console shows them: functions, e.g.
// `docs:calc/calc@0.1.0.eval`, and the constructors and statics of resources, e.g.
// `new exports/x` and `exports/x.add`, including the imported resources the exports use.
// Methods are called on an instance instead, e.g. `#borrow-x-1.get-a`.
function callables(interfaces: WIT.InterfaceClass[]): Map<string, Callable> {
  const map = new Map<string, Callable>();
  const seen = new Set<WIT.ResourceClass>();
  for (const iface of interfaces) {
    for (const [key, func] of Object.entries(iface._fields)) {
      map.set(qualified(iface._name, func.displayName(key)), { target: { type: 'func', iface }, key, func });
    }
    for (const resource of iface.get_resources()) {
      if (seen.has(resource)) {
        continue;
      }
      seen.add(resource);
      for (const [key, func] of resource.get_static_funcs()) {
        const type = func.callKind as 'constructor' | 'static';
        const callee = type === 'constructor' ? `new ${qualifiedResource(resource)}` : `${qualifiedResource(resource)}.${func.displayName(key)}`;
        map.set(callee, { target: { type, iface, resource }, key, func });
      }
    }
  }
  return map;
}

export class Driver {
  public readonly component: LoadedComponent;
  public readonly registry: ResourceRegistry;
  private readonly callables: Map<string, Callable>;
  private ctx!: ExportsContext;
  private stopped?: (stopped: Stopped) => void;

  private constructor(component: LoadedComponent, private readonly onEvent: (event: DriverEvent) => void, private readonly answers: AnswerSource) {
    this.component = component;
    this.registry = new ResourceRegistry(clashingNames(component.imports, component.interfaces));
    this.callables = callables(component.interfaces);
  }

  // Loads and instantiates a component. `importCode` implements imports in JavaScript, by
  // package as jco names them, e.g. `docs:adder/add`; the others ask `answers`.
  public static async start(
    platform: Platform, bytes: Uint8Array, onEvent: (event: DriverEvent) => void, answers: AnswerSource,
    importCode: Record<string, string> = {},
  ): Promise<Driver> {
    const driver = new Driver(await loadComponent(platform, bytes), onEvent, answers);
    await driver.instantiate(platform, importCode);
    return driver;
  }

  private async instantiate(platform: Platform, importCode: Record<string, string>) {
    const { component, registry } = this;
    const host = new HostResources(registry, component.imports);
    const dialogs = new ImportDialogs(registry, host, component.imports, (record) => this.logImport(record));
    const exports = await instantiate(platform, component.transpiled, importCode, {
      stdout: (text) => this.onEvent({ type: 'output', stream: 'stdout', text }),
      stderr: (text) => this.onEvent({ type: 'output', stream: 'stderr', text }),
    }, {
      complete: (pkg, mod, wasi) => dialogs.complete(pkg, mod, wasi),
      wrap: (pkg, mod) => host.wrap(pkg, mod),
    });
    this.ctx = { exports, log: (record) => this.logCall(record), registry, host, activity: new CallActivity(), mocks: dialogs };
  }

  // The functions the console shows calls to, e.g. `new exports/x`, and what they are.
  public callees(): Array<[string, WIT.FuncClass]> {
    return [...this.callables].map(([callee, { func }]) => [callee, func]);
  }

  // Runs a call written as the console shows it, e.g. `exports.add(1, #borrow-x-1)`. Returns
  // what stopped it, if an import's answer did; then the guest stays suspended in the call.
  public async run(text: string): Promise<Stopped | undefined> {
    const [callee, argText] = splitCall(text);
    const { target, key, func, self } = this.resolve(callee);
    const args = this.parseArgs(func, argText);
    const stopped = new Promise<Stopped>((resolve) => (this.stopped = resolve));
    const done = call(this.ctx, target, key, func, self === undefined ? args : [self, ...args]).then(() => undefined);
    try {
      return await Promise.race([done, stopped]);
    } finally {
      this.stopped = undefined;
    }
  }

  private resolve(callee: string): Callable & { self?: object } {
    const found = this.callables.get(callee);
    if (found) {
      return found;
    }
    // A method, on an instance written as a borrow, e.g. `#borrow-x-1.get-a`.
    const method = /^#borrow-([^.]+)\.(.+)$/.exec(callee);
    const instance = method && this.registry.instance(method[1]);
    if (method && instance) {
      const entry = instance.resource.get_method_funcs().find(([key, func]) => func.displayName(key) === method[2]);
      if (!entry) {
        throw new Error(`${qualifiedResource(instance.resource)} has no method ${method[2]}`);
      }
      return { target: { type: 'method', resource: instance.resource }, key: entry[0], func: entry[1], self: instance.obj };
    }
    if (method) {
      throw new Error(`No instance #${method[1]}`);
    }
    const name = callee.slice(callee.lastIndexOf('.') + 1);
    const similar = [...this.callables.keys()].filter((c) => c.endsWith(`.${name}`) || c === name || c.endsWith(` ${name}`));
    throw new Error(`No export ${callee}${similar.length > 0 ? `; did you mean ${similar.join(', ')}?` : ''}`);
  }

  private parseArgs(func: WIT.FuncClass, text: string): any[] {
    const types = func._args.map(([_, ty]) => ty);
    if (types.length === 0) {
      if (text.trim() !== '') {
        throw new Error('The function takes no arguments');
      }
      return [];
    }
    const tuple = WIT.Tuple(types);
    const draft = parseWave(tuple, `(${text})`);
    const value = parseDraft(tuple, draft, this.registry, this.ctx.mocks, 'ui');
    if (value === INVALID) {
      throw new Error(draftErrors(draft).join('; '));
    }
    return value;
  }

  private logCall(record: CallRecord): LogEntry {
    this.onEvent({ type: 'call', record });
    return {
      result: (text) => this.onEvent({ type: 'result', record, text }),
      error: (err) => this.onEvent({ type: 'error', record, text: errorText(err) }),
    };
  }

  private logImport(record: CallRecord): ImportLog {
    return {
      ...this.logCall(record),
      detail: (text) => this.onEvent({ type: 'detail', record, text }),
      ask: (prompt) => this.ask(record, prompt),
    };
  }

  // Answers an import that asks, or stops the run, leaving the guest waiting. Answers once the
  // import call has returned its promise, as a user would, so that the host wrapper has hooked
  // it to register the instances the answer returns.
  private ask(record: CallRecord, prompt: ImportPrompt) {
    this.onEvent({ type: 'ask', record, expects: prompt.type.name });
    queueMicrotask(() => this.answer(record, prompt));
  }

  private answer(record: CallRecord, prompt: ImportPrompt) {
    const stop = (unanswered: boolean, reason: string) => this.stopped?.({ record, expects: prompt.type.name, unanswered, reason });
    let answer: Answer | undefined;
    try {
      answer = this.answers.answer(record, prompt.func);
    } catch (err) {
      stop(false, errorText(err));
      return;
    }
    if (!answer) {
      stop(true, `No answer for ${record.label}`);
    } else if (answer.kind === 'trap') {
      prompt.trap();
    } else if (!prompt.answer(answer.draft)) {
      stop(false, `Invalid answer for ${record.label}: ${draftErrors(answer.draft).join('; ')}`);
    }
  }
}

import * as WIT from './wit';
import { CallLog } from './call-log';
import { CallRecord, callTypes, qualified, qualifiedResource } from './call-record';
import { call, CallActivity, CallTarget, drop, ExportsContext } from './calls';
import { ImportDialogs } from './dialog';
import { draftErrors, Giver, INVALID, instanceChoices, parseDraft } from './draft';
import type { Instance } from './resources';
import { HostResources } from './host-resources';
import { ImportLog, ImportPrompt, LogEntry } from './log';
import { instantiate, LoadedComponent, loadComponent } from './loader';
import { Platform } from './platform';
import { Answer, AnswerContext, answerPrompt, listInstances, promptContext, RESTART } from './answering';
import { clashingNames, resourcesOf, ResourceRegistry } from './resources';
import { wasmFrames } from './frames';
import { canonicalWave, parseWave } from './wave';

export type { Answer, AnswerContext };

// Runs a component without the UI, for frontends like the CLI: calls written as the console shows
// them, events for what happens, and answers to the imports that ask from an `AnswerSource`.

// What happens as calls run, in order. A call's imports come between its `call` and its end.
export type DriverEvent =
  | { type: 'call'; record: CallRecord }
  | { type: 'result'; record: CallRecord; text: string }
  // `failed` unless the call returned the `err` of a `result`, e.g. when it trapped; `frames` are
  // the guest's of a trap, innermost first.
  | { type: 'error'; record: CallRecord; text: string; failed: boolean; frames: string[] }
  // A result shown apart from the call, e.g. the HTTP response of a WASI HTTP handler.
  | { type: 'detail'; record: CallRecord; text: string }
  | { type: 'output'; stream: 'stdout' | 'stderr'; text: string }
  // An import is waiting for an answer, a value of the type `expects`.
  | { type: 'ask'; record: CallRecord; expects: string }
  // An import got an answer.
  | { type: 'answer'; record: CallRecord; answer: Answer }
  // Something to know about an import call, e.g. why the user's JavaScript wasn't called.
  | { type: 'note'; record: CallRecord; text: string }
  // An instance was registered, e.g. a mock an import returned.
  | { type: 'instance'; instance: Instance };

// Answers the imports that ask, in the order the guest calls them, with a value of the type
// `func` returns. Returns undefined when it has no answer, and throws when it can't answer, e.g.
// as its next answer is for another import; either stops the run.
export interface AnswerSource {
  answer(record: CallRecord, func: WIT.FuncClass, context: AnswerContext): Answer | undefined;
}

// Why a run stopped before all its calls finished, at the import `record`: it had no answer, or
// one that failed, e.g. for another import.
export interface Stopped {
  record: CallRecord;
  func: WIT.FuncClass;
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
  public readonly component: LoadedComponent;
  public readonly registry: ResourceRegistry;
  // The calls, the imports the guest made during them, and its output, in order.
  public readonly log = new CallLog();
  // Whether a call the UI made failed other than by returning an `err`, e.g. by trapping, and
  // the last that did.
  public failed = false;
  public lastFailure?: { record: CallRecord; text: string };
  private readonly callables: Map<string, Callable>;
  private ctx!: ExportsContext;
  private dialogs!: ImportDialogs;
  private stopped?: (stopped: Stopped) => void;

  // The answers whose `#mock-x-2` say which ids their new mocks are to get, to check once the
  // imports return, with the type of value they return.
  private readonly expected = new Map<CallRecord, { answer: Answer; type: WIT.Type; func: WIT.FuncClass }>();

  private constructor(component: LoadedComponent, private readonly onEvent: (event: DriverEvent) => void, private readonly answers: AnswerSource) {
    this.component = component;
    this.registry = new ResourceRegistry(clashingNames(component.imports, component.interfaces));
    this.registry.onInstance = (instance) => {
      this.log.instance(instance);
      this.onEvent({ type: 'instance', instance });
    };
    this.log.ids = () => this.registry.ids();
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
    host.log = (record) => this.logImport(record);
    this.dialogs = new ImportDialogs(registry, host, component.imports, (record) => this.logImport(record));
    const exports = await instantiate(platform, component.transpiled, importCode, {
      stdout: (text) => {
        this.log.print('stdout', text);
        this.onEvent({ type: 'output', stream: 'stdout', text });
      },
      stderr: (text) => {
        this.log.print('stderr', text);
        this.onEvent({ type: 'output', stream: 'stderr', text });
      },
    }, {
      complete: (pkg, mod, wasi) => this.dialogs.complete(pkg, mod, wasi),
      wrap: (pkg, mod) => host.wrap(pkg, mod),
    });
    this.ctx = {
      exports, log: (record) => this.logCall(record), registry, host, activity: new CallActivity(), mocks: this.dialogs,
      // A trap's frames are in its event.
      report: () => {},
    };
  }

  // The instances that could be passed as a handle of the resource, by the UI to a call or by
  // the host in an answer, as the UI's instance picker offers them.
  public choices(resource: WIT.ResourceClass, giver: Giver): Instance[] {
    return instanceChoices(resource, this.registry, giver);
  }

  public canMock(resource: WIT.ResourceClass): boolean {
    return this.dialogs.canMock(resource);
  }

  // Runs a call written as the console shows it, e.g. `exports/x.get-a(#borrow-x-1)`. Returns
  // what stopped it, if an import's answer did; then the guest stays suspended in the call.
  public async run(text: string): Promise<Stopped | undefined> {
    // Drops an instance, e.g. `drop #x-1`, as the UI's resource table does.
    const dropped = /^drop #(\S+)$/.exec(text.trim());
    if (dropped) {
      if (!this.registry.instance(dropped[1])) {
        throw new Error(`No instance #${dropped[1]}`);
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
    return resourcesOf(types).flatMap((resource) => {
      const choices = this.choices(resource, giver);
      return choices.length === 0 ? [] : [listInstances(resource, choices, giver === 'host' && this.canMock(resource))];
    });
  }

  private logCall(record: CallRecord): LogEntry {
    const entry = this.log.logCall(record);
    this.onEvent({ type: 'call', record });
    return this.ending(record, entry);
  }

  private ending(record: CallRecord, entry: LogEntry): LogEntry {
    return {
      result: (text) => {
        entry.result(text);
        this.onEvent({ type: 'result', record, text });
      },
      // calls.ts formats the `err` a call returns, and passes other errors, e.g. traps, as they are.
      error: (err) => {
        entry.error(err);
        const failed = typeof err !== 'string';
        if (failed && record.kind !== 'import') {
          this.failed = true;
          this.lastFailure = { record, text: errorText(err) };
        }
        this.onEvent({ type: 'error', record, text: errorText(err), failed, frames: wasmFrames(err) });
      },
    };
  }

  private logImport(record: CallRecord): ImportLog {
    const entry = this.log.logImport(record);
    this.onEvent({ type: 'call', record });
    const log = this.ending(record, entry);
    return {
      ...log,
      result: (text) => {
        log.result(text);
        this.checkMocks(record, text);
      },
      detail: (text) => {
        entry.detail(text);
        this.onEvent({ type: 'detail', record, text });
      },
      note: (text) => {
        entry.note(text);
        this.onEvent({ type: 'note', record, text });
      },
      ask: (prompt) => {
        entry.ask(prompt);
        this.ask(record, prompt);
      },
      answered: (trapped, by) => entry.answered(trapped, by),
    };
  }

  // Stops the run if the new mocks of an answer, e.g. `#mock-x-2`, didn't get the ids it says.
  private checkMocks(record: CallRecord, result: string) {
    const expected = this.expected.get(record);
    if (!expected) {
      return;
    }
    this.expected.delete(record);
    const { answer, type } = expected;
    const value = answer.value!.replace(/#mock-/g, '#');
    let same: boolean;
    try {
      same = canonicalWave(type, value) === canonicalWave(type, result);
    } catch {
      same = value === result;
    }
    if (!same) {
      this.stopped?.({
        record, func: expected.func, unanswered: false,
        reason: `${answer.source}: the guest got ${result}, not ${value}, as the new mocks got other ids. ${RESTART}.`,
      });
    }
  }

  // Answers an import that asks, or stops the run, leaving the guest waiting. Answers once the
  // import call has returned its promise, as a user would, so that the host wrapper has hooked
  // it to register the instances the answer returns.
  private ask(record: CallRecord, prompt: ImportPrompt) {
    this.onEvent({ type: 'ask', record, expects: prompt.type.name });
    queueMicrotask(() => this.answer(record, prompt));
  }

  private answer(record: CallRecord, prompt: ImportPrompt) {
    const stop = (unanswered: boolean, reason: string) => this.stopped?.({ record, func: prompt.func, unanswered, reason });
    let answer: Answer | undefined;
    try {
      answer = this.answers.answer(record, prompt.func, promptContext(prompt));
    } catch (err) {
      stop(false, errorText(err));
      return;
    }
    if (!answer) {
      stop(true, `No answer for ${record.label}`);
      return;
    }
    if (answer.hole) {
      stop(true, `${answer.source} is still to be answered`);
      return;
    }
    this.onEvent({ type: 'answer', record, answer });
    if (answer.value !== undefined && /#mock-/.test(answer.value)) {
      this.expected.set(record, { answer, type: prompt.type, func: prompt.func });
    }
    const failed = answerPrompt(prompt, answer);
    if (failed) {
      stop(false, [failed, ...this.instancesFor([prompt.type], 'host')].join('; '));
    }
  }
}

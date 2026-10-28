import * as WIT from './wit';
import { Answer, AnswerSource, answerPrompt, listInstances, promptContext, RESTART } from './answering';
import { CallLog } from './call-log';
import { CallRecord } from './call-record';
import { CallActivity, ExportsContext } from './calls';
import { ImportDialogs } from './dialog';
import { Giver, instanceChoices } from './draft';
import { HostResources } from './host-resources';
import { ImportLog, ImportPrompt } from './log';
import { instantiate, LoadedComponent } from './loader';
import { Platform } from './platform';
import { clashingNames, Instance, resourcesOf, ResourceRegistry } from './resources';
import { canonicalWave } from './wave';

// An instance of a component, as the UI and the CLI run it: its resource instances, the host's
// side of its imports, and the log of what it does. The imports that ask are answered from an
// `AnswerSource`; without an answer, they wait, for the user in the UI, while the CLI stops.

// Why an import that asks was left waiting, at the import `record`: the source had no answer, or
// one that failed, e.g. for another import.
export interface Stopped {
  record: CallRecord;
  func: WIT.FuncClass;
  unanswered: boolean;
  reason: string;
}

export interface InstanceOptions {
  // Implements imports in JavaScript, by package as jco names them, e.g. `docs:adder/add`; the
  // others ask `answers`, including WASI's without the shim.
  importCode?: Record<string, string>;
  answers: AnswerSource;
  // An import was left waiting, without an answer or with one that failed.
  stopped?: (stopped: Stopped) => void;
  // Where the component's output goes; the log by default.
  print?: (stream: 'stdout' | 'stderr', text: string) => void;
  // Reports an error a call failed with, e.g. a trap's stack; the browser's console by default.
  report?: (err: unknown) => void;
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export class ComponentInstance {
  // Each component instance has its own resource instances, including those its imports hand
  // out while it instantiates.
  public readonly registry: ResourceRegistry;
  // What the exports are called with: the instance's exports, and how calls are logged.
  public ctx!: ExportsContext;
  private readonly host: HostResources;
  private readonly dialogs: ImportDialogs;
  // The answers whose `#mock-x-2` say which ids their new mocks are to get, to check once the
  // imports return, with the type of value they return.
  private readonly expected = new Map<CallRecord, { answer: Answer; type: WIT.Type; func: WIT.FuncClass }>();

  // Starts the log's part of the instance, which tells an answer's new mocks, and where instances
  // came from.
  private constructor(public readonly component: LoadedComponent, public readonly log: CallLog, private readonly options: InstanceOptions) {
    this.registry = new ResourceRegistry(clashingNames(component.imports, component.interfaces));
    log.begin();
    log.ids = () => this.registry.ids();
    this.registry.onInstance = (instance) => log.instance(instance);
    this.host = new HostResources(this.registry, component.imports);
    this.host.log = (record) => this.logImport(record);
    this.dialogs = new ImportDialogs(this.registry, this.host, component.imports, (record) => this.logImport(record));
  }

  public static async create(platform: Platform, component: LoadedComponent, log: CallLog, options: InstanceOptions): Promise<ComponentInstance> {
    const instance = new ComponentInstance(component, log, options);
    const { registry, host, dialogs } = instance;
    const print = options.print ?? ((stream, text) => log.print(stream, text));
    const exports = await instantiate(platform, component, options.importCode ?? {}, {
      stdout: (text) => print('stdout', text),
      stderr: (text) => print('stderr', text),
    }, {
      complete: (pkg, mod, wasi) => dialogs.complete(pkg, mod, wasi),
      wrap: (pkg, mod) => host.wrap(pkg, mod),
    });
    instance.ctx = {
      exports, log: (record) => log.logCall(record), registry, host, activity: new CallActivity(), mocks: dialogs, report: options.report,
    };
    return instance;
  }

  // The instances that could be passed as a handle of the resource, by the UI to a call or by
  // the host in an answer, as the UI's instance picker offers them.
  public choices(resource: WIT.ResourceClass, giver: Giver): Instance[] {
    return instanceChoices(resource, this.registry, giver);
  }

  public canMock(resource: WIT.ResourceClass): boolean {
    return this.dialogs.canMock(resource);
  }

  // The instances that could be passed as handles in values of the types, one line per resource,
  // e.g. `instances of x: #x-1 (from new exports/x(5))`; none for a resource with none to choose.
  public instancesFor(types: WIT.Type[], giver: Giver): string[] {
    return resourcesOf(types).flatMap((resource) => {
      const choices = this.choices(resource, giver);
      return choices.length === 0 ? [] : [listInstances(resource, choices, giver === 'host' && this.canMock(resource))];
    });
  }

  // Logs an import the guest called, under the pending call it happened in. One that asks gets
  // its answer from the source.
  private logImport(record: CallRecord): ImportLog {
    const entry = this.log.logImport(record);
    return {
      ...entry,
      result: (text) => {
        entry.result(text);
        this.checkMocks(record, text);
      },
      ask: (prompt) => {
        entry.ask(prompt);
        // Once the import call has returned its promise, as a user would answer, so that the host
        // wrapper has hooked it to register the instances the answer returns.
        queueMicrotask(() => this.answer(record, prompt));
      },
    };
  }

  // Leaves the guest waiting if the new mocks of an answer, e.g. `#mock-x-2`, didn't get the ids
  // it says.
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
      this.options.stopped?.({
        record, func: expected.func, unanswered: false,
        reason: `${answer.source}: the guest got ${result}, not ${value}, as the new mocks got other ids. ${RESTART}.`,
      });
    }
  }

  // Answers an import that asks, or leaves the guest waiting.
  private answer(record: CallRecord, prompt: ImportPrompt) {
    const stop = (unanswered: boolean, reason: string) => this.options.stopped?.({ record, func: prompt.func, unanswered, reason });
    let answer: Answer | undefined;
    try {
      answer = this.options.answers.answer(record, prompt.func, promptContext(prompt));
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
    if (answer.value !== undefined && /#mock-/.test(answer.value)) {
      this.expected.set(record, { answer, type: prompt.type, func: prompt.func });
    }
    const failed = answerPrompt(prompt, answer);
    if (failed) {
      stop(false, [failed, ...this.instancesFor([prompt.type], 'host')].join('; '));
    }
  }
}

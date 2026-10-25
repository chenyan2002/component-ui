import { CallRecord } from './call-record';
import { wasmFrames } from './frames';
import { AnsweredBy, ImportLog, ImportPrompt, LogEntry } from './log';
import { Instance } from './resources';
import { mapHandles } from './wave';

// The log of what a component instance did: the calls made to it, the imports it called during
// them, and its output, in order. The UI's console shows it, and the CLI prints it and writes it
// as an answers file.

export type Status = 'pending' | 'ok' | 'error';

interface Entry {
  // The order of entries, and of the instances created, in the log.
  seq: number;
}

// How a call or an import ended, other than by returning.
interface Ending {
  status: Status;
  // The result in WAVE, or the error's message, e.g. the `err` of a `result`.
  output?: string;
  // An error other than the `err` of a `result`, e.g. a trap, and the guest's frames of it.
  failed?: boolean;
  frames: string[];
}

// An import the guest called, under the call that made it, if any.
export interface ImportEntry extends Entry, Ending {
  kind: 'import';
  record: CallRecord;
  parent?: CallEntry;
  // A result shown apart from the call, e.g. the HTTP response of a WASI HTTP handler.
  detail?: string;
  // Something to know about the call, e.g. why the user's JavaScript wasn't called.
  note?: string;
  // Asking for the result, until it is answered.
  prompt?: ImportPrompt;
  // How it was answered, if it asked: with a value, when the ids in `before` were those of the
  // instances there were, so that others in its result are the answer's new mocks; or by
  // trapping the guest. `by` says who answered, e.g. `default`, if not the user.
  answered?: { before: Set<string>; trapped: boolean; by?: AnsweredBy };
}

// A call the UI made, or something else it did, e.g. loading a file, which has no record.
export interface CallEntry extends Entry, Ending {
  kind: 'call';
  label: string;
  record?: CallRecord;
  // When it started, as the time of day, and how long it took, in milliseconds.
  time: string;
  elapsed?: number;
  imports: ImportEntry[];
}

// Text the component wrote to stdout or stderr, during the call `call` if it was running.
export interface StreamEntry extends Entry {
  kind: 'stream';
  stream: 'stdout' | 'stderr';
  text: string;
  call?: CallEntry;
}

export type LogItem = CallEntry | ImportEntry | StreamEntry;

// An instance created, e.g. a mock an answer returned, by its place in the log.
export interface InstanceItem extends Entry {
  instance: Instance;
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// The import that is a call of the UI's to the host itself, e.g. a mock's method, or a host
// resource's static: it shows only as the call, whose result it answers.
export function isOwnCall(call: CallEntry, entry: ImportEntry): boolean {
  return call.record?.kind === 'host' && entry.record.label === call.record.label;
}

// The value an answered import returned, as an answers file writes it: with the new mocks of the
// answer as `#mock-x-2`; undefined unless it was answered and returned.
export function answeredValue(entry: ImportEntry): string | undefined {
  if (!entry.answered || entry.answered.trapped || entry.status !== 'ok' || entry.output === undefined) {
    return undefined;
  }
  const { before } = entry.answered;
  return mapHandles(entry.output, (label) => (before.has(label) || label.startsWith('borrow-') ? label : `mock-${label}`));
}

export class CallLog {
  public entries: LogItem[] = [];
  public instances: InstanceItem[] = [];
  // The ids of all the instances there have been, to tell an answer's new mocks.
  public ids: () => Set<string> = () => new Set();
  // Where the current component instance's part of the log starts, e.g. after the UI
  // instantiated the component again; the earlier parts are of other instances.
  public since = 0;
  private seq = 0;

  // `changed` is called on each change: with `added` when an entry was added at the end.
  constructor(private readonly changed: (added: boolean) => void = () => {}) {}

  public clear() {
    this.entries = [];
    this.instances = [];
    this.since = this.seq;
    this.changed(false);
  }

  // Starts the part of a new component instance, e.g. after the UI instantiated the component again.
  public begin() {
    this.since = this.seq;
  }

  // The last call that hasn't returned, which the imports the guest calls belong to.
  public pending(): CallEntry | undefined {
    return [...this.entries].reverse().find((e): e is CallEntry => e.kind === 'call' && e.status === 'pending');
  }

  public logCall(record: CallRecord): LogEntry {
    return this.addCall(record.label, record);
  }

  // Logs something the UI did that isn't a call, e.g. failing to load a file.
  public logAction(text: string): LogEntry {
    return this.addCall(text);
  }

  private addCall(label: string, record?: CallRecord): LogEntry {
    const started = performance.now();
    const entry: CallEntry = {
      kind: 'call', seq: this.seq++, label, record, time: new Date().toLocaleTimeString(), status: 'pending', frames: [], imports: [],
    };
    this.entries = [...this.entries, entry];
    this.changed(true);
    return this.ending(entry, () => {
      entry.elapsed = Math.round(performance.now() - started);
    });
  }

  // Logs an import the guest called, under the pending call it happened in.
  public logImport(record: CallRecord): ImportLog {
    const parent = this.pending();
    const entry: ImportEntry = { kind: 'import', seq: this.seq++, record, parent, status: 'pending', frames: [] };
    if (parent) {
      parent.imports.push(entry);
    } else {
      this.entries = [...this.entries, entry];
    }
    this.changed(true);
    return {
      ...this.ending(entry, () => {
        entry.prompt = undefined;
      }),
      detail: (text) => {
        Object.assign(entry, { status: 'ok', detail: text, prompt: undefined });
        this.changed(false);
      },
      note: (text) => {
        entry.note = text;
        this.changed(false);
      },
      ask: (prompt) => {
        entry.prompt = prompt;
        this.changed(false);
      },
      answered: (trapped, by) => {
        entry.answered = { before: this.ids(), trapped, by };
      },
    };
  }

  private ending(entry: CallEntry | ImportEntry, finished: () => void): LogEntry {
    return {
      result: (text) => {
        Object.assign(entry, { status: 'ok', output: text });
        finished();
        this.changed(false);
      },
      // calls.ts formats the `err` a call returns, and passes other errors, e.g. traps, as they are.
      error: (err) => {
        Object.assign(entry, { status: 'error', output: errorText(err), failed: typeof err !== 'string', frames: wasmFrames(err) });
        finished();
        this.changed(false);
      },
    };
  }

  // Logs what the component wrote; consecutive writes to the same stream, in the same call, share
  // an entry. Whether it did.
  public print(stream: StreamEntry['stream'], text: string): boolean {
    const last = this.entries[this.entries.length - 1];
    const call = this.pending();
    if (last?.kind === 'stream' && last.stream === stream && last.call === call) {
      last.text += text;
      this.changed(false);
      return true;
    }
    this.entries = [...this.entries, { kind: 'stream', seq: this.seq++, stream, text, call }];
    this.changed(true);
    return false;
  }

  // Notes an instance the registry created, by its place in the log.
  public instance(instance: Instance) {
    this.instances.push({ seq: this.seq++, instance });
  }
}

import * as WIT from './wit';
import { CallRecord } from './call-record';
import { Answer, AnswerContext, AnswerSource, DriverEvent, listInstances, RESTART } from './driver';
import { canonicalWave } from './wave';

// The answers file: the calls of a run, and the answers to the imports that ask, in the order
// the guest calls them. `--save` writes it from a run, so that it reproduces the run:
//
//     //! component-ui call public/resource.wasm --defaults eager
//     > new exports/x(5)  // = #x-1
//     > exports.test-imports()
//     //! new imports/y(10) = #y-1
//     imports/y.get-a(#borrow-y-1) = 10
//     imports/y.add(#y-1, 10) = #mock-y-2  // default; instances of y: #y-1 (from new imports/y(10))
//     imports/y.get-a(#borrow-y-2) = ?  // expects s32
//
// - `> call` is a call the run makes, written as the console shows it.
// - `import(args) = value` answers an import, with WAVE of the type it returns, or `!trap` to trap
//   the guest. It names the call, as the console shows it, so that an answer the guest doesn't
//   ask for next stops the run rather than answer the wrong call. A method's first argument is
//   the instance it is called on, e.g. `#borrow-y-1`. Without the arguments, it answers any call
//   to the import; `--defaults careful` and `none` don't allow that.
// - `= ?` is an answer still to be given, which stops the run there.
// - `#mock` in a value is a new mock of a host resource, and `#mock-y-2` a new mock that is to get
//   the id `y-2`, which `--save` writes for every new mock, so that later uses of `#y-2` show
//   where it came from. A run where the mock gets another id stops.
// - Lines starting with `//!` are written by `--save` for the reader, and written anew each time:
//   the header, and where instances that no answer returned came from. Other `//` comments, and
//   those after a call or answer, are kept, including `--save`'s notes on the happy path's
//   answers, e.g. `// default; instances of x: …`, until the user removes them.
//
// The file is followed strictly: a run whose calls differ from it stops at the first line that
// doesn't match. Past the last answer, the imports get the happy path (see `happyValue`).

export type DefaultsLevel = 'none' | 'careful' | 'eager';
export const DEFAULTS_LEVELS: DefaultsLevel[] = ['none', 'careful', 'eager'];

interface LineBase {
  // Where it was written, e.g. `answers.txt:3`, for messages.
  source: string;
  // The comment lines and blank lines before it, and the comment after it, without the parts
  // `--save` writes anew.
  comments: string[];
  comment?: string;
}

export interface CallLine extends LineBase {
  kind: 'call';
  call: string;
}

export interface AnswerLine extends LineBase {
  kind: 'answer';
  callee: string;
  // The arguments, as written, if given.
  args?: string;
  // The value in WAVE; undefined to trap, or for a hole.
  value?: string;
  hole: boolean;
}

export type ScriptLine = CallLine | AnswerLine;

const TRAP = '!trap';
const HOLE = '?';
// The parts of comments that `--save` writes anew each time: the call an unpinned answer
// answered, the type a hole expects, and a call's result. Its notes on defaults, e.g.
// `default; instances of x: …`, stay until the user removes them.
const REWRITTEN = { answer: /^(was |expects )/, call: /^(= |! )/ };

// The end of the string or char literal starting at `start`, just past its closing quote.
function literalEnd(text: string, start: number): number {
  const quote = text[start];
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === '\\') {
      i++;
    } else if (text[i] === quote) {
      return i + 1;
    }
  }
  return text.length;
}

// Splits off a `//` comment outside string and char literals, e.g. a URL in a string isn't one.
function splitComment(text: string): [string, string | undefined] {
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"' || text[i] === "'") {
      i = literalEnd(text, i) - 1;
    } else if (text.startsWith('//', i)) {
      return [text.slice(0, i).trimEnd(), text.slice(i + 2).trim()];
    }
  }
  return [text.trimEnd(), undefined];
}

// A comment without the parts `--save` writes anew.
function ownComment(comment: string | undefined, kind: keyof typeof REWRITTEN): string | undefined {
  const own = comment?.split('; ').filter((part) => !REWRITTEN[kind].test(part)).join('; ');
  return own === '' ? undefined : own;
}

// The index just past the parenthesis that closes the one at `open`, skipping literals.
function closing(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'") {
      i = literalEnd(text, i) - 1;
    } else if (c === '(') {
      depth++;
    } else if (c === ')' && --depth === 0) {
      return i + 1;
    }
  }
  throw new Error('Unclosed (');
}

// Parses one answer, e.g. `docs:adder/add@0.1.0.add(1, 2) = 3`.
export function parseAnswer(line: string, source: string, comments: string[] = []): AnswerLine {
  const fail = (message: string) => new Error(`${source}: ${message}, in ${line.trim()}`);
  const [code, comment] = splitComment(line);
  const end = code.search(/[(=]/);
  if (end < 0) {
    throw fail('Expected `import = value`');
  }
  const callee = code.slice(0, end).trim();
  if (callee.startsWith('#')) {
    throw fail('Write a method as resource.method(#borrow-x-1, …), with the instance as its first argument');
  }
  let rest = code.slice(end);
  let args: string | undefined;
  if (rest.startsWith('(')) {
    let close: number;
    try {
      close = closing(rest, 0);
    } catch (err) {
      throw fail((err as Error).message);
    }
    args = rest.slice(1, close - 1);
    rest = rest.slice(close).trimStart();
  }
  if (callee === '' || !rest.startsWith('=')) {
    throw fail('Expected `import = value`');
  }
  const value = rest.slice(1).trim();
  if (value === '') {
    throw fail('Expected a value after =');
  }
  return {
    kind: 'answer', source, comments, comment: ownComment(comment, 'answer'), callee, args,
    value: value === TRAP || value === HOLE ? undefined : value, hole: value === HOLE,
  };
}

// Parses an answers file, numbering its lines, e.g. `answers.txt:3`.
export function parseScript(text: string, file: string): ScriptLine[] {
  const lines: ScriptLine[] = [];
  let comments: string[] = [];
  text.replace(/\n$/, '').split(/\r?\n/).forEach((line, i) => {
    const source = `${file}:${i + 1}`;
    const trimmed = line.trim();
    if (trimmed.startsWith('//!')) {
      return;
    }
    if (trimmed === '' || trimmed.startsWith('//')) {
      comments.push(trimmed);
      return;
    }
    if (trimmed.startsWith('>')) {
      const [call, comment] = splitComment(trimmed.slice(1).trim());
      lines.push({ kind: 'call', source, comments, comment: ownComment(comment, 'call'), call });
    } else {
      lines.push(parseAnswer(line, source, comments));
    }
    comments = [];
  });
  return lines;
}

// A handle of any resource: the type of a method's `self` when comparing arguments, which
// doesn't check whose handle it is.
const anyHandle = (() => {
  const rec = WIT.Rec();
  rec.fill(WIT.Resource('self', {}));
  return WIT.Borrow(rec);
})();

// Whether the arguments written in an answer are those of the call, as values.
function sameArgs(func: WIT.FuncClass, written: string, record: CallRecord): boolean {
  const types = [...(record.self === undefined ? [] : [anyHandle]), ...func._args.map(([_, ty]) => ty)];
  if (types.length === 0) {
    return written.trim() === '';
  }
  const tuple = WIT.Tuple(types);
  const called = `(${record.args.join(', ')})`;
  try {
    return canonicalWave(tuple, `(${written})`) === canonicalWave(tuple, called);
  } catch {
    // E.g. an argument the table doesn't track, `#<x>`, which isn't WAVE.
    return `(${written})` === called;
  }
}

function payloadType(t: WIT.Type): WIT.Type | undefined {
  return t instanceof WIT.NullClass ? undefined : t;
}

// The happy path's answer of the type, with notes on the instances it passed over, if there is an
// obvious answer at the level:
// - `ok` for a `result`, with the happy path of its payload, and tuples and records of those;
// - a new mock for a handle when the UI's instance picker would offer no other instance, or the
//   only instance if there is one and the resource can't be mocked;
// - at `eager`, also a new mock when the picker would offer instances, which the notes list.
// Other values, e.g. numbers, options and lists, are for the user to choose.
export function happyValue(t: WIT.Type, context: AnswerContext, level: DefaultsLevel): { value: string; notes: string[] } | undefined {
  const notes = new Map<WIT.ResourceClass, string>();
  const happy = (t: WIT.Type): string | undefined => {
    const all = (types: WIT.Type[]) => {
      const values = types.map(happy);
      return values.every((v) => v !== undefined) ? values as string[] : undefined;
    };
    if (t instanceof WIT.RecClass) {
      return happy(t.get_type()!);
    }
    if (t instanceof WIT.ResultClass) {
      const ok = payloadType(t._fields.ok);
      const value = ok && happy(ok);
      return !ok ? 'ok' : value && `ok(${value})`;
    }
    if (t instanceof WIT.TupleClass) {
      const values = all(t._components);
      return values && `(${values.join(', ')})`;
    }
    if (t instanceof WIT.RecordClass && !(t instanceof WIT.FlagsClass)) {
      const fields = Object.entries(t._fields);
      const values = all(fields.map(([_, ty]) => ty));
      return values && `{${fields.map(([name], i) => `${name}: ${values[i]}`).join(', ')}}`;
    }
    const resource = t instanceof WIT.OwnedClass ? t.resource : t instanceof WIT.ResourceClass ? t : undefined;
    if (!resource) {
      return undefined;
    }
    const choices = context.choices(resource);
    const mockable = context.canMock(resource);
    if (choices.length === 0) {
      return mockable ? '#mock' : undefined;
    }
    if (choices.length === 1 && !mockable) {
      notes.set(resource, `the only instance of ${resource.witName}`);
      return `#${choices[0].id}`;
    }
    if (mockable && level === 'eager') {
      notes.set(resource, listInstances(resource, choices, false, 5));
      return '#mock';
    }
    return undefined;
  };
  const value = level === 'none' ? undefined : happy(t);
  return value === undefined ? undefined : { value, notes: [...notes.values()] };
}

function divergence(line: ScriptLine, what: string): Error {
  return new Error(`${line.source}: ${what}. ${RESTART}.`);
}

// Answers the imports from an answers file, checking each line against the run, and then from
// the happy path. The CLI tells it about the calls it makes.
export class Script implements AnswerSource {
  private next = 0;
  // Just past the last answer: the happy path applies from there on.
  private readonly recordedEnd: number;
  // The last answer used.
  public lastUsed?: AnswerLine;

  constructor(private readonly lines: ScriptLine[], private readonly level: DefaultsLevel) {
    this.recordedEnd = lines.reduce((end, line, i) => (line.kind === 'answer' ? i + 1 : end), 0);
    const unpinned = level === 'eager' ? undefined : lines.find((line) => line.kind === 'answer' && line.args === undefined);
    if (unpinned) {
      throw new Error(`${unpinned.source}: --defaults ${level} needs the arguments of each answer, e.g. ${(unpinned as AnswerLine).callee}(…) = …`);
    }
  }

  public get calls(): CallLine[] {
    return this.lines.filter((line): line is CallLine => line.kind === 'call');
  }

  // Before running a call: the file's line for it, if it has one. Answers before it that no
  // import asked for mean the guest's calls changed. Without call lines, the calls are the
  // command line's, and the answers one sequence across them.
  public beginCall(call: string): CallLine | undefined {
    const line = this.lines[this.next];
    if (line?.kind === 'call') {
      this.next++;
      return line;
    }
    if (line && this.next < this.recordedEnd && this.calls.length > 0) {
      throw divergence(line, `no import asked for this answer before the next call, ${call}`);
    }
    return undefined;
  }

  // After the last call: answers left mean the guest's calls changed.
  public finish() {
    const line = this.lines.slice(this.next, this.recordedEnd).find((l) => l.kind === 'answer');
    if (line) {
      throw divergence(line, 'no import asked for this answer');
    }
  }

  public answer(record: CallRecord, func: WIT.FuncClass, context: AnswerContext): Answer | undefined {
    const line = this.lines[this.next];
    if (this.next < this.recordedEnd) {
      if (line.kind === 'call') {
        // An import the run makes before the file's next call; with calls, each call's answers
        // come between its line and the next.
        throw divergence(line, `the guest called ${record.label}, but the file has the next call here`);
      }
      if (line.callee !== record.callee) {
        throw divergence(line, `the answer is for ${line.callee}, but the guest called ${record.label}`);
      }
      if (line.args !== undefined && !sameArgs(func, line.args, record)) {
        throw new Error(`${line.source}: the answer is for ${line.callee}(${line.args}), but the guest called ${record.label}. ${RESTART}; `
          + 'if these arguments vary between runs, remove them from the line instead.');
      }
      this.next++;
      this.lastUsed = line;
      return {
        source: line.source, value: line.value, hole: line.hole, comments: line.comments, comment: line.comment, pinned: line.args !== undefined,
      };
    }
    const happy = happyValue(func._ret[0], context, this.level);
    return happy && { source: 'default', value: happy.value, note: happy.notes.join('; ') || undefined };
  }
}

// Calls `fn` on each `#label` of the text outside string and char literals, replacing it.
function mapHandles(text: string, fn: (label: string) => string): string {
  let out = '';
  for (let i = 0; i < text.length;) {
    const c = text[i];
    if (c === '"' || c === "'") {
      const end = literalEnd(text, i);
      out += text.slice(i, end);
      i = end;
    } else if (c === '#') {
      const label = /^#([a-zA-Z0-9-]+)/.exec(text.slice(i));
      out += label ? `#${fn(label[1])}` : c;
      i += label ? label[0].length : 1;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

// A line `--save` writes, and for those that say where an instance came from, the instance's id,
// to write only if a later line uses it.
interface SavedLine {
  text: string;
  origin?: string;
  hole?: boolean;
}

// An import answered in the run, until it returns.
interface Answering {
  index: number;
  record: CallRecord;
  answer: Answer;
  // The instances there were when it was answered; others in its result are its new mocks.
  before: Set<string>;
}

// Writes the answers file of a run, as `--save` does: the calls, the answers each import got,
// with new mocks as `#mock-x-2`, and where other instances came from.
export class ScriptRecorder {
  private readonly lines: SavedLine[] = [];
  private readonly answering = new Map<CallRecord, Answering>();
  private readonly shown = new Map<CallRecord, string>();
  private call?: { index: number; text: string; line?: CallLine; record?: CallRecord };

  constructor(private readonly header: string[], private readonly ids: () => Set<string>) {}

  // A call the run makes, from the file's line if it has one.
  public beginCall(text: string, line?: CallLine) {
    this.lines.push(...(line?.comments ?? []).map((comment) => ({ text: comment })));
    this.call = { index: this.lines.length, text, line };
    this.lines.push({ text: `> ${text}` });
  }

  public event(event: DriverEvent) {
    switch (event.type) {
      case 'call':
        if (event.record.kind !== 'import' && this.call && !this.call.record) {
          this.call.record = event.record;
        }
        break;
      case 'answer': {
        this.lines.push(...(event.answer.comments ?? []).map((comment) => ({ text: comment })));
        this.answering.set(event.record, { index: this.lines.length, record: event.record, answer: event.answer, before: this.ids() });
        this.lines.push({ text: '' });
        this.writeAnswer(event.record, undefined);
        break;
      }
      case 'result':
      case 'error': {
        const text = event.type === 'result' ? (event.text === '' ? '()' : event.text) : event.text;
        if (this.answering.has(event.record)) {
          this.writeAnswer(event.record, event.type === 'result' ? text : undefined);
          this.answering.delete(event.record);
        } else if (event.record === this.call?.record) {
          const own = this.call.line?.comment;
          const result = event.type === 'result' ? `= ${text}` : `! ${text}`;
          this.lines[this.call.index] = { text: `> ${this.call.text}  // ${[own, result].filter(Boolean).join('; ')}` };
        }
        break;
      }
      case 'instance': {
        const { instance } = event;
        // Not the new mocks of answers, which show as `#mock-x-2`, nor what a call returns: those
        // instances come from the call they were answered or returned by.
        const answered = [...this.answering.values()].some(({ record }) => record.label === instance.origin);
        if (answered || instance.origin === this.call?.record?.label) {
          break;
        }
        this.lines.push({ text: `//! ${instance.origin} = #${instance.id}`, origin: instance.id });
        break;
      }
    }
  }

  // The value an import got, as `--save` writes it: its result, with its new mocks as `#mock-x-2`.
  public valueOf(record: CallRecord): string | undefined {
    return this.shown.get(record);
  }

  private writeAnswer(record: CallRecord, result: string | undefined) {
    const { index, answer, before } = this.answering.get(record)!;
    let value = answer.value === undefined ? TRAP : answer.value;
    if (result !== undefined && answer.value !== undefined) {
      value = mapHandles(result, (label) => (before.has(label) || label.startsWith('borrow-') ? label : `mock-${label}`));
      this.shown.set(record, value);
    }
    const head = answer.source === 'default' || answer.pinned ? record.label : record.callee;
    const notes = answer.source === 'default'
      ? ['default', answer.note]
      : [answer.comment, answer.pinned ? undefined : `was ${record.label}`];
    const comment = notes.filter(Boolean).join('; ');
    this.lines[index] = { text: `${head} = ${value}${comment ? `  // ${comment}` : ''}` };
  }

  // An import still to be answered, where the run stopped.
  public hole(record: CallRecord, type: WIT.Type) {
    this.lines.push({ text: `${record.label} = ${HOLE}  // expects ${type.name}`, hole: true });
  }

  // The line number of the hole in the file `text` writes, if there is one.
  public holeLine(): number | undefined {
    const index = this.kept().findIndex((line) => line.hole);
    return index < 0 ? undefined : this.header.length + index + 1;
  }


  // Calls the run didn't get to.
  public rest(calls: Array<{ text: string; line?: CallLine }>) {
    for (const { text, line } of calls) {
      this.lines.push(...(line?.comments ?? []).map((comment) => ({ text: comment })));
      this.lines.push({ text: `> ${text}${line?.comment ? `  // ${line.comment}` : ''}` });
    }
  }

  // The file: the header, and the lines, with where instances came from only if a later line
  // uses them.
  public text(): string {
    return [...this.header, ...this.kept().map((line) => line.text)].map((line) => `${line}\n`).join('');
  }

  private kept(): SavedLine[] {
    return this.lines.filter((line, i) => line.origin === undefined || this.lines.slice(i + 1).some((later) => usesId(later.text, line.origin!)));
  }
}

function usesId(text: string, id: string): boolean {
  let used = false;
  mapHandles(splitComment(text)[0], (label) => {
    used ||= label === id || label === `borrow-${id}` || label === `mock-${id}`;
    return label;
  });
  return used;
}

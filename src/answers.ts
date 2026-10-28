import * as WIT from './wit';
import { CallRecord } from './call-record';
import { Answer, AnswerContext, AnswerSource, defaultAnswer, DefaultsLevel, RESTART } from './answering';
import type { HostCode } from './host-resources';
import { answeredValue, CallEntry, CallLog, ImportEntry, isOwnCall } from './call-log';
import { canonicalWave, mapHandles } from './wave';

// The answers file: the calls of a run, and the answers to the imports that ask, in the order
// the guest calls them. `--save` writes it from a run, so that it reproduces the run:
//
//     //! component-ui call public/resource.wasm --defaults eager
//     > new exports/x(5)  // = #x-1
//     > exports.test-imports()
//     //! new imports/y(10) = #y-1
//     imports/y.get-a(#borrow-y-1) = 10
//     //! imports/y.set-a(#borrow-y-1, 20)
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
//   the imports that didn't ask, e.g. `//! imports/y.set-a(#borrow-y-1, 20)`, the header, and where
//   instances came from that no other line shows, e.g. WASI's. Other `//` comments, and
//   those after a call or answer, are kept, including `--save`'s notes on the happy path's
//   answers, e.g. `// default; instances of x: …`, until the user removes them.
//
// The file is followed strictly: a run whose calls differ from it stops at the first line that
// doesn't match. Past the last answer, the imports get the happy path (see `happyValue`).

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
  // Whose code gave the answer, if it was recorded from a run, e.g. `// javascript`.
  recorded?: HostCode;
}

export type ScriptLine = CallLine | AnswerLine;

const TRAP = '!trap';
const HOLE = '?';
// The parts of comments that `--save` writes anew each time: the call an unpinned answer
// answered, the type a hole expects, and a call's result. Its notes on defaults, e.g.
// `default; instances of x: …`, stay until the user removes them.
const REWRITTEN = { answer: /^(was |expects |your JavaScript )/, call: /^(= |! )/ };
// The markers of answers recorded from the host's own code.
const RECORDED: HostCode[] = ['javascript', 'wasi'];
// The answers marked as whose they are, e.g. `// default`, rather than an answers file's: the
// happy path's, and those of the host's own code, which the log records.
const MARKED = new Set(['default', ...RECORDED]);

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
  const own = ownComment(comment, 'answer');
  const marker = own?.split('; ')[0];
  return {
    kind: 'answer', source, comments, comment: own, callee, args,
    value: value === TRAP || value === HOLE ? undefined : value, hole: value === HOLE,
    recorded: RECORDED.find((code) => code === marker),
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

// Where the run differs from the answers file, at `line`.
export class Divergence extends Error {
  constructor(public readonly line: ScriptLine, what: string) {
    super(`${line.source}: ${what}. ${RESTART}.`);
  }
}

function divergence(line: ScriptLine, what: string): Error {
  return new Divergence(line, what);
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
    return defaultAnswer(func._ret[0], context, this.level);
  }
}

// The packages whose JavaScript implements anything: what is left of it without comments. A
// template from the UI's editor or `template` is all comments.
export function implementedImports(code: Record<string, string>): string[] {
  const stripped = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').trim();
  return Object.entries(code).filter(([_, text]) => stripped(text) !== '').map(([pkg]) => pkg);
}

// The header of an answers file: `command`, which made or replays the run, and where the answers
// of the imports implemented in JavaScript and of WASI come from.
export function scriptHeader(command: string, implemented: string[], wasiShim: boolean): string[] {
  return [
    `//! ${command}`,
    implemented.length === 0
      ? '//! imports implemented in JavaScript: none'
      : `//! imports implemented in JavaScript: ${implemented.join(', ')}; their answers are recorded, marked // javascript, so a replay needs no --imports`,
    wasiShim
      ? '//! WASI comes from the shim; its answers are recorded, marked // wasi, so a replay, which needs --no-wasi-shim, gives the guest the same clocks and random numbers'
      : '//! WASI doesn\'t come from the shim: its calls ask, and are recorded, like any other import\'s',
  ];
}

// What an answers file says about a run, besides the log, which has the answers, e.g. the
// file's lines with their comments: the file's lines of the calls.
export interface ScriptOptions {
  header: string[];
  // The file's lines of the calls, in the order they were made.
  callLines?: Array<CallLine | undefined>;
  // Calls not made, which follow the rest.
  rest?: Array<{ text: string; line?: CallLine }>;
}

// A line of an answers file, and whether it is a hole, an answer still to give.
export interface ScriptText {
  text: string;
  hole?: boolean;
}

// The ids of the instances new mocks of call arguments got, e.g. `#mock` or the UI's "New mock",
// and which call they were for.
function newMocks(log: CallLog): Map<string, CallEntry> {
  const calls = log.entries.filter((e): e is CallEntry => e.kind === 'call');
  const mocks = new Map<string, CallEntry>();
  for (const { seq, instance } of log.instances) {
    const call = calls.find((c) => c.seq > seq);
    if (instance.origin === 'new mock' && call) {
      mocks.set(instance.id, call);
    }
  }
  return mocks;
}

// The lines of an answers file that reproduces the run of a log: its calls; each import the guest
// made, in order, as the answer it got, with new mocks as `#mock-x-2`, as a `?` if it still asks,
// or as a `//!` line if it didn't ask; and where other instances came from, e.g. WASI's.
export function scriptLines(log: CallLog, options: ScriptOptions): ScriptText[] {
  const lines: ScriptText[] = options.header.map((text) => ({ text }));
  // The current component instance's part of the log.
  const entries = log.entries.filter((e) => e.seq >= log.since);
  const imports = entries.flatMap((e): ImportEntry[] => (e.kind === 'call' ? e.imports : e.kind === 'import' ? [e] : []));
  const calls = entries.filter((e): e is CallEntry => e.kind === 'call' && e.record !== undefined);
  // The labels of the imports and calls, whose lines show the instances they made.
  const made = new Set([...imports.map((i) => i.record.label), ...calls.map((c) => c.label), 'new mock']);
  const mocks = newMocks(log);
  const items: Array<{ seq: number; write: () => void }> = [
    ...calls.map((call, n) => ({ seq: call.seq, write: () => writeCall(call, options.callLines?.[n]) })),
    ...imports.map((entry) => ({ seq: entry.seq, write: () => writeImport(entry) })),
    ...log.instances.filter(({ seq, instance }) => seq >= log.since && !made.has(instance.origin))
      .map(({ seq, instance }) => ({ seq, write: () => lines.push({ text: `//! ${instance.origin} = #${instance.id}` }) })),
  ];
  const writeCall = (call: CallEntry, script?: CallLine) => {
    lines.push(...(script?.comments ?? []).map((text) => ({ text })));
    // A new mock passed to the call is written as such, e.g. `#mock-x-2`, or `#borrow-mock-x-2`.
    const text = mapHandles(call.label, (label) => {
      const borrowed = label.startsWith('borrow-');
      const id = borrowed ? label.slice('borrow-'.length) : label;
      return mocks.get(id) === call ? `${borrowed ? 'borrow-' : ''}mock-${id}` : label;
    });
    const result = call.status === 'pending' ? undefined : call.status === 'ok' ? `= ${call.output === '' ? '()' : call.output}` : `! ${call.output}`;
    const comment = [script?.comment, result].filter(Boolean).join('; ');
    lines.push({ text: `> ${text}${comment ? `  // ${comment}` : ''}` });
  };
  const writeImport = (entry: ImportEntry) => {
    const { record } = entry;
    // The answer, unless it was the user's: e.g. a file's line, with its comments.
    const answer = entry.answered?.by;
    if (entry.prompt) {
      lines.push({ text: `${record.label} = ${HOLE}  // expects ${entry.prompt.type.name}`, hole: true });
    } else if (entry.answered) {
      lines.push(...(answer?.comments ?? []).map((text) => ({ text })));
      const value = entry.answered.trapped ? TRAP : answeredValue(entry) ?? answer?.value;
      if (value === undefined) {
        return;
      }
      const marked = answer !== undefined && MARKED.has(answer.source);
      const unpinned = answer !== undefined && !marked && !answer.pinned;
      const head = unpinned ? record.callee : record.label;
      const notes = marked ? [answer.source, answer.note, entry.note]
        : [answer?.comment, unpinned ? `was ${record.label}` : undefined, entry.note];
      const comment = notes.filter(Boolean).join('; ');
      lines.push({ text: `${head} = ${value}${comment ? `  // ${comment}` : ''}` });
    } else if (entry.status !== 'pending' && !(entry.parent && isOwnCall(entry.parent, entry))) {
      // An import that didn't ask, e.g. a constructor, or a function without a result.
      const result = entry.status === 'error' ? `  ! ${entry.output}` : entry.output ? ` = ${entry.output}` : '';
      lines.push({ text: `//! ${record.label}${result}` });
    }
  };
  items.sort((a, b) => a.seq - b.seq).forEach((item) => item.write());
  for (const { text, line } of options.rest ?? []) {
    lines.push(...(line?.comments ?? []).map((comment) => ({ text: comment })));
    lines.push({ text: `> ${text}${line?.comment ? `  // ${line.comment}` : ''}` });
  }
  return lines;
}

export function writeScript(log: CallLog, options: ScriptOptions): string {
  return scriptLines(log, options).map((line) => `${line.text}\n`).join('');
}

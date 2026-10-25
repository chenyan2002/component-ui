import * as WIT from './wit';
import { CallRecord, calleesOf } from './call-record';
import { Answer, AnswerSource } from './driver';
import { canonicalWave, parseWave } from './wave';

// Answers to imports, one per line, in the order the guest calls the imports that ask:
//
//     docs:adder/add@0.1.0.add = 3
//     docs:adder/add@0.1.0.add(1, 2) = 3
//     #borrow-y-1.get-a = ok(7)
//     imports/y.get-a = !trap
//
// Each names the import it answers, as the console shows the call, so that an answer the guest
// doesn't ask for next stops the run rather than answer the wrong call. With arguments, it
// answers only a call with those. A method's may name the instance, or any instance of the
// resource. The value is WAVE of the type the import returns, or `!trap` to trap the guest.
// Blank lines and lines starting with `//` are skipped.

export interface AnswerEntry {
  // Where the answer was written, e.g. `answers.txt:3`, for messages.
  source: string;
  callee: string;
  // The arguments, as written, if given.
  args?: string;
  // The value in WAVE; undefined to trap.
  value?: string;
}

const TRAP = '!trap';

// The index just past the parenthesis that closes the one at `open`, skipping string and char
// literals, which may contain parentheses.
function closing(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'") {
      for (i++; i < text.length && text[i] !== c; i++) {
        if (text[i] === '\\') {
          i++;
        }
      }
    } else if (c === '(') {
      depth++;
    } else if (c === ')' && --depth === 0) {
      return i + 1;
    }
  }
  throw new Error('Unclosed (');
}

// Parses one answer, e.g. `docs:adder/add@0.1.0.add(1, 2) = 3`.
export function parseAnswer(line: string, source: string): AnswerEntry {
  const fail = (message: string) => new Error(`${source}: ${message}, in ${line.trim()}`);
  const end = line.search(/[(=]/);
  if (end < 0) {
    throw fail('Expected `import = value`');
  }
  const callee = line.slice(0, end).trim();
  let rest = line.slice(end);
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
  return { source, callee, args, value: value === TRAP ? undefined : value };
}

// Parses the answers in a file, numbering them by line, e.g. `answers.txt:3`.
export function parseAnswers(text: string, file: string): AnswerEntry[] {
  return text.split(/\r?\n/).flatMap((line, i) => {
    const trimmed = line.trim();
    return trimmed === '' || trimmed.startsWith('//') ? [] : [parseAnswer(line, `${file}:${i + 1}`)];
  });
}

// Whether the arguments written in an answer are those of the call, as values.
function sameArgs(func: WIT.FuncClass, written: string, record: CallRecord): boolean {
  const types = func._args.map(([_, ty]) => ty);
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

// Answers the imports from a sequence of answers, each checked against the call it answers.
export class SequenceAnswers implements AnswerSource {
  private next = 0;

  constructor(private readonly entries: AnswerEntry[]) {}

  // The answers no import asked for.
  public get unused(): AnswerEntry[] {
    return this.entries.slice(this.next);
  }

  public answer(record: CallRecord, func: WIT.FuncClass): Answer | undefined {
    const entry = this.entries[this.next];
    if (!entry) {
      return undefined;
    }
    const callees = calleesOf(record);
    if (!callees.includes(entry.callee)) {
      throw new Error(`${entry.source}: the answer is for ${entry.callee}, but the guest called ${record.label}`);
    }
    if (entry.args !== undefined && !sameArgs(func, entry.args, record)) {
      throw new Error(`${entry.source}: the answer is for ${entry.callee}(${entry.args}), but the guest called ${record.label}`);
    }
    this.next++;
    if (entry.value === undefined) {
      return { kind: 'trap' };
    }
    try {
      return { kind: 'value', draft: parseWave(func._ret[0], entry.value) };
    } catch (err) {
      throw new Error(`${entry.source}: ${entry.value} is no ${func._ret[0].name}: ${(err as Error).message}`);
    }
  }
}

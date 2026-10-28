import * as WIT from './wit';
import type { CallRecord } from './call-record';
import { draftErrors, instanceChoices } from './draft';
import { errorText, ImportPrompt } from './log';
import { describeInstance, Instance } from './resources';
import { parseWave } from './wave';

// Answering the mocked imports, as the CLI does from its answers file, and both the CLI and
// the UI do by the happy path, at the level of `--defaults` or of the console's choice.

export type DefaultsLevel = 'none' | 'careful' | 'eager';
export const DEFAULTS_LEVELS: DefaultsLevel[] = ['none', 'careful', 'eager'];

// An answer to an import other than the user's: a value in WAVE, or none to trap the guest, or a
// hole, to answer later, which stops the run. `source` is where it came from, e.g.
// `answers.txt:3` or `default`, and `note` says more, e.g. which instances the happy path passed
// over for a mock. The log keeps it with the import it answered.
export interface Answer {
  source: string;
  value?: string;
  hole?: boolean;
  note?: string;
  // What the answers file wrote along with it: the comments before it and after it, and whether
  // it gave the arguments.
  comments?: string[];
  comment?: string;
  pinned?: boolean;
}

// What a divergence error asks the user to do.
export const RESTART = 'The guest\'s calls changed here, e.g. after an earlier answer was edited: remove this line and the ones after it, and run again';

// The instances of a resource, e.g. `instances of x: #x-1 (from new exports/x(5)), or #mock`, up to
// `max` of them, each described as in the UI's instance picker.
export function listInstances(resource: WIT.ResourceClass, instances: Instance[], mock: boolean, max = Infinity): string {
  const listed = instances.slice(0, max).map(describeInstance);
  const more = instances.length > max ? [`and ${instances.length - max} more`] : [];
  return `instances of ${resource.witName}: ${[...listed, ...more].join(', ')}${mock ? ', or #mock' : ''}`;
}

// What an answer source can ask about the instances an answer could return.
export interface AnswerContext {
  // The instances the host could return, as the UI's instance picker offers them.
  choices(resource: WIT.ResourceClass): Instance[];
  canMock(resource: WIT.ResourceClass): boolean;
}

// Answers the mocked imports, in the order the guest calls them, with a value of the type
// `func` returns. Returns undefined when it has no answer, and throws when it can't answer, e.g.
// as its next answer is for another import.
export interface AnswerSource {
  answer(record: CallRecord, func: WIT.FuncClass, context: AnswerContext): Answer | undefined;
  // For a call the WASI shim answers, which returns a value: the answer recorded of it, if any,
  // which the guest gets in place of the shim's, as a replay. Throws where the run differs.
  recorded?(record: CallRecord, func: WIT.FuncClass): Answer | undefined;
}

// What the happy path and messages can know of the instances an answer could return: those of
// the UI's instance picker, for the host returning them, and whether a new mock can be.
export function promptContext(prompt: ImportPrompt): AnswerContext {
  return {
    choices: (resource) => instanceChoices(resource, prompt.registry, 'host'),
    canMock: (resource) => prompt.mock.canMock(resource),
  };
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

// The happy path's answer of the type, at the level, if there is one: `default`, noting the
// instances it passed over.
export function defaultAnswer(t: WIT.Type, context: AnswerContext, level: DefaultsLevel): Answer | undefined {
  const happy = happyValue(t, context, level);
  return happy && { source: 'default', value: happy.value, note: happy.notes.join('; ') || undefined };
}

// Answers by the happy path alone, at the level `level` gives when the import is called, e.g. the one
// chosen in the console's settings.
export function defaultsSource(level: () => DefaultsLevel): AnswerSource {
  return { answer: (_record, func, context) => defaultAnswer(func._ret[0], context, level()) };
}

// Answers a prompt, or traps the guest, as the answer says; why it couldn't, if the answer isn't a
// value of the type the import returns.
export function answerPrompt(prompt: ImportPrompt, answer: Answer): string | undefined {
  if (answer.value === undefined) {
    prompt.trap(answer);
    return undefined;
  }
  let draft;
  try {
    draft = parseWave(prompt.type, answer.value);
  } catch (err) {
    return `${answer.source}: ${answer.value} is no ${prompt.type.name}: ${errorText(err)}`;
  }
  return prompt.answer(draft, answer) ? undefined : `${answer.source}: invalid answer: ${draftErrors(draft).join('; ')}`;
}

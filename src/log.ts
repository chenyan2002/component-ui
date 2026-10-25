import * as WIT from './wit';
import { Draft, MockFactory } from './draft';
import { ResourceRegistry } from './resources';

// How calls are logged, by the console in the app or by another frontend.

export interface LogEntry {
  // `text` is the formatted result, in WAVE; empty for a function without one.
  result(text: string): void;
  // A string is a formatted error, e.g. the `err` of a `result`.
  error(err: unknown): void;
}

// Asks for the return value of an import the guest called.
export interface ImportPrompt {
  // The import, and the type of the value it returns.
  func: WIT.FuncClass;
  type: WIT.Type;
  draft: Draft;
  registry: ResourceRegistry;
  mock: MockFactory;
  // Returns the value in `draft`, by default the prompt's own, unless it is invalid; whether it
  // was valid. The errors are on the draft. `by` says who answered, if not the user.
  answer(draft?: Draft, by?: AnsweredBy): boolean;
  random(): void;
  trap(by?: AnsweredBy): void;
}

// Who answered an import other than the user, e.g. `default` for the happy path, or an answers
// file's line, e.g. `run.txt:3`, and what more to say, e.g. which instances it passed over.
export interface AnsweredBy {
  source: string;
  note?: string;
}

export interface ImportLog extends LogEntry {
  // Shows the prompt until the import gets a result or an error.
  ask(prompt: ImportPrompt): void;
  // A result shown below the call rather than after it, e.g. an HTTP response.
  detail(text: string): void;
  // Something to know about the call, e.g. why the user's JavaScript wasn't called.
  note(text: string): void;
  // The prompt was answered, by trapping the guest or with a value, which is about to be returned.
  answered(trapped: boolean, by?: AnsweredBy): void;
}

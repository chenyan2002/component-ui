import * as WIT from './wit';
import type { Answer } from './answering';
import { Draft, MockFactory } from './draft';
import { ResourceRegistry } from './resources';

// How calls are logged, by the console in the app or by another frontend.

// How an error shows, e.g. in the log or a stop's reason: its message.
export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

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
  // was valid. The errors are on the draft. `by` is the answer, if it isn't the user's, e.g. the
  // happy path's or an answers file's.
  answer(draft?: Draft, by?: Answer): boolean;
  random(): void;
  trap(by?: Answer): void;
}

export interface ImportLog extends LogEntry {
  // Shows the prompt until the import gets a result or an error.
  ask(prompt: ImportPrompt): void;
  // A result shown below the call rather than after it, e.g. an HTTP response.
  detail(text: string): void;
  // Something to know about the call, e.g. why the user's JavaScript wasn't called.
  note(text: string): void;
  // The prompt was answered, by trapping the guest or with a value, which is about to be returned.
  answered(trapped: boolean, by?: Answer): void;
}

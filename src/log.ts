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
  type: WIT.Type;
  draft: Draft;
  registry: ResourceRegistry;
  mock: MockFactory;
  // Returns the value in the draft, unless it is invalid.
  answer(): void;
  random(): void;
  trap(): void;
}

export interface ImportLog extends LogEntry {
  // Shows the prompt until the import gets a result or an error.
  ask(prompt: ImportPrompt): void;
  // A result shown below the call rather than after it, e.g. an HTTP response.
  detail(text: string): void;
}

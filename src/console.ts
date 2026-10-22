import { html, LitElement, nothing, PropertyValues } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import * as WIT from './wit';
import { Draft, MockFactory } from './draft';
import { renderField, typeName } from './form';
import { ResourceRegistry } from './resources';

// Marks a string shown unquoted: a name from `describe`, or a `bigint` (e.g. a `u64`).
const RAW = '\uE000';

// Pretty-prints a value; `describe` can replace objects (e.g. resource handles) by a name.
export function customStringify(obj: any, describe?: (value: any) => string | undefined): string {
  if (obj === undefined) {
    return 'undefined';
  }
  const json = JSON.stringify(obj, (_key, value) => {
    const name = describe?.(value);
    if (name !== undefined) {
      return RAW + name;
    }
    if (typeof value === 'bigint') {
      return RAW + value.toString();
    }
    if (typeof value === 'function' || typeof value === 'symbol') {
      return value.toString();
    }
    if (value instanceof Uint8Array) {
      return Array.from(value);
    }
    return value;
  }, 2);
  if (json === '{}' && obj?.constructor?.name) {
    return `[object ${obj.constructor.name}]`;
  }
  return json.replace(new RegExp(`"${RAW}([^"]*)"`, 'g'), '$1');
}

function errorText(err: unknown): string {
  // jco throws a `ComponentError` carrying the payload of a WIT `result` error.
  if (err instanceof Error && 'payload' in err) {
    return `err(${customStringify(err.payload)})`;
  }
  return err instanceof Error ? err.message : String(err);
}

export interface LogEntry {
  // `text` is the formatted result.
  result(text: string): void;
  error(err: unknown): void;
}

// The form asking the user for the return value of an import the guest called.
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

// An import the guest called, under the call that made it, if any.
interface ImportEntry {
  kind: 'import';
  call: string;
  status: 'pending' | 'ok' | 'error';
  output?: string;
  detail?: string;
  prompt?: ImportPrompt;
}

interface CallEntry {
  kind: 'call';
  call: string;
  time: string;
  status: 'pending' | 'ok' | 'error';
  output?: string;
  elapsed?: number;
  imports: ImportEntry[];
}

// Text the component wrote to stdout or stderr.
interface StreamEntry {
  kind: 'stream';
  stream: 'stdout' | 'stderr';
  text: string;
}

type Entry = CallEntry | StreamEntry | ImportEntry;

@customElement('console-panel')
export class ConsolePanel extends LitElement {
  @state() accessor entries: Entry[] = [];
  @query('.console') accessor list!: HTMLElement;

  // Render into the light DOM so the global stylesheet applies.
  protected createRenderRoot() {
    return this;
  }

  public clear() {
    this.entries = [];
  }

  public logCall(call: string): LogEntry {
    const started = performance.now();
    const entry: CallEntry = { kind: 'call', call, time: new Date().toLocaleTimeString(), status: 'pending', imports: [] };
    this.entries = [...this.entries, entry];
    const finish = (status: CallEntry['status'], output: string) => {
      Object.assign(entry, { status, output, elapsed: Math.round(performance.now() - started) });
      this.requestUpdate();
    };
    return {
      result: (text) => finish('ok', text),
      error: (err) => finish('error', errorText(err)),
    };
  }

  // Logs an import the guest called, under the pending call it happened in.
  public logImport(call: string): ImportLog {
    const entry: ImportEntry = { kind: 'import', call, status: 'pending' };
    const parent = [...this.entries].reverse().find((e): e is CallEntry => e.kind === 'call' && e.status === 'pending');
    if (parent) {
      parent.imports.push(entry);
      this.requestUpdate();
    } else {
      this.entries = [...this.entries, entry];
    }
    const finish = (status: ImportEntry['status'], output: string) => {
      Object.assign(entry, { status, output, prompt: undefined });
      this.requestUpdate();
    };
    return {
      result: (text) => finish('ok', text),
      error: (err) => finish('error', errorText(err)),
      detail: (text) => {
        Object.assign(entry, { status: 'ok', detail: text, prompt: undefined });
        this.requestUpdate();
      },
      ask: (prompt) => {
        entry.prompt = prompt;
        this.requestUpdate();
      },
    };
  }

  public print(stream: StreamEntry['stream'], text: string) {
    // Consecutive writes to the same stream share an entry.
    const last = this.entries[this.entries.length - 1];
    if (last?.kind === 'stream' && last.stream === stream) {
      last.text += text;
      this.requestUpdate();
    } else {
      this.entries = [...this.entries, { kind: 'stream', stream, text }];
    }
  }

  protected updated(_changed: PropertyValues) {
    this.list.scrollTop = this.list.scrollHeight;
    // A new prompt takes the focus, so the answer can be typed right away.
    const prompt = this.querySelector<HTMLElement>('.import-prompt:not([data-focused])');
    if (prompt) {
      prompt.dataset.focused = '';
      prompt.querySelector<HTMLElement>('input, select')?.focus();
    }
  }

  protected render() {
    return html`
      <div class="panel-header">
        <span class="panel-title"><wa-icon name="terminal"></wa-icon> Console</span>
        <wa-button size="s" appearance="plain" @click=${() => this.clear()}>Clear</wa-button>
      </div>
      <div class="console">
        ${this.entries.length === 0
          ? html`<div class="console-empty">Call a function to see results here.</div>`
          : this.entries.map((entry) => this.renderEntry(entry))}
      </div>
    `;
  }

  private renderImport(entry: ImportEntry) {
    return html`<div class="log-import ${entry.status}">
      <div class="log-call">
        <span class="log-prompt">↳</span>
        <code>${entry.call}</code>
        ${entry.output === undefined ? nothing : html`<span class="log-import-output">= <code>${entry.output}</code></span>`}
      </div>
      ${entry.detail === undefined ? nothing : html`<div class="log-output"><pre>${entry.detail}</pre></div>`}
      ${entry.prompt ? this.renderPrompt(entry.prompt) : nothing}
    </div>`;
  }

  private renderPrompt(prompt: ImportPrompt) {
    const form = { update: () => this.requestUpdate(), registry: prompt.registry, mock: prompt.mock };
    // Enter in a field returns the answer, as the Return button does.
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
        e.preventDefault();
        this.act(prompt.answer);
      }
    };
    return html`<div class="import-prompt" @keydown=${onKeydown}>
      <div class="muted">returns ${typeName(prompt.type)}</div>
      ${renderField(prompt.type, prompt.draft, form)}
      <div class="func-actions">
        <wa-button variant="brand" size="s" @click=${() => this.act(prompt.answer)}>Return</wa-button>
        <wa-button appearance="outlined" size="s" title="Fill empty fields with random values" @click=${() => this.act(prompt.random)}>
          Random
        </wa-button>
        <wa-button appearance="plain" variant="danger" size="s" title="Fail the import, trapping the guest" @click=${() => prompt.trap()}>
          Trap
        </wa-button>
      </div>
    </div>`;
  }

  // Runs a prompt action, then re-renders to show its validation errors or random values.
  private act(action: () => void) {
    action();
    this.requestUpdate();
  }

  private renderEntry(entry: Entry) {
    if (entry.kind === 'import') {
      return html`<div class="log-entry import">${this.renderImport(entry)}</div>`;
    }
    if (entry.kind === 'stream') {
      return html`<div class="log-entry stream ${entry.stream}">
        <span class="log-stream">${entry.stream}</span>
        <pre>${entry.text.replace(/\r?\n$/, '')}</pre>
      </div>`;
    }
    const waiting = entry.imports.some((i) => i.prompt);
    const meta = waiting ? 'waiting for an import' : entry.elapsed === undefined ? entry.time : `${entry.time} · ${entry.elapsed} ms`;
    return html`<div class="log-entry ${entry.status}">
      <div class="log-call">
        <span class="log-prompt">›</span>
        <code>${entry.call}</code>
        <span class=${waiting ? 'log-meta waiting' : 'log-meta'}>${meta}</span>
      </div>
      ${entry.imports.length > 0 ? html`<div class="log-imports">${entry.imports.map((i) => this.renderImport(i))}</div>` : nothing}
      ${entry.output === undefined
        ? nothing
        : html`<div class="log-output">
            <pre>${entry.output}</pre>
            <wa-copy-button class="log-copy" .value=${entry.output}></wa-copy-button>
          </div>`}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'console-panel': ConsolePanel;
  }
}

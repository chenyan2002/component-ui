import { html, LitElement, nothing, PropertyValues } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';

// Marks a string produced by `describe` so it is shown unquoted.
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
    if (typeof value === 'function' || typeof value === 'bigint' || typeof value === 'symbol') {
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

interface Entry {
  call: string;
  time: string;
  status: 'pending' | 'ok' | 'error';
  output?: string;
  elapsed?: number;
}

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
    const entry: Entry = { call, time: new Date().toLocaleTimeString(), status: 'pending' };
    this.entries = [...this.entries, entry];
    const finish = (status: Entry['status'], output: string) => {
      Object.assign(entry, { status, output, elapsed: Math.round(performance.now() - started) });
      this.requestUpdate();
    };
    return {
      result: (text) => finish('ok', text),
      error: (err) => finish('error', errorText(err)),
    };
  }

  protected updated(_changed: PropertyValues) {
    this.list.scrollTop = this.list.scrollHeight;
  }

  protected render() {
    return html`
      <div class="console-header">
        <span class="console-title"><wa-icon name="terminal"></wa-icon> Console</span>
        <wa-button size="s" appearance="plain" @click=${() => this.clear()}>Clear</wa-button>
      </div>
      <div class="console">
        ${this.entries.length === 0
          ? html`<div class="console-empty">Call a function to see results here.</div>`
          : this.entries.map((entry) => this.renderEntry(entry))}
      </div>
    `;
  }

  private renderEntry(entry: Entry) {
    const meta = entry.elapsed === undefined ? entry.time : `${entry.time} · ${entry.elapsed} ms`;
    return html`<div class="log-entry ${entry.status}">
      <div class="log-call">
        <span class="log-prompt">›</span>
        <code>${entry.call}</code>
        <span class="log-meta">${meta}</span>
      </div>
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

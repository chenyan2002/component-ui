import { html, LitElement, nothing, PropertyValues } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { writeScript } from './answers';
import { CallLog, ImportEntry, isOwnCall, LogItem, StreamEntry } from './call-log';
import { CallRecord } from './call-record';
import { FormContext, renderField, typeName } from './form';
import { ImportLog, ImportPrompt, LogEntry } from './log';

// The guest's frames of a trap, innermost first.
function renderFrames(frames: string[]) {
  return frames.length === 0 ? nothing : html`<div class="log-frames">${frames.map((frame) => html`<div>at ${frame}</div>`)}</div>`;
}

@customElement('console-panel')
export class ConsolePanel extends LitElement {
  // Bumped on each change of the log, which the console renders.
  @state() accessor version = 0;
  @query('.console') accessor list!: HTMLElement;
  @query('.console-log') accessor content!: HTMLElement;
  // The header of the answers file Save writes, e.g. the component's name; none to offer no Save.
  @property({ attribute: false }) accessor saveHeader: string[] | undefined = undefined;
  // The file name Save writes.
  @property() accessor saveName = 'answers.txt';
  public readonly log = new CallLog((added) => {
    if (added) {
      this.follow = true;
    }
    this.version++;
  });
  // Whether the console keeps its end in view as it grows: until the user scrolls up, and again
  // once they scroll back down or a new entry is added.
  private follow = true;
  // Where the console last scrolled itself, to tell its own scrolls from the user's.
  private scrolledTo = 0;
  // Entries grow after they render, e.g. as the fields of a prompt render, so follow their size.
  private readonly resizes = new ResizeObserver(() => this.scrollToEnd());
  // Whether the last stream entry, which shows a few lines at a time, scrolls to its end once it
  // renders: when it is new, or when it grew and wasn't scrolled up to read.
  private streamFollow = false;

  // Render into the light DOM so the global stylesheet applies.
  protected createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.hasUpdated) {
      this.resizes.observe(this.content);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.resizes.disconnect();
  }

  public clear() {
    this.log.clear();
  }

  public logCall(record: CallRecord): LogEntry {
    return this.log.logCall(record);
  }

  // Logs something the UI did that isn't a call, e.g. failing to load a file.
  public logAction(text: string): LogEntry {
    return this.log.logAction(text);
  }

  // Logs an import the guest called, under the pending call it happened in.
  public logImport(record: CallRecord): ImportLog {
    return this.log.logImport(record);
  }

  public print(stream: StreamEntry['stream'], text: string) {
    const pre = this.querySelector<HTMLElement>('.log-entry.stream:last-child pre');
    const atEnd = !pre || pre.scrollHeight - pre.scrollTop - pre.clientHeight < 4;
    // Writes that join the last stream entry follow it if it was scrolled to its end.
    this.streamFollow ||= this.log.print(stream, text) ? atEnd : true;
  }

  // Downloads the log as an answers file, which the CLI replays.
  private save() {
    const text = writeScript(this.log, { header: this.saveHeader ?? [] });
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = this.saveName;
    link.click();
    URL.revokeObjectURL(url);
  }

  protected firstUpdated() {
    this.resizes.observe(this.content);
  }

  protected updated(_changed: PropertyValues) {
    if (this.streamFollow) {
      this.streamFollow = false;
      const pre = this.querySelector<HTMLElement>('.log-entry.stream:last-child pre');
      if (pre) {
        pre.scrollTop = pre.scrollHeight;
      }
    }
    this.scrollToEnd();
    // A new prompt takes the focus, so the answer can be typed right away.
    const prompt = this.querySelector<HTMLElement>('.import-prompt:not([data-focused])');
    if (prompt) {
      prompt.dataset.focused = '';
      // The console scrolls itself; focusing mustn't scroll the prompt to the middle.
      prompt.querySelector<HTMLElement>('input, select')?.focus({ preventScroll: true });
    }
  }

  private scrollToEnd() {
    if (this.follow) {
      this.list.scrollTop = this.list.scrollHeight;
      this.scrolledTo = this.list.scrollTop;
    }
  }

  // Follows the end only while it is in view, so that scrolling up to read stops following. The
  // event for the console's own scroll may come after the content grew, which isn't the user's.
  private onScroll() {
    const { scrollTop, scrollHeight, clientHeight } = this.list;
    if (scrollTop !== this.scrolledTo) {
      this.follow = scrollHeight - scrollTop - clientHeight < 4;
    }
  }

  protected render() {
    return html`
      <div class="panel-header">
        <span class="panel-title"><wa-icon name="terminal"></wa-icon> Console</span>
        ${this.saveHeader === undefined ? nothing : html`<wa-button size="s" appearance="plain"
          title="Save the calls and the answers to imports as a file the CLI replays"
          ?disabled=${this.log.entries.length === 0} @click=${() => this.save()}>Save</wa-button>`}
        <wa-button size="s" appearance="plain" @click=${() => this.clear()}>Clear</wa-button>
      </div>
      <div class="console" @scroll=${() => this.onScroll()}>
        <div class="console-log">
          ${this.log.entries.length === 0
            ? html`<div class="console-empty">Call a function to see results here.</div>`
            : this.log.entries.map((entry) => this.renderEntry(entry))}
        </div>
      </div>
    `;
  }

  // An import the UI called directly, e.g. a host resource's static, is the call it is under, so
  // only its prompt and detail show there.
  private renderImport(entry: ImportEntry, same = false) {
    return html`<div class="log-import ${entry.status}">
      ${same ? nothing : html`<div class="log-call">
        <span class="log-prompt">↳</span>
        <code>${entry.record.label}</code>
        ${!entry.output ? nothing : html`<span class="log-import-output">= <code>${entry.output}</code></span>`}
      </div>`}
      ${same ? nothing : renderFrames(entry.frames)}
      ${entry.note === undefined ? nothing : html`<div class="log-note">${entry.note}</div>`}
      ${entry.detail === undefined ? nothing : html`<div class="log-output"><pre>${entry.detail}</pre></div>`}
      ${entry.prompt ? this.renderPrompt(entry.prompt) : nothing}
    </div>`;
  }

  private renderPrompt(prompt: ImportPrompt) {
    // The host returns the result to the guest.
    const form: FormContext = { update: () => this.requestUpdate(), registry: prompt.registry, mock: prompt.mock, giver: 'host' };
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

  private renderEntry(entry: LogItem) {
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
    // A call of the UI's to the host may reach an import: a mock's, which asks, or the host
    // effect of one. Only its prompt and detail show; the call itself is already shown.
    const isCall = (i: ImportEntry) => isOwnCall(entry, i);
    const imports = entry.imports.filter((i) => !isCall(i) || i.prompt || i.detail !== undefined);
    const meta = waiting ? 'waiting for an import' : entry.elapsed === undefined ? entry.time : `${entry.time} · ${entry.elapsed} ms`;
    return html`<div class="log-entry ${entry.status}">
      <div class="log-call">
        <span class="log-prompt">›</span>
        <code>${entry.label}</code>
        <span class=${waiting ? 'log-meta waiting' : 'log-meta'}>${meta}</span>
      </div>
      ${imports.length > 0
        ? html`<div class="log-imports">${imports.map((i) => this.renderImport(i, isCall(i)))}</div>`
        : nothing}
      ${!entry.output
        ? nothing
        : html`<div class="log-output">
            <pre>${entry.output}</pre>
            <wa-copy-button class="log-copy" .value=${entry.output}></wa-copy-button>
          </div>`}
      ${renderFrames(entry.frames)}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'console-panel': ConsolePanel;
  }
}

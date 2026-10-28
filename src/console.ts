import { html, LitElement, nothing, PropertyValues, TemplateResult } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import { writeScript } from './answers';
import { DEFAULTS_LEVELS, DefaultsLevel } from './answering';
import { CallLog, ImportEntry, isOwnCall, LogItem, StreamEntry } from './call-log';
import { FormContext, renderField, typeName } from './form';
import { collapsedFrames } from './frames';
import { ImportPrompt, LogEntry } from './log';

// The choices of how imports are answered, as the CLI's `--defaults` levels.
const LEVELS: Array<{ level: DefaultsLevel; label: string; description: TemplateResult }> = [
  { level: 'none', label: 'Answer every result', description: html`Every mocked import with a result shows a form for it.` },
  {
    level: 'careful', label: 'Fill in obvious results',
    description: html`An import returning a <code>result</code> gets <code>ok</code>, and one returning a resource a new
      mock where nothing else could be returned; the others show a form.`,
  },
  {
    level: 'eager', label: 'Fill in, preferring new mocks',
    description: html`As above, and a new mock also where existing instances could be returned.`,
  },
];

// Where the console's choice of how imports are answered is kept.
const DEFAULTS_KEY = 'component-ui.defaults';

function storedDefaults(): DefaultsLevel {
  const level = localStorage.getItem(DEFAULTS_KEY) as DefaultsLevel | null;
  return level && DEFAULTS_LEVELS.includes(level) ? level : 'none';
}

// Marks an import that the happy path answered, or the host's own code, e.g. the user's
// JavaScript, which the console can't change, as Save writes it.
function renderDefault(entry: ImportEntry | undefined) {
  const source = entry?.answered?.by?.source;
  return source === 'default' || source === 'javascript' || source === 'wasi' ? html`<span class="log-default">// ${source}</span>` : nothing;
}

// The guest's frames of a trap, innermost first, as the CLI prints them.
function renderFrames(frames: string[]) {
  return frames.length === 0 ? nothing : html`<div class="log-frames">${collapsedFrames(frames).map((frame) => html`<div>at ${frame}</div>`)}</div>`;
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
  // Whether the preview2 shim provides WASI; the app owns it, and restarts the component with the
  // `wasi-shim` event's `detail`.
  @property({ type: Boolean }) accessor wasiShim = true;
  // How mocked imports are answered: by the user, or by the happy path where it has an answer,
  // as the CLI's `--defaults` does past its answers file. The app answers by it (see
  // `defaultsSource`), and the console prompts the user for the rest.
  @state() accessor defaults: DefaultsLevel = storedDefaults();
  @state() accessor settingsOpen = false;
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

  // Logs something the UI did that isn't a call, e.g. failing to load a file.
  public logAction(text: string): LogEntry {
    return this.log.logAction(text);
  }

  public print(stream: StreamEntry['stream'], text: string) {
    const pre = this.querySelector<HTMLElement>('.log-entry.stream:last-child pre');
    const atEnd = !pre || pre.scrollHeight - pre.scrollTop - pre.clientHeight < 4;
    // Writes that join the last stream entry follow it if it was scrolled to its end.
    this.streamFollow ||= this.log.print(stream, text) ? atEnd : true;
  }

  private setDefaults(level: DefaultsLevel) {
    this.defaults = level;
    localStorage.setItem(DEFAULTS_KEY, level);
  }

  // How imports are answered, where WASI comes from, and saving or clearing the log; saving
  // writes an answers file. Clearing restarts the component, which the app does on the `restart`
  // event, so that a saved run starts where its instance does.
  private renderSettings() {
    return html`<wa-dialog
      label="Console settings"
      class="console-settings"
      .open=${this.settingsOpen}
      @wa-after-hide=${(e: Event) => {
        if (e.target === e.currentTarget) {
          this.settingsOpen = false;
        }
      }}
    >
      <wa-radio-group label="Answering imports" class="console-defaults" .value=${this.defaults}
        @change=${(e: Event) => this.setDefaults((e.target as HTMLInputElement).value as DefaultsLevel)}>
        ${LEVELS.map(({ level, label, description }) => html`<wa-radio value=${level}>
          ${label}<div class="muted console-defaults-description">${description}</div>
        </wa-radio>`)}
      </wa-radio-group>
      <p class="muted">
        A default answer is final, as the guest goes on with it at once. It is marked <code>// default</code>,
        and Save writes it, for the CLI to replay.
      </p>
      <wa-switch class="console-wasi-shim" .checked=${live(this.wasiShim)} @change=${(e: Event) => {
        this.dispatchEvent(new CustomEvent('wasi-shim', { detail: (e.target as HTMLInputElement).checked, bubbles: true }));
      }}>
        WASI from the shim
        <div slot="hint" class="console-defaults-description">
          The preview2 shim provides WASI with real clocks and random numbers, and shows stdout and stderr.
          Its calls are logged and saved, marked <code>// wasi</code>, and the CLI's replay of a saved run gives
          the guest the same answers. Without it, WASI imports are mocked like any other. Changing it restarts the
          component.
        </div>
      </wa-switch>
      <div slot="footer" class="func-actions">
        <wa-button appearance="plain" title="Clear the logs and start a new instance of the component, so that Save writes a run from its start"
          ?disabled=${this.log.entries.length === 0} @click=${() => {
            this.dispatchEvent(new CustomEvent('restart', { bubbles: true }));
            this.settingsOpen = false;
          }}>Clear and restart</wa-button>
        ${this.saveHeader === undefined ? nothing : html`<wa-button
          title="Save the calls and the answers to imports as an answers file, which the CLI replays"
          ?disabled=${this.log.entries.length === 0} @click=${() => {
            this.save();
            this.settingsOpen = false;
          }}>
          <wa-icon slot="start" name="file-arrow-down"></wa-icon>
          Save logs
        </wa-button>`}
      </div>
    </wa-dialog>`;
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
        <span class="panel-actions">
          <wa-button size="s" appearance="plain" title="Console settings" @click=${() => (this.settingsOpen = true)}>
            <wa-icon name="gear" label="Console settings"></wa-icon>
          </wa-button>
        </span>
      </div>
      ${this.renderSettings()}
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
        ${renderDefault(entry)}
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
    // A call of the UI's to the host may reach an import: a mock's method, which prompts, or the host
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
            <pre>${entry.output}${renderDefault(entry.imports.find(isCall))}</pre>
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

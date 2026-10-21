import { html, LitElement, nothing } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { keyed } from 'lit/directives/keyed.js';
import { live } from 'lit/directives/live.js';
import { instantiate, loadComponent, LoadedComponent, readWasm } from './loader';
import { ExportsContext } from './calls';
import { ConsolePanel } from './console';
import { renderExports } from './exports-view';
import { HostResources } from './host-resources';
import { ResourceRegistry, usesResources } from './resources';
import './resource-table';

const EXAMPLES: Array<[file: string, label: string]> = [
  ['calculator.wasm', 'Calculator'],
  ['adder.wasm', 'Adder'],
  ['variants.wasm', 'Variants'],
  ['resource.wasm', 'Resource'],
  ['wasi-http.wasm', 'WASI HTTP'],
  ['printer.wasm', 'Printer'],
  ['kv-store.wasm', 'KV Store'],
];

// Prefilled implementations for the imports of the bundled examples.
const DEFAULT_IMPORT_STUBS: Record<string, string> = {
  'docs:adder/add': 'export function add(a, b) { return a + b }',
  // The host resource `Y` of the resource example.
  'imports': [
    'export class Y {',
    '  constructor(a) { this.a = a }',
    '  getA() { return this.a }',
    '  setA(a) { this.a = a }',
    '  static add(y, a) { return new Y(y.a + a) }',
    '}',
  ].join('\n'),
};

interface Session {
  id: number;
  name: string;
  component: LoadedComponent;
  // JS source for each non-WASI import, keyed by package.
  importCode: Record<string, string>;
  // Whether the exports or imports involve resources, which shows the resource table.
  hasResources: boolean;
  status: 'idle' | 'instantiating' | 'ready' | 'failed';
  // Bumped on each instantiation so the export cards start fresh.
  generation: number;
  ctx?: ExportsContext;
  error?: unknown;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isWasm(file: File): boolean {
  return file.type === 'application/wasm' || file.name.toLowerCase().endsWith('.wasm');
}

@customElement('component-app')
export class ComponentApp extends LitElement {
  @state() accessor session: Session | undefined = undefined;
  @state() accessor loading = false;
  @state() accessor loadError: { title: string; err: unknown } | undefined = undefined;
  @state() accessor dragging = false;
  @state() accessor example = '';
  @query('console-panel') accessor consolePanel!: ConsolePanel | null;
  @query('#wasmFileInput') accessor fileInput!: HTMLInputElement;
  @query('.component-pane') accessor componentPane!: HTMLElement | null;

  // Guards against a slow load finishing after a newer one has started.
  private loadCounter = 0;

  protected createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('dragover', this.onDragOver);
    document.addEventListener('dragleave', this.onDragLeave);
    document.addEventListener('drop', this.onDrop);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('dragover', this.onDragOver);
    document.removeEventListener('dragleave', this.onDragLeave);
    document.removeEventListener('drop', this.onDrop);
  }

  protected render() {
    return html`
      <header class="app-header">
        <div class="brand">
          <wa-icon name="cubes" class="brand-icon"></wa-icon>
          <span class="brand-title">Component UI</span>
          ${this.session
            ? html`<wa-tag id="componentName" size="s" variant="brand" pill>${this.session.name}</wa-tag>`
            : nothing}
        </div>
        <div class="toolbar">
          <select id="preselectedWasmFile" aria-label="Example components" @change=${this.onExample}>
            <option value="" disabled .selected=${live(this.example === '')}>Load an example…</option>
            ${EXAMPLES.map(([file, label]) =>
              html`<option value=${file} .selected=${live(this.example === file)}>${label}</option>`)}
          </select>
          <wa-button appearance="outlined" @click=${() => this.fileInput.click()}>
            <wa-icon slot="start" name="upload"></wa-icon>
            Upload .wasm
          </wa-button>
          <input type="file" id="wasmFileInput" accept=".wasm" hidden @change=${this.onFileInput} />
        </div>
      </header>
      ${this.session ? this.renderWorkspace(this.session) : this.renderWelcome()}
      <div class=${classMap({ 'drop-overlay': true, visible: this.dragging })} aria-hidden="true">
        <div class="drop-target">
          <wa-icon name="file-arrow-down"></wa-icon>
          Drop a .wasm component to load it
        </div>
      </div>
    `;
  }

  private renderWelcome() {
    return html`<main class="welcome">
      <wa-card class="welcome-card">
        <div class="welcome-body">
          <wa-icon name="file-import" class="welcome-icon"></wa-icon>
          <h2>Explore a WebAssembly component</h2>
          <p class="muted">
            Pick an example above, upload a <code>.wasm</code> component, or drop one anywhere on this page.
            Every exported function gets a form generated from its WIT signature.
          </p>
          ${this.loading ? html`<div class="loading"><wa-spinner></wa-spinner> Loading component…</div>` : nothing}
          ${this.loadError ? this.renderError(this.loadError.title, this.loadError.err) : nothing}
        </div>
      </wa-card>
    </main>`;
  }

  private renderError(title: string, err: unknown) {
    return html`<wa-callout id="loadError" variant="danger">
      <strong>${title}</strong><br />${errorMessage(err)}
    </wa-callout>`;
  }

  private renderWorkspace(s: Session) {
    return html`<wa-split-panel id="workspace" class="workspace" position="65">
      <section slot="start" class="pane component-pane">
        ${keyed(s.id, html`
          ${s.component.customImports.length > 0 ? this.renderImports(s) : nothing}
          <div class="exports">${keyed(s.generation, this.renderExportsArea(s))}</div>
        `)}
      </section>
      <aside slot="end" class="pane console-pane">
        ${s.hasResources
          ? html`<wa-split-panel orientation="vertical" position="40" class="state-split">
              <div slot="start" class="resource-pane">
                ${s.status === 'ready'
                  ? html`<resource-table .ctx=${s.ctx!}></resource-table>`
                  : html`<div class="muted placeholder">Resource instances appear here once the component is instantiated.</div>`}
              </div>
              <console-panel slot="end"></console-panel>
            </wa-split-panel>`
          : html`<console-panel></console-panel>`}
      </aside>
    </wa-split-panel>`;
  }

  // Collapsed once instantiated; expand it to change the stubs and instantiate again.
  private renderImports(s: Session) {
    const count = s.component.customImports.length;
    return html`<wa-details id="importsCard" class="imports-card" .open=${s.status !== 'ready'}>
      <div slot="summary" class="card-title">
        <span class="imports-title">
          Imports
          <wa-badge variant="neutral" appearance="filled" pill>${count} interface${count === 1 ? '' : 's'}</wa-badge>
          ${s.status === 'ready' ? html`<wa-tag size="s" variant="success">instantiated</wa-tag>` : nothing}
        </span>
        <span class="muted">Provide a JavaScript implementation for each non-WASI import.</span>
      </div>
      <div class="imports">
        ${s.component.customImports.map((pkg) => html`<wa-textarea
          class="code-editor"
          label=${pkg}
          rows="3"
          placeholder="export function name(...) { ... }"
          .spellcheck=${false}
          .value=${s.importCode[pkg]}
          @input=${(e: Event) => (s.importCode[pkg] = (e.target as HTMLTextAreaElement).value)}
        ></wa-textarea>`)}
      </div>
      <div class="func-actions">
        <wa-button
          id="instantiateButton"
          variant="brand"
          ?loading=${s.status === 'instantiating'}
          @click=${() => this.instantiate(s)}
        >
          <wa-icon slot="start" name="play"></wa-icon>
          Instantiate
        </wa-button>
      </div>
    </wa-details>`;
  }

  private renderExportsArea(s: Session) {
    switch (s.status) {
      case 'idle':
        return html`<div class="muted placeholder">
          Provide the imports above, then click Instantiate to call the exports.
        </div>`;
      case 'instantiating':
        return html`<div class="loading placeholder"><wa-spinner></wa-spinner> Instantiating…</div>`;
      case 'failed':
        return this.renderError('Instantiation failed', s.error);
      case 'ready':
        return renderExports(s.ctx!, s.component.interfaces);
    }
  }

  private async load(file: string | File, name: string) {
    const id = ++this.loadCounter;
    this.loading = true;
    this.loadError = undefined;
    try {
      const component = await loadComponent(await readWasm(file));
      if (id !== this.loadCounter) {
        return;
      }
      this.consolePanel?.clear();
      const importCode = Object.fromEntries(
        component.customImports.map((pkg) => [pkg, DEFAULT_IMPORT_STUBS[pkg] ?? '']));
      const session: Session = {
        id, name, component, importCode, hasResources: usesResources([...component.interfaces, ...component.imports]), status: 'idle', generation: 0,
      };
      this.session = session;
      if (component.customImports.length === 0) {
        this.instantiate(session);
      }
    } catch (err) {
      if (id !== this.loadCounter) {
        return;
      }
      console.error(err);
      this.session = undefined;
      this.loadError = { title: `Failed to load ${name}`, err };
    } finally {
      if (id === this.loadCounter) {
        this.loading = false;
      }
    }
  }

  private async instantiate(s: Session) {
    s.status = 'instantiating';
    this.requestUpdate();
    try {
      // Each component instance has its own resource instances, including those its imports
      // hand out while it instantiates.
      const registry = new ResourceRegistry();
      const host = new HostResources(registry, s.component.imports);
      const exports = await instantiate(s.component.transpiled, s.importCode, {
        stdout: (text) => this.consolePanel?.print('stdout', text),
        stderr: (text) => this.consolePanel?.print('stderr', text),
      }, (pkg, mod) => host.wrap(pkg, mod));
      if (s !== this.session) {
        return;
      }
      registry.addEventListener('change', () => this.requestUpdate());
      s.ctx = { exports, log: (call) => this.consolePanel!.logCall(call), registry, host };
      s.status = 'ready';
      s.generation++;
    } catch (err) {
      console.error(err);
      s.status = 'failed';
      s.error = err;
    }
    this.requestUpdate();
    if (s.status === 'ready') {
      // The imports collapse; show the beginning of the exports.
      await this.updateComplete;
      this.componentPane?.scrollTo({ top: 0 });
    }
  }

  private loadFile(file: File) {
    if (!isWasm(file)) {
      const err = new Error(`${file.name} is not a .wasm file.`);
      if (this.session) {
        this.consolePanel?.logCall(`load ${file.name}`).error(err);
      } else {
        this.loadError = { title: 'Unsupported file', err };
      }
      return;
    }
    this.example = '';
    this.load(file, file.name);
  }

  private onExample = (e: Event) => {
    const select = e.target as HTMLSelectElement;
    this.example = select.value;
    this.load(select.value, select.selectedOptions[0].text);
  };

  private onFileInput = () => {
    const file = this.fileInput.files?.[0];
    if (file) {
      this.loadFile(file);
    }
    this.fileInput.value = '';
  };

  private onDragOver = (e: DragEvent) => {
    e.preventDefault();
    this.dragging = true;
  };

  private onDragLeave = (e: DragEvent) => {
    if (!e.relatedTarget) {
      this.dragging = false;
    }
  };

  private onDrop = (e: DragEvent) => {
    e.preventDefault();
    this.dragging = false;
    const file = e.dataTransfer?.files[0];
    if (file) {
      this.loadFile(file);
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'component-app': ComponentApp;
  }
}

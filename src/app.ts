import { html, LitElement, nothing } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { keyed } from 'lit/directives/keyed.js';
import { live } from 'lit/directives/live.js';
import { instantiate, JSPI_SUPPORTED, loadComponent, LoadedComponent } from './loader';
import { browserPlatform, readWasm } from './platform-browser';
import { CallActivity, ExportsContext } from './calls';
import { ImportDialogs } from './dialog';
import { ConsolePanel } from './console';
import './console';
import { renderExports, search } from './exports-view';
import { unversioned } from './call-record';
import { byImportName, HostResources } from './host-resources';
import { importTemplate } from './import-template';
import { clashingNames, ResourceRegistry, usesResources } from './resources';
import './resource-table';

const EXAMPLES: Array<[file: string, label: string]> = [
  ['calculator.wasm', 'Calculator'],
  ['variants.wasm', 'Variants'],
  ['resource.wasm', 'Resource'],
  ['wasi-http.wasm', 'WASI HTTP'],
  ['printer.wasm', 'Printer'],
  ['kv-store.wasm', 'KV Store'],
  ['record_imports.wasm', 'Record Imports'],
];

// Example implementations of the imports of the bundled examples, to start editing from.
const EXAMPLE_IMPORT_CODE: Record<string, string> = {
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
  // JS source for each non-WASI import, keyed by package, as edited and as last applied.
  importCode: Record<string, string>;
  appliedCode: Record<string, string>;
  // The commented-out template of each import, which implements nothing.
  templates: Record<string, string>;
  // Whether the exports involve resources, which shows the resource table from the start.
  exportsResources: boolean;
  status: 'instantiating' | 'ready' | 'failed';
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
  // Whether the dialog implementing imports in JavaScript is open.
  @state() accessor editingImports = false;
  // What the exports are filtered by, and whether any of their interfaces is expanded.
  @state() accessor search = '';
  @state() accessor interfacesOpen = true;

  // Guards against a slow load finishing after a newer one has started.
  private loadCounter = 0;

  protected createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    if (!JSPI_SUPPORTED) {
      return;
    }
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
    if (!JSPI_SUPPORTED) {
      return html`<header class="app-header">${this.renderBrand()}</header>${this.renderUnsupported()}`;
    }
    return html`
      <header class="app-header">
        ${this.renderBrand()}
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

  private renderBrand() {
    return html`<div class="brand">
      <wa-icon name="cubes" class="brand-icon"></wa-icon>
      <span class="brand-title">Component UI</span>
      ${this.session
        ? html`<wa-tag id="componentName" size="s" variant="brand" pill>${this.session.name}</wa-tag>`
        : nothing}
    </div>`;
  }

  // Components wait on JSPI while the user answers for their imports.
  private renderUnsupported() {
    return html`<main class="welcome">
      <wa-card id="unsupported" class="welcome-card">
        <div class="welcome-body">
          <wa-icon name="triangle-exclamation" class="welcome-icon"></wa-icon>
          <h2>This browser isn't supported</h2>
          <p class="muted">
            Component UI needs WebAssembly JavaScript Promise Integration (JSPI), so that a component
            can wait while you answer for its imports. Open it in a browser that supports JSPI, such as
            a recent Chrome or Edge.
          </p>
        </div>
      </wa-card>
    </main>`;
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

  // The exports and the resource table side by side, above a full-width console, which also
  // asks for the results of missing imports.
  private renderWorkspace(s: Session) {
    // Shown for exports involving resources, or once the guest gets one, e.g. a stdout stream.
    // It is collapsed rather than removed, so the export cards keep their state.
    const resources = s.exportsResources || (s.ctx?.registry.rows().length ?? 0) > 0;
    return html`<wa-split-panel id="workspace" class="workspace" orientation="vertical" position="50">
      <div slot="start" class="workspace-top">
        <wa-split-panel
          class=${classMap({ 'top-split': true, 'no-resources': !resources })}
          position=${resources ? 50 : 100}
          ?disabled=${!resources}
        >
          <section slot="start" class="pane component-pane">
            ${keyed(s.id, html`
              ${s.component.customImports.length > 0 ? this.renderImports(s) : nothing}
              <div class=${classMap({ exports: true, searching: this.search.trim() !== '' })} @wa-show=${this.onToggle} @wa-hide=${this.onToggle}>
                ${this.renderExportsToolbar(s)}
                ${keyed(s.generation, this.renderExportsArea(s))}
              </div>
            `)}
          </section>
          <aside slot="end" class="pane resource-pane" ?hidden=${!resources}>
            ${s.status === 'ready'
              ? html`<resource-table .ctx=${s.ctx!} .clearSearch=${() => this.clearSearch()}></resource-table>`
              : html`<div class="muted placeholder">Resource instances appear here once the component is instantiated.</div>`}
          </aside>
        </wa-split-panel>
      </div>
      <aside slot="end" class="pane console-pane">
        <console-panel></console-panel>
      </aside>
    </wa-split-panel>`;
  }

  // Calls to imports ask in the console by default. The dialog implements them in JavaScript
  // instead, and restarts the component with them; it stays open if that fails.
  private renderImports(s: Session) {
    const pending = s.component.customImports.some((pkg) => (s.importCode[pkg] ?? '') !== (s.appliedCode[pkg] ?? ''));
    return html`<wa-dialog
      id="importsDialog"
      class="imports-dialog"
      label="Implement imports in JavaScript"
      .open=${this.editingImports}
      @wa-after-hide=${(e: Event) => {
        if (e.target === e.currentTarget) {
          this.editingImports = false;
        }
      }}
    >
      <p class="muted imports-help">
        Each interface is an ES module exporting its functions and resource classes. The functions
        you leave out ask for their results in the console.
      </p>
      ${s.status === 'failed'
        ? html`<wa-callout variant="danger"><strong>Instantiation failed</strong><br />${errorMessage(s.error)}</wa-callout>`
        : nothing}
      <div class="imports">
        ${s.component.customImports.map((pkg) => html`<wa-textarea
          class="code-editor"
          label=${pkg}
          rows=${Math.min(Math.max(s.importCode[pkg].split('\n').length, 3), 16)}
          placeholder="export function name(...) { ... }"
          .spellcheck=${false}
          .value=${s.importCode[pkg]}
          @input=${(e: Event) => {
            s.importCode[pkg] = (e.target as HTMLTextAreaElement).value;
            this.requestUpdate();
          }}
        ></wa-textarea>`)}
      </div>
      <div slot="footer" class="func-actions">
        ${pending ? html`<span class="muted imports-pending">Not applied yet</span>` : nothing}
        <wa-button
          id="applyImportsButton"
          variant="brand"
          title="Start a new instance of the component with these imports"
          ?loading=${s.status === 'instantiating'}
          @click=${() => this.instantiate(s)}
        >
          <wa-icon slot="start" name="rotate-right"></wa-icon>
          Apply and restart
        </wa-button>
      </div>
    </wa-dialog>`;
  }

  private renderExportsArea(s: Session) {
    switch (s.status) {
      case 'instantiating':
        return html`<div class="loading placeholder"><wa-spinner></wa-spinner> Instantiating…</div>`;
      case 'failed':
        return this.renderError('Instantiation failed', s.error);
      case 'ready':
        return renderExports(s.ctx!, s.component.interfaces, search(this.search));
    }
  }

  // Searching and collapsing need the exports; the imports can be edited, e.g. to fix them, once
  // instantiation failed too.
  private renderExportsToolbar(s: Session) {
    const ready = s.status === 'ready';
    return html`<div class="exports-toolbar">
      <wa-input
        size="s"
        ?disabled=${!ready}
        placeholder="Search functions"
        aria-label="Search functions"
        with-clear
        .value=${live(this.search)}
        @input=${(e: Event) => this.onSearch((e.target as HTMLInputElement).value)}
      >
        <wa-icon slot="start" name="magnifying-glass"></wa-icon>
      </wa-input>
      <wa-button size="s" appearance="outlined" ?disabled=${!ready} @click=${() => this.toggleInterfaces()}>
        <wa-icon slot="start" name=${this.interfacesOpen ? 'angles-up' : 'angles-down'}></wa-icon>
        ${this.interfacesOpen ? 'Collapse all' : 'Expand all'}
      </wa-button>
      ${s.component.customImports.length > 0 ? this.renderStubButton(s) : nothing}
    </div>`;
  }

  // Calls to imports ask in the console unless implemented in JavaScript, which the badge counts.
  private renderStubButton(s: Session) {
    const count = s.component.customImports.length;
    const implemented = Object.entries(s.appliedCode).filter(([pkg, code]) => code.trim() !== '' && code !== s.templates[pkg]).length;
    const title = `Implement the ${count} imported interface${count === 1 ? '' : 's'} in JavaScript; `
      + `the functions you leave out ask for their results in the console`
      + (implemented > 0 ? ` (${implemented} in JavaScript)` : '');
    return html`<wa-button id="editImportsButton" size="s" appearance="outlined" title=${title} @click=${() => (this.editingImports = true)}>
      <wa-icon slot="start" name="code"></wa-icon>
      JS Stub
      ${implemented > 0 ? html`<wa-badge class="implemented" variant="brand" pill>${implemented}</wa-badge>` : nothing}
    </wa-button>`;
  }

  private interfaceSections() {
    return [...(this.componentPane?.querySelectorAll('wa-details.interface') ?? [])] as Array<HTMLElement & { open: boolean }>;
  }

  private toggleInterfaces() {
    const open = !this.interfacesOpen;
    this.interfaceSections().forEach((d) => (d.open = open));
    this.interfacesOpen = open;
  }

  // Follows the interfaces opened or closed one at a time. The events come from the resource
  // sections and the selects of the cards as well, which don't change it.
  private onToggle = () => {
    this.interfacesOpen = this.interfaceSections().some((d) => d.open);
  };

  // Expands the sections with matches, e.g. collapsed resources.
  private async onSearch(text: string) {
    this.search = text;
    await this.updateComplete;
    this.openMatches();
  }

  private clearSearch() {
    this.search = '';
    return this.updateComplete;
  }

  private openMatches() {
    if (this.search.trim() === '') {
      return;
    }
    this.componentPane?.querySelectorAll<HTMLElement & { open: boolean }>('.exports wa-details:has(func-card:not([hidden]))').forEach((d) => (d.open = true));
  }

  private async load(file: string | File, name: string) {
    const id = ++this.loadCounter;
    this.loading = true;
    this.loadError = undefined;
    try {
      const component = await loadComponent(browserPlatform, await readWasm(file));
      if (id !== this.loadCounter) {
        return;
      }
      this.consolePanel?.clear();
      this.search = '';
      // The editors start with the example code, or a commented-out template, but the component
      // starts without any, so calling an import asks in the console.
      const ifaces = byImportName(component.imports);
      const templates = Object.fromEntries(component.customImports.map((pkg) => [pkg, importTemplate(ifaces.get(unversioned(pkg)) ?? [])]));
      const importCode = Object.fromEntries(component.customImports.map((pkg) => [pkg, EXAMPLE_IMPORT_CODE[pkg] ?? templates[pkg]]));
      const session: Session = {
        id, name, component, importCode, appliedCode: {}, templates, exportsResources: usesResources(component.interfaces),
        status: 'instantiating', generation: 0,
      };
      this.session = session;
      this.editingImports = false;
      this.instantiate(session, templates);
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

  // Starts a new instance of the component with `code` implementing its imports.
  private async instantiate(s: Session, code = s.importCode) {
    s.status = 'instantiating';
    this.requestUpdate();
    try {
      // Each component instance has its own resource instances, including those its imports
      // hand out while it instantiates.
      const registry = new ResourceRegistry(clashingNames(s.component.imports, s.component.interfaces));
      const host = new HostResources(registry, s.component.imports);
      // Missing imports and mock resources ask in the console, and the guest waits for the answer.
      const dialogs = new ImportDialogs(registry, host, s.component.imports, (call) => this.consolePanel!.logImport(call));
      s.appliedCode = { ...code };
      const exports = await instantiate(browserPlatform, s.component.transpiled, s.appliedCode, {
        stdout: (text) => this.consolePanel?.print('stdout', text),
        stderr: (text) => this.consolePanel?.print('stderr', text),
      }, {
        complete: (pkg, mod, wasi) => dialogs.complete(pkg, mod, wasi),
        wrap: (pkg, mod) => host.wrap(pkg, mod),
      });
      if (s !== this.session) {
        return;
      }
      registry.addEventListener('change', () => this.requestUpdate());
      const activity = new CallActivity();
      s.ctx = { exports, log: (call) => this.consolePanel!.logCall(call), registry, host, activity, mocks: dialogs };
      s.status = 'ready';
      s.generation++;
      this.interfacesOpen = true;
    } catch (err) {
      console.error(err);
      s.status = 'failed';
      s.error = err;
    }
    this.requestUpdate();
    if (s.status === 'ready') {
      // Applied imports close the dialog; show the beginning of the exports.
      this.editingImports = false;
      await this.updateComplete;
      this.openMatches();
      this.componentPane?.scrollTo({ top: 0 });
    }
  }

  private loadFile(file: File) {
    if (!isWasm(file)) {
      const err = new Error(`${file.name} is not a .wasm file.`);
      if (this.session) {
        this.consolePanel?.logAction(`load ${file.name}`).error(err);
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

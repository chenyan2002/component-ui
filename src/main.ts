import './components';
import './style.css';
import { instantiate, loadComponent, LoadedComponent, readWasm } from './loader';
import { ConsolePanel } from './console';
import { renderExports } from './exports-view';
import { el } from './dom';

// Prefilled implementations for the imports of the bundled examples.
const DEFAULT_IMPORT_STUBS: Record<string, string> = {
  'docs:adder/add': 'export function add(a, b) { return a + b }',
};

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const ui = {
  selector: byId<HTMLSelectElement>('preselectedWasmFile'),
  uploadButton: byId<HTMLElementTagNameMap['wa-button']>('uploadButton'),
  fileInput: byId<HTMLInputElement>('wasmFileInput'),
  componentName: byId<HTMLElementTagNameMap['wa-tag']>('componentName'),
  welcome: byId('welcome'),
  loading: byId('loading'),
  loadError: byId('loadError'),
  workspace: byId<HTMLElementTagNameMap['wa-split-panel']>('workspace'),
  importsCard: byId('importsCard'),
  imports: byId('imports'),
  instantiateButton: byId<HTMLElementTagNameMap['wa-button']>('instantiateButton'),
  exports: byId('exports'),
  clearConsole: byId('clearConsole'),
};
const consolePanel = new ConsolePanel(byId('console'));

interface Session {
  component: LoadedComponent;
  importEditors: Record<string, HTMLElementTagNameMap['wa-textarea']>;
}
let session: Session | undefined;
// Guards against a slow load finishing after a newer one has started.
let loadCounter = 0;

function followColorScheme() {
  const dark = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = () => document.documentElement.classList.toggle('wa-dark', dark.matches);
  dark.addEventListener('change', apply);
  apply();
}

function showMessage(message: string) {
  ui.exports.replaceChildren(el('div', { className: 'muted placeholder' }, message));
}

function showError(target: HTMLElement, title: string, err: unknown) {
  console.error(err);
  target.replaceChildren(el('wa-callout', { variant: 'danger' },
    el('strong', {}, title), el('br'), err instanceof Error ? err.message : String(err)));
}

async function processWasm(file: string | File, name: string) {
  const id = ++loadCounter;
  ui.loading.hidden = false;
  ui.loadError.hidden = true;
  try {
    const component = await loadComponent(await readWasm(file));
    if (id === loadCounter) {
      openSession(component, name);
    }
  } catch (err) {
    if (id === loadCounter) {
      session = undefined;
      ui.workspace.hidden = true;
      ui.welcome.hidden = false;
      ui.componentName.hidden = true;
      ui.loadError.hidden = false;
      showError(ui.loadError, `Failed to load ${name}`, err);
    }
  } finally {
    if (id === loadCounter) {
      ui.loading.hidden = true;
    }
  }
}

function openSession(component: LoadedComponent, name: string) {
  session = { component, importEditors: {} };
  ui.componentName.textContent = name;
  ui.componentName.hidden = false;
  ui.welcome.hidden = true;
  if (ui.workspace.hidden) {
    ui.workspace.hidden = false;
    // The split panel measures itself, so position it only once it is visible.
    ui.workspace.position = 65;
  }
  consolePanel.clear();

  ui.imports.replaceChildren();
  for (const pkg of component.customImports) {
    const editor = el('wa-textarea', {
      label: pkg,
      value: DEFAULT_IMPORT_STUBS[pkg] ?? '',
      placeholder: 'export function name(...) { ... }',
      rows: 3,
      spellcheck: false,
      className: 'code-editor',
    });
    session.importEditors[pkg] = editor;
    ui.imports.append(editor);
  }
  ui.importsCard.hidden = component.customImports.length === 0;

  if (component.customImports.length === 0) {
    instantiateSession();
  } else {
    showMessage('Provide the imports above, then click Instantiate to call the exports.');
  }
}

async function instantiateSession() {
  const current = session;
  if (!current) {
    return;
  }
  const code = Object.fromEntries(
    Object.entries(current.importEditors).map(([pkg, editor]) => [pkg, editor.value ?? '']));
  ui.instantiateButton.loading = true;
  try {
    const exports = await instantiate(current.component.transpiled, code);
    if (current !== session) {
      return;
    }
    // Instances from a previous instantiation belong to a different component instance.
    current.component.interfaces.forEach((iface) => iface.get_resources().forEach((r) => r.clear_instances()));
    renderExports(ui.exports, { exports, console: consolePanel }, current.component.interfaces);
  } catch (err) {
    showError(ui.exports, 'Instantiation failed', err);
  } finally {
    ui.instantiateButton.loading = false;
  }
}

function isWasm(file: File): boolean {
  return file.type === 'application/wasm' || file.name.toLowerCase().endsWith('.wasm');
}

function loadFile(file: File) {
  if (!isWasm(file)) {
    const err = new Error(`${file.name} is not a .wasm file.`);
    if (ui.workspace.hidden) {
      ui.loadError.hidden = false;
      showError(ui.loadError, 'Unsupported file', err);
    } else {
      consolePanel.logCall(`load ${file.name}`).error(err);
    }
    return;
  }
  ui.selector.value = '';
  processWasm(file, file.name);
}

function init() {
  followColorScheme();

  ui.selector.addEventListener('change', () => {
    processWasm(ui.selector.value, ui.selector.selectedOptions[0].text);
  });
  ui.uploadButton.addEventListener('click', () => ui.fileInput.click());
  ui.fileInput.addEventListener('change', () => {
    const file = ui.fileInput.files?.[0];
    if (file) {
      loadFile(file);
    }
    ui.fileInput.value = '';
  });
  ui.instantiateButton.addEventListener('click', instantiateSession);
  ui.clearConsole.addEventListener('click', () => consolePanel.clear());

  const setDragging = (on: boolean) => document.body.classList.toggle('dragging', on);
  document.addEventListener('dragover', (event) => {
    event.preventDefault();
    setDragging(true);
  });
  document.addEventListener('dragleave', (event) => {
    if (!event.relatedTarget) {
      setDragging(false);
    }
  });
  document.addEventListener('drop', (event) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer?.files[0];
    if (file) {
      loadFile(file);
    }
  });
}

init();

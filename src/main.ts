import './style.css'
import { generate, Transpiled } from '@bytecodealliance/jco/component';
import { renderInput, InputBox } from './ui';
import * as WIT from './wit';
import { generateAst } from './obj/bindgen';
interface ResourceHook {
  resource: WIT.ResourceClass;
  container: HTMLElement;
  instance?: string;
}

let IDL: Array<WIT.InterfaceClass> = [];
async function loadComponent(component: Uint8Array) {
  const name = 'test';
  const output = await generate(component, {
    name,
    noNodejsCompat: true,
    noTypescript: true,
    base64Cutoff: 1000000,
    instantiation: { tag: 'async' },
    map: [
      ['wasi:cli/*', '@bytecodealliance/preview2-shim/cli#*'],
      ['wasi:clocks/*', '@bytecodealliance/preview2-shim/clocks#*'],
      ['wasi:filesystem/*', '@bytecodealliance/preview2-shim/filesystem#*'],
      ['wasi:http/*', '@bytecodealliance/preview2-shim/http#*'],
      ['wasi:io/*', '@bytecodealliance/preview2-shim/io#*'],
      ['wasi:random/*', '@bytecodealliance/preview2-shim/random#*'],
      ['wasi:sockets/*', '@bytecodealliance/preview2-shim/sockets#*']
    ],
  });
  console.log(output);
  const binding = generateAst(component);
  console.log(binding);
  const url = URL.createObjectURL(new Blob([binding], { type: 'text/javascript' }));
  const mod = await import(/* @vite-ignore */url);
  IDL = mod.Factory({IDL: WIT});
  return output;
}
const customImportCode: Record<string, HTMLTextAreaElement> = {};
let instantiated: any;
async function instantiate(transpiled: Transpiled) {
  const imports: Record<string, any> = {
    "@bytecodealliance/preview2-shim/cli": await import('@bytecodealliance/preview2-shim/cli'),
    "@bytecodealliance/preview2-shim/filesystem": await import('@bytecodealliance/preview2-shim/filesystem'),
    "@bytecodealliance/preview2-shim/io": await import('@bytecodealliance/preview2-shim/io'),
    "@bytecodealliance/preview2-shim/random": await import('@bytecodealliance/preview2-shim/random'),
    "@bytecodealliance/preview2-shim/sockets": await import('@bytecodealliance/preview2-shim/sockets'),
    "@bytecodealliance/preview2-shim/http": await import('@bytecodealliance/preview2-shim/http'),
    "@bytecodealliance/preview2-shim/clocks": await import('@bytecodealliance/preview2-shim/clocks'),
  };
  for (const pkg of transpiled.imports) {
    if (!pkg.startsWith('@bytecodealliance/preview2-shim/')) {
      const code = customImportCode[pkg];
      const src = URL.createObjectURL(new Blob([code.value], { type: 'text/javascript' }));
      const mod = await import(/* @vite-ignore */ src);
      imports[pkg] = mod;
    }
  }
  const source = transpiled.files.find(([file, _]) => file === 'test.js')![1];
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  const { instantiate } = await import(/* @vite-ignore */url);
  let mod = await instantiate(core => {
    const file = transpiled.files.find((f) => f[0] === core)![1];
    const mod = WebAssembly.compile(file);
    return mod;
  }, imports);
  console.log(mod);
  instantiated = mod;
}

async function fetchWasm(file: string | File): Promise<Uint8Array> {
  if (file instanceof File) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target && event.target.result) {
          resolve(new Uint8Array(event.target.result as ArrayBuffer));
        } else {
          reject(new Error("Failed to read file."));
        }
      };
      reader.onerror = (error) => {
        reject(error);
      };
      reader.readAsArrayBuffer(file);
    });
  } else {
    const url = new URL(import.meta.env.BASE_URL + file, window.location.origin);
    return new Uint8Array(await(await fetch(url)).arrayBuffer());
  }
}
async function processWasm(file: string | File) {
  const wasm = await fetchWasm(file);
  const transpiled = await loadComponent(wasm);
  initUIAfterLoad(transpiled);
}
function init() {
  const selector = document.querySelector<HTMLSelectElement>('#preselectedWasmFile')!;
  selector.addEventListener('change', async (event) => {
    const target = event.target as HTMLSelectElement;
    processWasm(target.value);
  });
  const fileInput = document.getElementById('wasmFileInput') as HTMLInputElement;
  fileInput.addEventListener('change', async (event) => {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      const file = target.files[0];
      processWasm(file);
    }
  });
  // Add drag-and-drop event listeners
  document.addEventListener('dragover', (event) => {
    event.preventDefault();
  });
  document.addEventListener('drop', async (event) => {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type === 'application/wasm') {
        processWasm(file);
      } else {
        console.error('Please drop a valid .wasm file.');
      }
    }
  });
}
function renderExports() {
  const exports = document.getElementById('exports') as HTMLElement;
  exports.innerHTML = '';
  for (const iface of IDL) {
    const iface_name = iface._name;
    const header = document.createElement('div');
    header.innerHTML = `Interface ${iface_name}`;
    exports.appendChild(header);
    // render resources
    for (const resource of iface._resources) {
      const item = document.createElement('li');
      exports.appendChild(item);
      item.innerHTML = `<div>Resource ${resource._name}</div>`;
      const ul = document.createElement('ul');
      item.appendChild(ul);
      const hooks: ResourceHook = { resource, container: ul };
      for (const [name, func] of resource.get_static_funcs()) {
        const li = document.createElement('li');
        ul.appendChild(li);
        renderFunc(li, iface_name, name, func, hooks);
      }
    }
    // render functions
    for (const [name, func] of Object.entries(iface._fields)) {
      const item = document.createElement('li');
      exports.appendChild(item);
      renderFunc(item, iface_name, name, func);
    }
  }
}
function renderAndStoreResourceInstance(hook: ResourceHook, obj: any) {
  const { resource, container } = hook;
  const instance = resource.add_instance(obj);
  const item = document.createElement('li');
  container.appendChild(item);
  item.innerHTML = `<div>Instance ${instance}</div>`;
  const ul = document.createElement('ul');
  item.appendChild(ul);
  for (const [name, func] of resource.get_method_funcs()) {
    const li = document.createElement('li');
    ul.appendChild(li);
    renderFunc(li, 'UNNAMED', name, func, { instance, ...hook });
  }
}
function renderFunc(item: HTMLElement, iface_name: string, name: string, func: WIT.FuncClass, resource_hook?: ResourceHook) {
  item.innerHTML = `<div class="signature">
  ${name}: func(${func._args.map((a) => `${a[0]}: ${a[1].name}`).join(', ')})` +
  (func._ret.length === 0 ? '' : ` -> ${func._ret.map((a) => a.name).join(', ')}`) +
  `</div>`;
  // input arguments UI
  const inputContainer = document.createElement('div');
  inputContainer.className = 'input-container';
  item.appendChild(inputContainer);
  const inputs: InputBox[] = [];
  func._args.forEach(([name, arg]) => {
  const inputbox = renderInput(arg);
  inputbox.label = `${name} `;
  inputs.push(inputbox);
  inputbox.render(inputContainer);
  });
  // Call button
  const buttonContainer = document.createElement('div');
  const buttonCall = document.createElement('button');
  buttonCall.innerText = 'Call';
  buttonContainer.appendChild(buttonCall);
  item.appendChild(buttonContainer);
  buttonCall.addEventListener('click', async () => {
    const args = inputs.map((arg) => arg.parse());
    const isRejected = inputs.some((arg) => arg.isRejected());
    if (isRejected) {
      return;
    }
    await callAndRender(iface_name, name, args, func._kind, resource_hook);
  });
  if (func._args.length > 0) {
    const buttonRandom = document.createElement('button');
    buttonRandom.innerText = 'Random';
    buttonContainer.appendChild(buttonRandom);
    buttonRandom.addEventListener('click', async () => {
      const args = inputs.map((arg) => arg.parse({ random: true }));
      const isRejected = inputs.some((arg) => arg.isRejected());
      if (isRejected) {
       return;
      }
      await callAndRender(iface_name, name, args, func._kind, resource_hook);
    });
  }
}
async function callAndRender(iface_name: string, method:string, args: any[], kind: string, resource_hook?: ResourceHook) {
  const logs = document.getElementById('logs') as HTMLElement;
  let mod = instantiated;
  if (iface_name !== 'UNNAMED') {
    mod = instantiated[iface_name];
  }
  const args_string = args.map((s) => customStringify(s)).join(', ');
  try {
    let result: any;
    if (kind.endsWith('constructor')) {
      const resource_name = resource_hook!.resource._name;
      logs.innerHTML += `<div>› new ${resource_name}(${args_string})</div>`;
      result = new mod[resource_name!](...args);
      renderAndStoreResourceInstance(resource_hook!, result);
    } else if (kind.endsWith('static')) {
      const resource_name = resource_hook!.resource._name;
      logs.innerHTML += `<div>› ${resource_name}.${method}(${args_string})</div>`;
      result = mod[resource_name!][method](...args);
    } else if (kind.endsWith('method')) {
      const { resource, instance } = resource_hook!;
      mod = resource.instances[instance!];
      logs.innerHTML += `<div>› ${instance}.${method}(${args_string})</div>`;
      result = mod[method](...args);
    } else {
      logs.innerHTML += `<div>› ${method}(${args_string})</div>`;
      result = await mod[method](...args);
    }
    logs.innerHTML += `<div>${customStringify(result)}</div>`;
  } catch (err) {
    logs.innerHTML += `<div class="error">${(err as Error).message}</div>`;
    console.error(err);
  }
}
function initUIAfterLoad(transpiled: Transpiled) {
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.innerHTML = `
  <div id="imports"></div>
  <div><button id="instantiate">Instantiate</button></div>
  <div id="container">
   <div id="main-content">
    <ul id="exports"></ul>
   </div>
   <div id="logs"></div>
  </div>
  `;
  const imports = document.getElementById('imports') as HTMLElement;
  const button = document.getElementById('instantiate') as HTMLButtonElement;
  for (const pkg of transpiled.imports) {
    const block = document.createElement('div');
    imports.appendChild(block);
    if (!pkg.startsWith('@bytecodealliance/preview2-shim/')) {
      block.innerHTML = `<li>Provide import ${pkg}</li>`;
      const code = document.createElement('textarea');
      code.style.width = '28em';
      code.style.height = '3em';
      if (pkg === 'docs:adder/add') {
        code.value = `export function add(a, b) { return a + b }`;
      }
      customImportCode[pkg] = code;
      block.appendChild(code);
    }
  }
  button.onclick = async () => {
    await instantiate(transpiled);
    renderExports();
  };
}
function customStringify(obj: any): string {
  const json = JSON.stringify(obj, (key, value) => {
    if (typeof value === 'function' || typeof value === 'bigint' || typeof value === 'symbol') {
      return value.toString();
    }
    if (value instanceof Uint8Array) {
      return Array.from(value);
    }
    return value;
  }, 2);
  if (json === '{}' && obj.constructor && obj.constructor.name) {
    return `[object ${obj.constructor.name}]`;
  }
  return json;
}

init();

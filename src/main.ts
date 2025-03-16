import './style.css'
import { generate, Transpiled } from '@bytecodealliance/jco/component';
import { renderInput, InputBox } from './ui';
import * as WIT from './wit';
import { generateAst } from './obj/bindgen';

let IDL: any;
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
  IDL = await import(/* @vite-ignore */url);
  IDL = IDL.Factory({IDL: WIT});
  return output;
}
const customImportCode: Record<string, HTMLTextAreaElement> = {};
let instantiated: any;
async function instantiate(transpiled: Transpiled) {
  const imports: Record<string, any> = {
    "@bytecodealliance/preview2-shim/cli": await import('@bytecodealliance/preview2-shim/cli'),
    "@bytecodealliance/preview2-shim/filesystem": await import('@bytecodealliance/preview2-shim/filesystem'),
    "@bytecodealliance/preview2-shim/io": await import('@bytecodealliance/preview2-shim/io'),    
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
  let mod = await instantiate((core, imports) => {
    const file = transpiled.files.find((f) => f[0] === core)![1];
    const mod = WebAssembly.compile(file);
    //console.log(`compiled ${core} (imports ${imports})`);
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
}
function renderExports() {
  const exports = document.getElementById('exports') as HTMLElement;
  const iface_name = IDL._name;
  exports.innerHTML = `Interface <div>${IDL._name}</div>`;
  for (const [name, func] of Object.entries(IDL._fields)) {
    const item = document.createElement('li');
    exports.appendChild(item);
    item.innerHTML = `<li>${name}: (${func._args.map((a) => a[1].name).join(', ')}) -> (${func._ret.map((a) => a.name).join(', ')})</li>`;
    // input arguments UI
    const inputContainer = document.createElement('div');
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
    const buttonRandom = document.createElement('button');
    buttonRandom.innerText = 'Random';
    buttonContainer.appendChild(buttonRandom);
    item.appendChild(buttonContainer);
    buttonCall.addEventListener('click', async () => {
      const args = inputs.map((arg) => arg.parse());
      const isRejected = inputs.some((arg) => arg.isRejected());
      if (isRejected) {
        return;
      }
      await callAndRender(iface_name, name, args);
    });
    buttonRandom.addEventListener('click', async () => {
      const args = inputs.map((arg) => arg.parse({ random: true }));
      const isRejected = inputs.some((arg) => arg.isRejected());
      if (isRejected) {
        return;
      }
      await callAndRender(iface_name, name, args);
    });
  }
}
async function callAndRender(iface_name: string, method:string, args: any[]) {
  const logs = document.getElementById('logs') as HTMLElement;
  logs.innerHTML += `<div>${method}(${args.join(', ')})</div>`;
  const result = await instantiated[iface_name][method](...args);
  logs.innerHTML += `<div>Result: ${result}</div>`;
}
function initUIAfterLoad(transpiled: Transpiled) {
  const app = document.querySelector<HTMLDivElement>('#app')!;
  app.innerHTML = `
  <div id="imports" class="frame"><p>This component imports the following interfaces</p></div>
  <div><button id="instantiate">Instantiate</button></div>
  <div>
   <ul id="exports"></ul>
  </div>
  <div id="logs"></div>
  `;
  const imports = document.getElementById('imports') as HTMLElement;
  const button = document.getElementById('instantiate') as HTMLButtonElement;
  /*for (const pkg of transpiled.exports) {
    const div = document.createElement('div');
    exports.appendChild(div);
    div.innerHTML = `<li>${pkg}</li>`;
  }*/
  for (const pkg of transpiled.imports) {
    const block = document.createElement('div');
    imports.appendChild(block);
    if (pkg.startsWith('@bytecodealliance/preview2-shim/')) {
      block.innerHTML = `<li>${pkg} ✅</li>`;
    } else {
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

init();

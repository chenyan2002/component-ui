import './style.css'
import { transpile } from '@bytecodealliance/jco';

async function loadComponent(component: Uint8Array) {
  const name = 'test';
  const map = [
    ['wasi:cli/*', '@bytecodealliance/preview2-shim/cli#*'],
    ['wasi:clocks/*', '@bytecodealliance/preview2-shim/clocks#*'],
    ['wasi:filesystem/*', '@bytecodealliance/preview2-shim/filesystem#*'],
    ['wasi:http/*', '@bytecodealliance/preview2-shim/http#*'],
    ['wasi:io/*', '@bytecodealliance/preview2-shim/io#*'],
    ['wasi:random/*', '@bytecodealliance/preview2-shim/random#*'],
    ['wasi:sockets/*', '@bytecodealliance/preview2-shim/sockets#*']
  ];
  const output = await transpile(component, {
    name,
    noNodejsCompat: true,
    noTypescript: true,
    base64Cutoff: 1000000,
    instantiation: { tag: 'async' },
    map,
  });
  console.log(output);
  return output;
}
async function instantiate(transpiled) {
  const imports = {
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
  const source = transpiled.files.find(([file, _]) => file === 'test.js')[1];
  const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  const { instantiate } = await import(/* @vite-ignore */url);
  let mod = await instantiate((core, imports) => {
    const file = transpiled.files.find((f) => f[0] === core)[1];
    const mod = WebAssembly.compile(file);
    //console.log(`compiled ${core} (imports ${imports})`);
    return mod;
  }, imports);
  console.log(mod);
  const res = mod.calculate.evalExpression('add', 1, 2);
  console.log(res);
  logs.innerHTML = `<div>Calling calculate.evalExpression('add', 1, 2)</div><div>Result: ${res}</div>`;
}

async function fetchWasm(): Promise<Uint8Array> {
  const url = new URL('calculator.wasm', window.location.origin);
  return new Uint8Array(await(await fetch(url)).arrayBuffer());
}

const app = document.querySelector<HTMLDivElement>('#app')!;
const customImportCode = {};
const exports = document.createElement('div');
exports.className = 'frame';
exports.innerHTML = '<p>This component exports the following interfaces</p>';
app.appendChild(exports);
const imports = document.createElement('div');
imports.className = 'frame';
imports.innerHTML = '<p>This component imports the following interfaces</p>';
app.appendChild(imports);
const button = document.createElement('button');
button.innerText = 'Instantiate';
app.appendChild(button);
const logs = document.createElement('div');
app.appendChild(logs);

(async () => {
  const wasm = await fetchWasm();
  const transpiled = await loadComponent(wasm);
  for (const pkg of transpiled.exports) { 
    const div = document.createElement('div');
    exports.appendChild(div);
    div.innerHTML = `<li>${pkg}</li>`;
  }
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
  };
})();

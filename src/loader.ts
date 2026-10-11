import { generate, Transpiled } from '@bytecodealliance/jco/component';
import * as WIT from './wit';
import { generateAst } from './obj/bindgen';

const SHIM_PREFIX = '@bytecodealliance/preview2-shim/';
// Each WASI package is mapped by jco to the matching preview2-shim module.
const WASI_SHIMS: Record<string, () => Promise<unknown>> = {
  cli: () => import('@bytecodealliance/preview2-shim/cli'),
  clocks: () => import('@bytecodealliance/preview2-shim/clocks'),
  filesystem: () => import('@bytecodealliance/preview2-shim/filesystem'),
  http: () => import('@bytecodealliance/preview2-shim/http'),
  io: () => import('@bytecodealliance/preview2-shim/io'),
  random: () => import('@bytecodealliance/preview2-shim/random'),
  sockets: () => import('@bytecodealliance/preview2-shim/sockets'),
};
const TRANSPILED_NAME = 'component';

export interface LoadedComponent {
  transpiled: Transpiled;
  interfaces: WIT.InterfaceClass[];
  // Imports that are not WASI and must be provided as JS source by the user.
  customImports: string[];
}

export async function importFromSource(code: BlobPart): Promise<any> {
  const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  try {
    return await import(/* @vite-ignore */ url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function readWasm(file: string | File): Promise<Uint8Array> {
  if (file instanceof File) {
    return new Uint8Array(await file.arrayBuffer());
  }
  const url = new URL(import.meta.env.BASE_URL + file, window.location.origin);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${file}: ${response.status} ${response.statusText}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

export async function loadComponent(component: Uint8Array): Promise<LoadedComponent> {
  const transpiled = await generate(component, {
    name: TRANSPILED_NAME,
    noNodejsCompat: true,
    noTypescript: true,
    base64Cutoff: 1000000,
    instantiation: { tag: 'async' },
    map: Object.keys(WASI_SHIMS).map((pkg) => [`wasi:${pkg}/*`, `${SHIM_PREFIX}${pkg}#*`]),
  });
  const binding = await importFromSource(generateAst(component));
  const interfaces: WIT.InterfaceClass[] = binding.Factory({ IDL: WIT });
  const customImports = transpiled.imports.filter((pkg) => !pkg.startsWith(SHIM_PREFIX));
  return { transpiled, interfaces, customImports };
}

export async function instantiate(transpiled: Transpiled, customImportCode: Record<string, string>): Promise<any> {
  const imports: Record<string, unknown> = {};
  for (const [pkg, load] of Object.entries(WASI_SHIMS)) {
    imports[`${SHIM_PREFIX}${pkg}`] = await load();
  }
  for (const pkg of transpiled.imports) {
    if (!pkg.startsWith(SHIM_PREFIX)) {
      imports[pkg] = await importFromSource(customImportCode[pkg] ?? '');
    }
  }
  const source = transpiled.files.find(([file]) => file === `${TRANSPILED_NAME}.js`)![1];
  const mod = await importFromSource(source);
  return mod.instantiate((core: string) => {
    const [_, file] = transpiled.files.find(([name]) => name === core)!;
    return WebAssembly.compile(file);
  }, imports);
}

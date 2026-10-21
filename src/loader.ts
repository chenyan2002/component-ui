import { generate } from '@bytecodealliance/jco/component';
import { filesystem, sockets } from '@bytecodealliance/preview2-shim';
import { WASIShim } from '@bytecodealliance/preview2-shim/instantiation';
import * as WIT from './wit';
import { generateAst } from './obj/bindgen';

export type Transpiled = Awaited<ReturnType<typeof generate>>;

// jco types its output files as possibly SharedArrayBuffer-backed, but they are plain ArrayBuffers.
function fileBytes(transpiled: Transpiled, name: string): Uint8Array<ArrayBuffer> {
  const [_, bytes] = transpiled.files.find(([file]) => file === name)!;
  return bytes as Uint8Array<ArrayBuffer>;
}

const TRANSPILED_NAME = 'component';

// Interfaces implemented by the preview2 shim, keyed like jco's import specifiers (`wasi:cli/stdout`).
const WASI_INTERFACES = new Set(Object.keys(new WASIShim().getImportObject()));

// `wasi:cli/stdout@0.2.3` → `wasi:cli/stdout`.
function unversioned(specifier: string): string {
  return specifier.replace(/@[^/]*$/, '');
}

export interface LoadedComponent {
  transpiled: Transpiled;
  interfaces: WIT.InterfaceClass[];
  // The imported interfaces, named like jco's import specifiers, possibly with a version.
  imports: WIT.InterfaceClass[];
  // Imports the WASI shim doesn't provide; the user supplies them as JS source.
  customImports: string[];
}

// Receives the text the component writes to stdout and stderr, as it is written.
export interface ComponentOutput {
  stdout(text: string): void;
  stderr(text: string): void;
}

// An output stream handler that decodes UTF-8, keeping multi-byte characters split across writes intact.
function textStream(onText: (text: string) => void) {
  const decoder = new TextDecoder();
  const emit = (text: string) => {
    if (text) {
      onText(text);
    }
  };
  const flush = () => emit(decoder.decode());
  return {
    write: (contents: Uint8Array) => emit(decoder.decode(contents, { stream: true })),
    flush,
    blockingFlush: flush,
  };
}

// The WASI imports for one component instance, with the shim's opt-in capabilities enabled.
function wasiImports(output: ComponentOutput): Record<string, unknown> {
  return new WASIShim({
    stdout: textStream(output.stdout),
    stderr: textStream(output.stderr),
    // An ephemeral filesystem with an empty root directory.
    browserFilesystem: {
      adapter: new filesystem.InMemoryFilesystemAdapter(),
      preopens: { '/': { dir: {} } },
    },
    // Browsers have no raw sockets; these only connect endpoints within this page.
    tcpSockets: new sockets.InMemoryTcpSockets(),
    udpSockets: new sockets.InMemoryUdpSockets(),
  }).getImportObject();
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
  });
  const binding = await importFromSource(generateAst(component));
  const { exports: interfaces, imports }: Record<'exports' | 'imports', WIT.InterfaceClass[]> = binding.Factory({ IDL: WIT });
  const customImports = transpiled.imports.filter((pkg) => !WASI_INTERFACES.has(unversioned(pkg)));
  return { transpiled, interfaces, imports, customImports };
}

// jco checks at instantiation that every imported function exists. Stub the ones the user
// didn't provide, so the component still instantiates and only fails if it calls them.
function stubMissingImports(pkg: string, mod: object): object {
  return new Proxy(mod, {
    get(target, key, receiver) {
      // `then` is excluded so the module isn't mistaken for a promise.
      if (typeof key !== 'string' || key === 'then' || key in target) {
        return Reflect.get(target, key, receiver);
      }
      // A plain function, so it also works where a resource class is expected.
      return function missingImport() {
        throw new Error(`Import ${pkg}#${key} is not implemented. Provide it in the Imports card.`);
      };
    },
  });
}

export async function instantiate(
  transpiled: Transpiled,
  customImportCode: Record<string, string>,
  output: ComponentOutput,
  // Wraps the import object for `pkg`, e.g. to observe the resources it hands out.
  wrapImport: (pkg: string, mod: object) => object = (_pkg, mod) => mod,
): Promise<any> {
  const wasi = wasiImports(output);
  const imports: Record<string, unknown> = {};
  for (const pkg of transpiled.imports) {
    const mod = WASI_INTERFACES.has(unversioned(pkg))
      ? wasi[unversioned(pkg)] as object
      : stubMissingImports(pkg, await importFromSource(customImportCode[pkg] ?? ''));
    imports[pkg] = wrapImport(pkg, mod);
  }
  const mod = await importFromSource(fileBytes(transpiled, `${TRANSPILED_NAME}.js`));
  return mod.instantiate((core: string) => WebAssembly.compile(fileBytes(transpiled, core)), imports);
}

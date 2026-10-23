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

function isWasi(pkg: string): boolean {
  return WASI_INTERFACES.has(unversioned(pkg));
}

// JS Promise Integration lets an import return a promise that the guest waits for, e.g. while
// the user answers the prompt of a missing import. The app requires it.
export const JSPI_SUPPORTED = typeof (WebAssembly as any).Suspending === 'function' && typeof (WebAssembly as any).promising === 'function';

// jco refers to functions as `iface#name`, or `name` at the root, e.g. `wasi:io/poll#[method]pollable.block`.
function jcoNames(iface: WIT.InterfaceClass, include: (func: WIT.FuncClass) => boolean = () => true): string[] {
  const resourceFuncs = iface.get_resources().flatMap((resource) => Object.values(resource._fields));
  return [...Object.values(iface._fields), ...resourceFuncs]
    .filter(include)
    .map((func) => (iface.isRoot ? func._witName : `${iface._name}#${func._witName}`));
}

// Any import may wait for the user: missing ones ask for their results, and so do the methods
// of mock host resources, which the UI can hand to exports. The exports that can call them
// must be async too. jco emits invalid async code for resource constructors and statics, so
// those stay synchronous.
function asyncMode(exports: WIT.InterfaceClass[], imports: WIT.InterfaceClass[]) {
  return {
    tag: 'jspi' as const,
    val: {
      imports: imports.flatMap((iface) => jcoNames(iface)),
      exports: exports.flatMap((iface) => jcoNames(iface, (func) => func.callKind === 'func' || func.callKind === 'method')),
    },
  };
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

// jco's async (JSPI) import trampolines answer a failed import with a promise that never
// settles, leaving the guest suspended forever; its sync ones rethrow, as these now do.
function rethrowAsyncImportErrors(transpiled: Transpiled) {
  const file = transpiled.files.find(([name]) => name === `${TRANSPILED_NAME}.js`)!;
  const js = new TextDecoder().decode(file[1]);
  const failed = /(markTrapped\(err\);\s*task\.setErrored\(err\);\s*task\.reject\(err\);\s*task\.exit\(\);\s*)return task\.completionPromise\(\);/g;
  file[1] = new TextEncoder().encode(js.replace(failed, '$1throw err;'));
}

export async function loadComponent(component: Uint8Array): Promise<LoadedComponent> {
  const binding = await importFromSource(generateAst(component));
  const { exports: interfaces, imports }: Record<'exports' | 'imports', WIT.InterfaceClass[]> = binding.Factory({ IDL: WIT });
  const transpiled = await generate(component, {
    name: TRANSPILED_NAME,
    noNodejsCompat: true,
    noTypescript: true,
    base64Cutoff: 1000000,
    instantiation: { tag: 'async' },
    asyncMode: asyncMode(interfaces, imports),
  });
  rethrowAsyncImportErrors(transpiled);
  const customImports = transpiled.imports.filter((pkg) => !isWasi(pkg));
  return { transpiled, interfaces, imports, customImports };
}

// jco checks at instantiation that every imported function exists. Stub the ones the user
// didn't provide, so the component still instantiates and only fails if it calls them.
export function stubMissingImports(pkg: string, mod: object): object {
  return new Proxy(mod, {
    get(target, key, receiver) {
      // `then` is excluded so the module isn't mistaken for a promise.
      if (typeof key !== 'string' || key === 'then' || key in target) {
        return Reflect.get(target, key, receiver);
      }
      // A plain function, so it also works where a resource class is expected.
      return function missingImport() {
        throw new Error(`Import ${pkg}.${WIT.kebabName(key)} is not implemented. Implement it in JavaScript from the Imports bar.`);
      };
    },
  });
}

export interface ImportHooks {
  // Completes the module for `pkg`: the user's, or for `wasi` the shim's.
  complete(pkg: string, mod: object, wasi: boolean): object;
  // Wraps the import object for `pkg`, e.g. to observe the resources it hands out.
  wrap(pkg: string, mod: object): object;
}

export async function instantiate(
  transpiled: Transpiled,
  customImportCode: Record<string, string>,
  output: ComponentOutput,
  { complete, wrap }: ImportHooks,
): Promise<any> {
  const wasi = wasiImports(output);
  const imports: Record<string, unknown> = {};
  for (const pkg of transpiled.imports) {
    const mod = isWasi(pkg)
      ? complete(pkg, wasi[unversioned(pkg)] as object, true)
      : complete(pkg, await importFromSource(customImportCode[pkg] ?? ''), false);
    imports[pkg] = wrap(pkg, mod);
  }
  const mod = await importFromSource(fileBytes(transpiled, `${TRANSPILED_NAME}.js`));
  return mod.instantiate((core: string) => WebAssembly.compile(fileBytes(transpiled, core)), imports);
}

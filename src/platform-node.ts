import { mkdtempSync, rmSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Platform } from './platform';

// Node runs the core with the same WASI as the browser: the browser build of
// `@bytecodealliance/preview2-shim`, whose in-memory filesystem and sockets, output callbacks
// and per-instance state suit a debugger. Its Node build exits the process on `wasi:cli/exit`,
// shares the host's environment and writes straight to stdout. Bundles for Node must resolve
// the shim to its browser build; see `scripts/build-node.mjs`. The guest's imports wait
// on prompts with JSPI, which Node 23 enables with `--experimental-wasm-jspi`.

let moduleDir: string | undefined;
let moduleCount = 0;

// Node can't import `blob:` URLs, and `data:` URLs would put the whole module into the stack
// traces of errors it throws. Modules are written to a temporary directory instead.
function nextModulePath(): string {
  if (!moduleDir) {
    const dir = mkdtempSync(join(tmpdir(), 'component-ui-'));
    process.on('exit', () => rmSync(dir, { recursive: true, force: true }));
    moduleDir = dir;
  }
  return join(moduleDir, `module-${++moduleCount}.mjs`);
}

export const nodePlatform: Platform = {
  async importModule(code) {
    const path = nextModulePath();
    await writeFile(path, code);
    try {
      return await import(pathToFileURL(path).href);
    } finally {
      // Once imported, the module no longer needs its file.
      await rm(path, { force: true });
    }
  },
};

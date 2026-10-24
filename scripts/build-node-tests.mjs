// Bundles tests/node for Node into tests/node/.build. Run by `npm run test:node`.
import * as esbuild from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outdir = resolve(root, 'tests/node/.build');

await esbuild.build({
  absWorkingDir: root,
  entryPoints: ['tests/node/*.test.ts'],
  outdir,
  outExtension: { '.js': '.mjs' },
  bundle: true,
  format: 'esm',
  target: 'node22',
  // Not `node`, which would resolve `@bytecodealliance/preview2-shim` to its Node build: the
  // core uses its browser build everywhere (see src/platform-node.ts).
  platform: 'neutral',
  conditions: ['browser'],
  mainFields: ['module', 'main'],
  // jco reads its own Wasm files from next to its modules, so it stays in node_modules.
  external: ['node:*', '@bytecodealliance/jco', '@bytecodealliance/jco/*'],
});

// src/obj/bindgen.js loads its core module from next to itself, which is now the bundle.
await mkdir(outdir, { recursive: true });
await copyFile(resolve(root, 'src/obj/bindgen.core.wasm'), resolve(outdir, 'bindgen.core.wasm'));

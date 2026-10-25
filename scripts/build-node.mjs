// Bundles the core for Node: the CLI into dist-cli, and tests/node into tests/node/.build.
// Run by `npm run build:cli` and `npm run test:node`; `node scripts/build-node.mjs [cli] [tests]`.
import * as esbuild from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const options = {
  absWorkingDir: root,
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
};

// src/obj/bindgen.js loads its core module from next to itself, which is now the bundle.
async function copyBindgen(outdir) {
  await mkdir(outdir, { recursive: true });
  await copyFile(resolve(root, 'src/obj/bindgen.core.wasm'), resolve(outdir, 'bindgen.core.wasm'));
}

const targets = {
  async cli() {
    const outdir = resolve(root, 'dist-cli');
    await esbuild.build({
      ...options,
      entryPoints: ['src/cli.ts'],
      outfile: resolve(outdir, 'component-ui.mjs'),
      banner: { js: '#!/usr/bin/env node' },
    });
    await copyBindgen(outdir);
  },
  async tests() {
    const outdir = resolve(root, 'tests/node/.build');
    await esbuild.build({ ...options, entryPoints: ['tests/node/*.test.ts'], outdir, outExtension: { '.js': '.mjs' } });
    await copyBindgen(outdir);
  },
};

const names = process.argv.slice(2);
for (const name of names.length > 0 ? names : Object.keys(targets)) {
  if (!targets[name]) {
    throw new Error(`Unknown target ${name}; expected ${Object.keys(targets).join(' or ')}`);
  }
  await targets[name]();
}

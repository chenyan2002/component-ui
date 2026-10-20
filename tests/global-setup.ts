import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

export const PRINTER_DIR = path.join(import.meta.dirname, 'fixtures', 'printer');
export const PRINTER_WASM = path.join(PRINTER_DIR, 'printer.wasm');

// Builds the printer fixture with componentize-js unless it is up to date.
export default function globalSetup() {
  const sources = ['printer.js', 'printer.wit'].map((file) => path.join(PRINTER_DIR, file));
  const builtAt = existsSync(PRINTER_WASM) ? statSync(PRINTER_WASM).mtimeMs : 0;
  if (sources.every((source) => statSync(source).mtimeMs < builtAt)) {
    return;
  }
  const jco = path.join(import.meta.dirname, '..', 'node_modules', '.bin', 'jco');
  execFileSync(jco, ['componentize', 'printer.js', '--wit', 'printer.wit', '-o', 'printer.wasm'], {
    cwd: PRINTER_DIR,
    stdio: 'inherit',
  });
}

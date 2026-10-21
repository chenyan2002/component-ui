import path from 'node:path';
import { expect, test } from '@playwright/test';
import {
  answerImport, applyImports, arg, call, callEntries, callEntry, expectCall, funcCard, importPrompt, loadExample, resource, row,
  streamEntries,
} from './helpers';

const PUBLIC_DIR = path.join(import.meta.dirname, '..', '..', 'public');

test('shows the welcome screen before a component is loaded', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Explore a WebAssembly component' })).toBeVisible();
  await expect(page.locator('#workspace')).toHaveCount(0);
});

test.describe('dark mode', () => {
  test.use({ colorScheme: 'dark' });

  test('follows the system color scheme', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('html')).toHaveClass(/\bwa-dark\b/);
  });
});

test('a browser without JSPI gets a message instead of the app', async ({ page }) => {
  await page.addInitScript(() => {
    delete (WebAssembly as any).Suspending;
  });
  await page.goto('./');
  await expect(page.locator('#unsupported')).toContainText("This browser isn't supported");
  await expect(page.locator('#preselectedWasmFile')).toHaveCount(0);
});

test('calculator: imports are answered in the console, or implemented in JavaScript', async ({ page }) => {
  // It instantiates right away; the imports card is collapsed.
  await loadExample(page, 'calculator.wasm');
  const imports = page.locator('#importsCard');
  await expect(imports).not.toHaveAttribute('open');
  await expect(imports.locator('.imports-title wa-tag')).toHaveCount(0);
  const add = async () => {
    const card = funcCard(page, 'evalExpression');
    await arg(card, 0).locator('select').selectOption('add');
    await arg(card, 1).locator('input').fill('2');
    await arg(card, 2).locator('input').fill('3');
    await call(card);
  };
  await add();
  await answerImport(page, 'docs:adder/add#add(2, 3)', (prompt) => prompt.locator('input').fill('5'));
  await expectCall(page, 'evalExpression("add", 2, 3)', 'ok', '5');

  // Expanding the card shows example code, which takes effect once applied.
  await imports.locator('.card-title').click();
  const stub = imports.locator('wa-textarea[label="docs:adder/add"]');
  await expect(stub).toHaveJSProperty('value', 'export function add(a, b) { return a + b }');
  await expect(imports.locator('.imports-pending')).toHaveText('Not applied yet');
  await imports.locator('#applyImportsButton').click();
  await expect(imports).not.toHaveAttribute('open');
  await expect(imports.locator('.imports-title wa-tag')).toHaveText('1 in JavaScript');
  await expect(imports.locator('.imports-pending')).toHaveCount(0);
  await add();
  await expect(callEntries(page).last().locator('.log-import')).toHaveCount(0);
  await expectCall(page, 'evalExpression("add", 2, 3)', 'ok', '5');
  // Nothing involves resources, so the resource table stays collapsed.
  await expect(page.locator('.resource-pane')).toBeHidden();
});

test('kv-store: instantiates with its Fastly imports answered in the console', async ({ page }) => {
  await loadExample(page, 'kv-store.wasm');
  await expect(page.locator('#importsCard .imports-title wa-badge')).toHaveText('21 interfaces');
  await expect(funcCard(page, 'run')).toBeInViewport();
  await expect(page.locator('wa-details.resource', { hasText: 'Request' })).not.toHaveAttribute('open');
  await expect(page.locator('.section-summary code', { hasText: 'fastly:compute/http-incoming@0.1.0' })).toBeVisible();
  // `body` is `pollable` renamed by a `use` in http-body, then used again by http-incoming.
  await expect(arg(funcCard(page, 'handle'), 1).locator('.field-type')).toHaveText('own<Pollable>');
  // Every card renders its signature; a type that failed to resolve leaves one blank.
  const cards = page.locator('func-card');
  await expect(cards.locator('.sig-name')).toHaveCount(await cards.count());
});

test('kv-store: host resources created in the UI are passed to handle', async ({ page }) => {
  await loadExample(page, 'kv-store.wasm');
  await applyImports(page, {
    'fastly:compute/http-req': [
      'export class Request {',
      "  #method = 'GET';",
      '  static new() { return new Request() }',
      '  getMethod() { return this.#method }',
      '  setMethod(method) { this.#method = method }',
      '}',
    ].join('\n'),
    'fastly:compute/async-io': 'export class Pollable { static newReady() { return new Pollable() } }',
  });

  // `Request` and `Pollable` (as `body`) are imported, so their functions run on the stubs.
  const request = resource(page, 'Request');
  await expect(request.locator('.section-summary wa-tag')).toHaveText('host resource');
  await request.locator('.section-summary').click();
  await call(funcCard(request, 'new'));
  await expectCall(page, 'Request.new()', 'ok', 'request_host0');
  await expect(row(page, 'request_host0').locator('td.handle')).toHaveText('host');
  await expect(row(page, 'request_host0').locator('.instance-holders')).toHaveText('held by you');
  const pollable = resource(page, 'Pollable');
  await pollable.locator('.section-summary').click();
  await call(funcCard(pollable, 'newReady'));
  await expectCall(page, 'Pollable.newReady()', 'ok', 'pollable_host1');

  const setMethod = funcCard(request, 'setMethod');
  await arg(setMethod, 0).locator('select').selectOption('request_host0');
  await arg(setMethod, 1).locator('input').fill('POST');
  await call(setMethod);
  const getMethod = funcCard(request, 'getMethod');
  await arg(getMethod, 0).locator('select').selectOption('request_host0');
  await arg(getMethod, 1).locator('input').fill('10');
  await call(getMethod);
  await expectCall(page, 'request_host0.getMethod("10")', 'ok', '"POST"');

  // The guest accepts them; imports the stubs leave out ask for their results.
  const handle = funcCard(page, 'handle');
  await arg(handle, 0).locator('select').selectOption('request_host0');
  await arg(handle, 1).locator('select').selectOption('pollable_host1');
  await call(handle);
  await answerImport(page, 'fastly:private/privileged-kv-store-service#get()', async (prompt) => {
    await prompt.locator('select').first().selectOption('ok');
    await prompt.locator('select').nth(1).selectOption({ label: 'New mock Service' });
  });
  await expect(row(page, 'service_host2').locator('.instance-type')).toHaveText('Service · mock');
  // The guest goes on to the next import; failing it fails the call.
  await expect(importPrompt(page)).toBeVisible();
  await importPrompt(page).locator('wa-button', { hasText: 'Trap' }).click();
  await expectCall(page, 'handle(request_host0, pollable_host1)', 'error', /^Trapped at /);
});

test('adder: rejects invalid numbers without calling', async ({ page }) => {
  await loadExample(page, 'adder.wasm');
  const card = funcCard(page, 'add');
  await arg(card, 0).locator('input').fill('abc');
  await arg(card, 1).locator('input').fill('4294967296');
  await call(card);
  await expect(card.locator('.field-error')).toHaveText([
    'Expected an integer, got "abc"',
    'Out of range for u32: [0, 4294967295]',
  ]);
  await expect(callEntries(page)).toHaveCount(0);

  await arg(card, 0).locator('input').fill('40');
  await arg(card, 1).locator('input').fill('2');
  await call(card);
  await expectCall(page, 'add(40, 2)', 'ok', '42');
});

test('adder: Random fills empty fields and keeps typed ones', async ({ page }) => {
  await loadExample(page, 'adder.wasm');
  const card = funcCard(page, 'add');
  await arg(card, 0).locator('input').fill('5');
  await call(card, 'Random');
  await call(card, 'Random');
  await expect(callEntries(page)).toHaveCount(2);
  await expect(callEntries(page).locator('.log-call code')).toHaveText([/^add\(5, \d+\)$/, /^add\(5, \d+\)$/]);
  // The generated value is shown in the form, marked as generated.
  await expect(arg(card, 1).locator('input')).toHaveClass(/\bauto\b/);
  await expect(arg(card, 1).locator('input')).not.toHaveValue('');
});

test.describe('variants', () => {
  test.beforeEach(async ({ page }) => {
    await loadExample(page, 'variants.wasm');
  });

  test('requires selecting a case', async ({ page }) => {
    const card = funcCard(page, 'roundtripEnum');
    await call(card);
    await expect(card.locator('.field-error')).toHaveText('Select a case');
    await expect(callEntries(page)).toHaveCount(0);

    await arg(card, 0).locator('select').selectOption('b');
    await call(card);
    await expectCall(page, 'roundtripEnum("b")', 'ok', '"b"');
  });

  test('Random builds valid nested values', async ({ page }) => {
    const funcs = ['invertBool', 'roundtripOption', 'variantCasts', 'variantZeros', 'variantTypedefs'];
    for (const name of funcs) {
      await call(funcCard(page, name), 'Random');
    }
    await expect(callEntries(page)).toHaveCount(funcs.length);
    for (const entry of await callEntries(page).all()) {
      await expect(entry).toHaveClass(/\bok\b/);
    }
  });

  test('an unimplemented import asks for its result only when called', async ({ page }) => {
    await call(funcCard(page, 'testImports'));
    const entry = callEntry(page, 'testImports()');
    await expect(entry.locator('.log-meta')).toHaveText('waiting for an import');
    await expect(entry.locator('.log-import').last().locator('.log-call code').first()).toHaveText(/^test:variants\/test#\w+\(/);
    await importPrompt(page).locator('wa-button', { hasText: 'Trap' }).click();
    await expectCall(page, 'testImports()', 'error', /^Trapped at test:variants\/test#\w+\(/);
  });

  test('a trap shows the stderr output and disables the instance', async ({ page }) => {
    // The test component asserts on its arguments; these values trap.
    const card = funcCard(page, 'variantEnums');
    await arg(card, 1).locator('select').selectOption('ok');
    await arg(card, 2).locator('select').selectOption('a');
    await call(card);
    await expectCall(page, 'variantEnums(false, { "tag": "ok", "val": null }, "a")', 'error', /^wasm trap/);
    await expect(streamEntries(page, 'stderr').last()).toContainText('Assertion failed');

    await call(funcCard(page, 'invertBool'));
    await expectCall(page, 'invertBool(false)', 'error', /cannot enter component instance/);
  });
});

test('wasi-http: renders the handler and its resources', async ({ page }) => {
  await loadExample(page, 'wasi-http.wasm');
  const methodTag = page.locator('.func-header wa-tag', { hasText: 'method' });
  await expect(page.locator('func-card').filter({ hasNot: methodTag })).toHaveCount(2);
  await expect(funcCard(page, 'handle')).toBeVisible();
  // Methods take the instance as `self`: a live one, or a new mock of the host resource.
  await expect(arg(funcCard(page, 'pathWithQuery'), 0).locator('option:not([disabled])')).toHaveText(['New mock IncomingRequest']);
  await expect(page.locator('.section-summary code', { hasText: 'ResponseOutparam' })).toBeVisible();
});

test('loading: upload, switching components and rejecting other files', async ({ page }) => {
  await page.goto('./');
  await page.locator('#wasmFileInput').setInputFiles(path.join(PUBLIC_DIR, 'adder.wasm'));
  await expect(page.locator('#componentName')).toHaveText('adder.wasm');
  await call(funcCard(page, 'add'), 'Random');
  await expect(callEntries(page)).toHaveCount(1);

  // Switching components replaces the workspace and clears the console.
  await page.locator('#preselectedWasmFile').selectOption('calculator.wasm');
  await expect(page.locator('#componentName')).toHaveText('Calculator');
  await expect(page.locator('#importsCard')).toBeVisible();
  await expect(callEntries(page)).toHaveCount(0);

  await page.locator('#wasmFileInput').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') });
  await expectCall(page, 'load notes.txt', 'error', 'notes.txt is not a .wasm file.');
  await expect(callEntry(page, 'load notes.txt')).toHaveCount(1);
});

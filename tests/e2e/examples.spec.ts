import path from 'node:path';
import { expect, test } from '@playwright/test';
import {
  answerImport, applyImports, arg, call, callEntries, callEntry, choices, choose, expectCall, funcCard, importPrompt, loadExample,
  openImports, picker, resource, row,
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
  // It instantiates right away, with no imports in JavaScript yet.
  await loadExample(page, 'calculator.wasm');
  const implemented = page.locator('#editImportsButton wa-badge.implemented');
  await expect(page.locator('#importsDialog')).not.toHaveAttribute('open');
  await expect(implemented).toHaveCount(0);
  const add = async () => {
    const card = funcCard(page, 'eval-expression');
    await choose(picker(arg(card, 0)), 'add');
    await arg(card, 1).locator('input').fill('2');
    await arg(card, 2).locator('input').fill('3');
    await call(card);
  };
  await add();
  await answerImport(page, 'docs:adder/add@0.1.0.add(2, 3)', (prompt) => prompt.locator('input').fill('5'));
  await expectCall(page, 'docs:calculator/calculate@0.1.0.eval-expression(add, 2, 3)', 'ok', '5');

  // The dialog shows example code, which takes effect once applied.
  const dialog = await openImports(page);
  const stub = dialog.locator('wa-textarea[label="docs:adder/add"]');
  await expect(stub).toHaveJSProperty('value', 'export function add(a, b) { return a + b }');
  await expect(dialog.locator('.imports-pending')).toHaveText('Not applied yet');
  await dialog.locator('#applyImportsButton').click();
  await expect(dialog).not.toHaveAttribute('open');
  await expect(implemented).toHaveText('1');
  await expect(dialog.locator('.imports-pending')).toHaveCount(0);
  await add();
  // The JavaScript answers the import, which the console shows as its answer, as Save records it.
  const js = callEntries(page).last().locator('.log-import');
  await expect(js.locator('.log-call > code')).toHaveText('docs:adder/add@0.1.0.add(2, 3)');
  await expect(js.locator('.log-import-output')).toHaveText('= 5');
  await expect(js.locator('.log-default')).toHaveText('// javascript');
  await expectCall(page, 'docs:calculator/calculate@0.1.0.eval-expression(add, 2, 3)', 'ok', '5');
  // Nothing involves resources, so the resource table stays collapsed.
  await expect(page.locator('.resource-pane')).toBeHidden();
});

test('calculator: imports that fail to apply keep the dialog open, with the error', async ({ page }) => {
  await loadExample(page, 'calculator.wasm');
  const dialog = await openImports(page);
  const stub = dialog.locator('wa-textarea[label="docs:adder/add"] textarea');
  await stub.fill('export function add(a, b) {');
  await dialog.locator('#applyImportsButton').click();
  await expect(dialog.locator('wa-callout[variant="danger"]')).toContainText('Instantiation failed');
  await expect(dialog).toHaveAttribute('open');
  // Fixing the code and applying again closes it.
  await stub.fill('export function add(a, b) { return a + b }');
  await dialog.locator('#applyImportsButton').click();
  await expect(dialog).not.toHaveAttribute('open');
  await expect(funcCard(page, 'eval-expression')).toBeVisible();
});

test('kv-store: instantiates with its Fastly imports answered in the console', async ({ page }) => {
  await loadExample(page, 'kv-store.wasm');
  await expect(page.locator('#editImportsButton')).toHaveAttribute('title', /^Implement the 21 imported interfaces /);
  // The exports start in view, with the host resources they use.
  await expect(page.locator('wa-details.interface').first()).toBeInViewport();
  await expect(page.locator('wa-details.resource', { hasText: 'request' })).not.toHaveAttribute('open');
  await expect(page.locator('.section-summary code', { hasText: 'fastly:compute/http-incoming@0.1.0' })).toBeVisible();
  // `body` is `pollable` renamed by a `use` in http-body, then used again by http-incoming.
  await expect(arg(funcCard(page, 'handle'), 1).locator('.field-type')).toHaveText('pollable');
  // Every card renders its signature; a type that failed to resolve leaves one blank.
  const cards = page.locator('func-card');
  await expect(cards.locator('.sig-name')).toHaveCount(await cards.count());
});

test('record-imports: instantiates with the Fastly interfaces it wraps', async ({ page }) => {
  await loadExample(page, 'record_imports.wasm');
  await expect(page.locator('#editImportsButton')).toHaveAttribute('title', /^Implement the 7 imported interfaces /);
  await expect(page.locator('.section-summary code', { hasText: 'wrapped-fastly:compute/http-req@0.1.0' })).toBeVisible();
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

  // `Request` and `Pollable` (as `body`) are imported, so their functions run on the stubs. They
  // show together, each named with the interface that defines it.
  // They show first, collapsed. Names too long to fit show in full on hover.
  const hostResources = page.locator('wa-details.interface').first();
  await expect(hostResources.locator(':scope > .section-summary code')).toHaveText('host resources');
  await expect(hostResources).not.toHaveAttribute('open');
  await hostResources.locator(':scope > .section-summary').click();
  await expect(hostResources.locator('wa-details.resource .section-summary code'))
    .toHaveText(['fastly:compute/async-io/pollable@0.1.0', 'fastly:compute/http-req/request@0.1.0']);
  await expect(hostResources.locator('wa-details.resource .section-summary code').first())
    .toHaveAttribute('title', 'fastly:compute/async-io/pollable@0.1.0');
  const request = resource(page, 'fastly:compute/http-req/request@0.1.0');
  // The card says they are the host's, so each is tagged just as a resource.
  await expect(request.locator('.section-summary wa-tag')).toHaveText('resource');
  await request.locator('.section-summary').click();
  await call(funcCard(request, 'new'));
  // The stub's JavaScript answers the call, which the console marks.
  await expectCall(page, 'fastly:compute/http-req/request@0.1.0.new()', 'ok', 'ok(#request-1)// javascript');
  await expect(row(page, 'request-1').locator('td.handle')).toHaveText('host');
  await expect(row(page, 'request-1').locator('.instance-holders')).toHaveText('held by you');
  const pollable = resource(page, 'fastly:compute/async-io/pollable@0.1.0');
  await pollable.locator('.section-summary').click();
  await call(funcCard(pollable, 'new-ready'));
  await expectCall(page, 'fastly:compute/async-io/pollable@0.1.0.new-ready()', 'ok', '#pollable-2// javascript');

  const setMethod = funcCard(request, 'set-method');
  await choose(picker(arg(setMethod, 0)), 'request-1');
  await arg(setMethod, 1).locator('input').fill('POST');
  await call(setMethod);
  const getMethod = funcCard(request, 'get-method');
  await choose(picker(arg(getMethod, 0)), 'request-1');
  await arg(getMethod, 1).locator('input').fill('10');
  await call(getMethod);
  // A `u64` is a `bigint`, shown as a number.
  await expectCall(page, 'fastly:compute/http-req/request@0.1.0.get-method(#borrow-request-1, 10)', 'ok', 'ok("POST")// javascript');

  // The guest accepts them; imports the stubs leave out are mocked.
  const handle = funcCard(page, 'handle');
  await choose(picker(arg(handle, 0)), 'request-1');
  await choose(picker(arg(handle, 1)), 'pollable-2');
  await call(handle);
  await answerImport(page, 'fastly:private/privileged-kv-store-service.get()', async (prompt) => {
    await choose(picker(prompt), 'ok');
    await choose(picker(prompt, 1), { label: 'New mock service' });
  });
  await expect(row(page, 'service-3').locator('.instance-type')).toHaveText('service · mock');
  // The guest goes on to the next import; failing it fails the call.
  await expect(importPrompt(page)).toBeVisible();
  await importPrompt(page).locator('wa-button', { hasText: 'Trap' }).click();
  await expectCall(page, 'fastly:compute/http-incoming@0.1.0.handle(#request-1, #pollable-2)', 'error', /^Trapped at /);
});

test('kv-store: a host resource function the UI calls prompts in the call entry, not again under it', async ({ page }) => {
  await loadExample(page, 'kv-store.wasm');
  const hostResources = page.locator('wa-details.interface').first();
  await hostResources.locator(':scope > .section-summary').click();
  const pollable = resource(page, 'fastly:compute/async-io/pollable@0.1.0');
  await pollable.locator('.section-summary').click();
  // Without a stub for `Pollable`, `new-ready` is mocked.
  await call(funcCard(pollable, 'new-ready'));
  const entry = callEntry(page, 'fastly:compute/async-io/pollable@0.1.0.new-ready()');
  await expect(entry.locator('.import-prompt')).toBeVisible();
  await expect(entry.locator('.log-call')).toHaveCount(1);
  await entry.locator('.import-prompt wa-button', { hasText: 'Return' }).click();
  await expectCall(page, 'fastly:compute/async-io/pollable@0.1.0.new-ready()', 'ok', '#pollable-1');
  await expect(entry.locator('.log-import')).toHaveCount(0);
});

test('calculator: rejects invalid numbers without calling', async ({ page }) => {
  await loadExample(page, 'calculator.wasm');
  const card = funcCard(page, 'eval-expression');
  await choose(picker(arg(card, 0)), 'add');
  await arg(card, 1).locator('input').fill('1.5');
  await arg(card, 2).locator('input').fill('4294967296');
  await call(card);
  await expect(card.locator('.field-error')).toHaveText([
    'Expected an integer, got "1.5"',
    'Out of range for u32: [0, 4294967295]',
  ]);
  await expect(callEntries(page)).toHaveCount(0);

  await arg(card, 1).locator('input').fill('40');
  await arg(card, 2).locator('input').fill('2');
  await call(card);
  await answerImport(page, 'docs:adder/add@0.1.0.add(40, 2)', (prompt) => prompt.locator('input').fill('42'));
  await expectCall(page, 'docs:calculator/calculate@0.1.0.eval-expression(add, 40, 2)', 'ok', '42');
});

test('calculator: Random fills empty fields and keeps typed ones', async ({ page }) => {
  await loadExample(page, 'calculator.wasm');
  const card = funcCard(page, 'eval-expression');
  await arg(card, 1).locator('input').fill('5');
  for (let i = 0; i < 2; i++) {
    await call(card, 'Random');
    await answerImport(page, (await page.locator('.log-import').last().locator('.log-call code').first().textContent())!,
      (prompt) => prompt.locator('wa-button', { hasText: 'Random' }).click());
  }
  await expect(callEntries(page)).toHaveCount(2);
  await expect(callEntries(page).locator(':scope > .log-call code'))
    .toHaveText([/^docs:calculator\/calculate@0\.1\.0\.eval-expression\(add, 5, \d+\)$/, /^docs:calculator\/calculate@0\.1\.0\.eval-expression\(add, 5, \d+\)$/]);
  // The generated values are shown in the form, marked as generated.
  await expect(arg(card, 2).locator('wa-number-input')).toHaveClass(/\bauto\b/);
  await expect(arg(card, 2).locator('input')).not.toHaveValue('');
});

test.describe('variants', () => {
  test.beforeEach(async ({ page }) => {
    await loadExample(page, 'variants.wasm');
  });

  test('requires selecting a case', async ({ page }) => {
    const card = funcCard(page, 'roundtrip-enum');
    await call(card);
    await expect(card.locator('.field-error')).toHaveText('Select a case');
    await expect(callEntries(page)).toHaveCount(0);

    await choose(picker(arg(card, 0)), 'b');
    await call(card);
    await expectCall(page, 'test:variants/test.roundtrip-enum(b)', 'ok', 'b');
  });

  test('Random builds valid nested values', async ({ page }) => {
    const funcs = ['invert-bool', 'roundtrip-option', 'variant-casts', 'variant-zeros', 'variant-typedefs'];
    for (const name of funcs) {
      await call(funcCard(page, name), 'Random');
    }
    await expect(callEntries(page)).toHaveCount(funcs.length);
    for (const entry of await callEntries(page).all()) {
      await expect(entry).toHaveClass(/\bok\b/);
    }
  });

  test('an unimplemented import prompts for its result only when called', async ({ page }) => {
    await call(funcCard(page, 'test-imports'));
    const entry = callEntry(page, 'test-imports()');
    await expect(entry.locator('.log-meta')).toHaveText('waiting for an import');
    await expect(entry.locator('.log-import').last().locator('.log-call code').first()).toHaveText(/^test:variants\/test\.[\w-]+\(/);
    await importPrompt(page).locator('wa-button', { hasText: 'Trap' }).click();
    await expectCall(page, 'test-imports()', 'error', /^Trapped at test:variants\/test\.[\w-]+\(/);
  });

  test('a trap shows the stderr output and disables the instance', async ({ page }) => {
    // The test component asserts on its arguments; these values trap.
    const card = funcCard(page, 'variant-enums');
    await choose(picker(arg(card, 1)), 'ok');
    await choose(picker(arg(card, 2)), 'a');
    await call(card);
    await expectCall(page, 'test:variants/test.variant-enums(false, ok, a)', 'error', /^wasm trap/);
    await expect(streamEntries(page, 'stderr').last()).toContainText('Assertion failed');
    // The guest's frames, without those of its runtime, e.g. `abort`.
    const frames = callEntry(page, 'test:variants/test.variant-enums(false, ok, a)').locator('.log-frames');
    await expect(frames).toContainText('at exports_test_variants_test_variant_enums');
    await expect(frames).not.toContainText('abort');

    await call(funcCard(page, 'invert-bool'));
    await expectCall(page, 'test:variants/test.invert-bool(false)', 'error', /cannot enter component instance/);
  });
});

test('wasi-http: renders the handler and its resources', async ({ page }) => {
  await loadExample(page, 'wasi-http.wasm');
  const methodTag = page.locator('.func-header wa-tag', { hasText: 'method' });
  await expect(page.locator('func-card').filter({ hasNot: methodTag })).toHaveCount(2);
  await expect(funcCard(page, 'handle')).toBeVisible();
  // Methods take the instance as `self`: a live one, or a new mock of the host resource.
  await expect(choices(picker(arg(funcCard(page, 'path-with-query'), 0)))).toHaveText(['New mock incoming-request']);
  // Host resources are collapsed until opened.
  const hostResources = page.locator('wa-details.interface').first();
  await hostResources.locator(':scope > .section-summary').click();
  await expect(hostResources.locator('.section-summary code', { hasText: 'wasi:http/types/response-outparam@0.2.3' })).toBeVisible();
});

test('loading: upload, switching components and rejecting other files', async ({ page }) => {
  await page.goto('./');
  await page.locator('#wasmFileInput').setInputFiles(path.join(PUBLIC_DIR, 'printer.wasm'));
  await expect(page.locator('#componentName')).toHaveText('printer.wasm');
  await call(funcCard(page, 'greet'), 'Random');
  await expect(callEntries(page)).toHaveCount(1);

  // Switching components replaces the workspace and clears the console.
  await page.locator('#preselectedWasmFile').selectOption('calculator.wasm');
  await expect(page.locator('#componentName')).toHaveText('Calculator');
  await expect(page.locator('#editImportsButton')).toBeVisible();
  await expect(callEntries(page)).toHaveCount(0);

  await page.locator('#wasmFileInput').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') });
  await expectCall(page, 'load notes.txt', 'error', 'notes.txt is not a .wasm file.');
  await expect(callEntry(page, 'load notes.txt')).toHaveCount(1);
});

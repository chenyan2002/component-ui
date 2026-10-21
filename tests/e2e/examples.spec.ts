import path from 'node:path';
import { expect, test } from '@playwright/test';
import { arg, call, callEntries, callEntry, expectCall, funcCard, loadExample, streamEntries } from './helpers';

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

test('calculator: instantiates with the prefilled import stub', async ({ page }) => {
  await page.goto('./');
  await page.locator('#preselectedWasmFile').selectOption('calculator.wasm');
  const stub = page.locator('#importsCard wa-textarea');
  await expect(stub).toHaveCount(1);
  await expect(stub).toHaveAttribute('label', 'docs:adder/add');
  await expect(stub).toHaveJSProperty('value', 'export function add(a, b) { return a + b }');

  await page.locator('#instantiateButton').click();
  const card = funcCard(page, 'evalExpression');
  await arg(card, 0).locator('select').selectOption('add');
  await arg(card, 1).locator('input').fill('2');
  await arg(card, 2).locator('input').fill('3');
  await call(card);
  await expectCall(page, 'evalExpression("add", 2, 3)', 'ok', '5');
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
    await loadExample(page, 'variants.wasm', { instantiate: true });
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

  test('an unimplemented import fails only when called', async ({ page }) => {
    await call(funcCard(page, 'testImports'));
    await expectCall(page, 'testImports()', 'error',
      /^Import test:variants\/test#\w+ is not implemented\. Provide it in the Imports card\.$/);
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
  // Methods take the instance as `self`, picked from the live instances.
  await expect(arg(funcCard(page, 'pathWithQuery'), 0).locator('select')).toBeDisabled();
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

import { expect, Page, test } from '@playwright/test';
import {
  applyImports, arg, call, callEntries, choices, choose, expectCall, fate, funcCard, loadExample, picker, resource, row,
} from './helpers';

test.beforeEach(async ({ page }) => {
  await loadExample(page, 'resource.wasm');
  await expect(page.locator('.resource-pane')).toBeVisible();
  // Resource sections start collapsed.
  for (const section of await page.locator('wa-details.resource').all()) {
    await expect(section).not.toHaveAttribute('open');
    await section.locator('.section-summary').click();
  }
});

function worldFunc(page: Page, name: string) {
  return funcCard(page.locator('wa-details.interface').first().locator(':scope > .func-grid'), name);
}

async function construct(page: Page, resourceName: string, value: string) {
  const ctor = funcCard(resource(page, resourceName), 'constructor');
  await arg(ctor, 0).locator('input').fill(value);
  await call(ctor);
}

test('owned arguments are moved and returned resources take their handle index', async ({ page }) => {
  await construct(page, 'x', '5');
  await expectCall(page, 'new exports/x(5)', 'ok', '#x-1');
  await expect(row(page, 'x-1').locator('td.handle')).toHaveText('1');

  // The picker lists live instances only.
  const add = funcCard(resource(page, 'x'), 'add');
  const instances = picker(arg(add, 0));
  await expect(choices(instances)).toHaveText(['#x-1']);
  await choose(instances, 'x-1');
  await arg(add, 1).locator('input').fill('1');
  await call(add);

  // The result reuses the index freed by moving x-1; the moved instance is kept as history.
  await expectCall(page, 'exports/x.add(#x-1, 1)', 'ok', '#x-1');
  await expect(page.locator('resource-table tr.resource-row')).toHaveCount(1);
  await expect(row(page, 'x-1').locator('wa-tag')).toHaveText('live');
  await expect(row(page, 'x-1').locator(':scope > td.history > .instance-origin')).toHaveText('exports/x.add(#x-1, 1)');
  await expect(row(page, 'x-1').locator('.earlier summary')).toHaveText('1 earlier');
  await expect(row(page, 'x-1').locator('.earlier li')).toHaveText(/new exports\/x\(5\)\s*→ moved into exports\/x\.add\(#x-1, 1\)/);

  // Methods take the instance as `self`.
  const getA = funcCard(resource(page, 'x'), 'get-a');
  await choose(picker(arg(getA, 0)), 'x-1');
  await call(getA);
  await expectCall(page, '#borrowed-x-1.get-a()', 'ok', '6');

  const consume = worldFunc(page, 'consume');
  await choose(picker(arg(consume, 0)), 'x-1');
  await call(consume);
  await expectCall(page, 'exports.consume(#x-1)', 'ok', '');
  await expect(row(page, 'x-1')).toHaveClass(/\bdead\b/);
  await expect(row(page, 'x-1').locator('wa-tag')).toHaveText('moved');
  await expect(fate(row(page, 'x-1'))).toHaveText('→ moved into exports.consume(#x-1)');

  // A selection that was moved blocks the call.
  const entries = await callEntries(page).count();
  await call(getA);
  await expect(arg(getA, 0).locator('.field-error')).toHaveText('#x-1 was moved into exports.consume(#x-1)');
  await expect(callEntries(page)).toHaveCount(entries);
});

test('borrowed arguments stay live, and Drop runs the destructor', async ({ page }) => {
  await construct(page, 'z', '2');
  await construct(page, 'z', '3');
  await expect(page.locator('resource-table tr.resource-row')).toHaveCount(2);

  const add = worldFunc(page, 'add');
  await choose(picker(arg(add, 0)), 'z-1');
  await choose(picker(arg(add, 1)), 'z-2');
  await call(add);
  await expectCall(page, 'exports.add(#borrowed-z-1, #borrowed-z-2)', 'ok', '#z-3');
  await expect(row(page, 'z-1')).not.toHaveClass(/\bdead\b/);
  await expect(row(page, 'z-2')).not.toHaveClass(/\bdead\b/);
  const getA = funcCard(resource(page, 'z'), 'get-a');
  await choose(picker(arg(getA, 0)), 'z-3');
  await call(getA);
  await expectCall(page, '#borrowed-z-3.get-a()', 'ok', '5');

  // The component counts destructor calls.
  const numDropped = funcCard(resource(page, 'z'), 'num-dropped');
  await call(numDropped);
  const before = Number(await page.locator('.log-entry').last().locator('.log-output pre').textContent());
  await row(page, 'z-1').locator('wa-button', { hasText: 'Drop' }).click();
  await expectCall(page, 'drop #z-1', 'ok', 'dropped');
  await expect(row(page, 'z-1').locator('wa-tag')).toHaveText('dropped');
  await call(numDropped);
  await expect(page.locator('.log-entry').last().locator('.log-output pre')).toHaveText(`${before + 1}`);

  await row(page, 'z-1').locator('wa-button', { hasText: 'Dismiss' }).click();
  await expect(row(page, 'z-1')).toHaveCount(0);
});

test('a freed index is reused by any resource, and Clear freed removes freed rows', async ({ page }) => {
  await construct(page, 'x', '5');
  await row(page, 'x-1').locator('wa-button', { hasText: 'Drop' }).click();
  await expectCall(page, 'drop #x-1', 'ok', 'dropped');
  await construct(page, 'z', '2');
  await expectCall(page, 'new exports/z(2)', 'ok', '#z-1');
  await expect(row(page, 'x-1')).toHaveCount(0);
  await expect(row(page, 'z-1').locator('td.handle')).toHaveText('1');
  await expect(row(page, 'z-1').locator('.earlier li')).toHaveText(/^x-1 · new exports\/x\(5\)\s*→ dropped$/);

  // The id opens the instance's methods; picking one selects it as `self`, expanding its section.
  await resource(page, 'z').locator('.section-summary').click();
  await expect(resource(page, 'z')).not.toHaveAttribute('open');
  await row(page, 'z-1').locator('button.instance-id').click();
  await page.locator('wa-dropdown-item', { hasText: 'get-a' }).click();
  const getA = funcCard(resource(page, 'z'), 'get-a');
  await expect(getA).toBeInViewport();
  await expect(picker(arg(getA, 0))).toHaveJSProperty('value', 'z-1');
  await call(getA);
  await expectCall(page, '#borrowed-z-1.get-a()', 'ok', '2');

  await construct(page, 'z', '3');
  await row(page, 'z-2').locator('wa-button', { hasText: 'Drop' }).click();
  await expect(page.locator('resource-table .panel-title')).toContainText('1 live · 1 freed');
  await page.locator('resource-table wa-button', { hasText: 'Clear freed' }).click();
  await expect(page.locator('resource-table tr.resource-row')).toHaveCount(1);
  await expect(row(page, 'z-1')).toBeVisible();
});

test('resources the host hands to the guest are tracked until the guest drops or moves them', async ({ page }) => {
  await applyImports(page, {
    imports: [
      'export class Y {',
      '  constructor(a) { this.a = a }',
      '  getA() { return this.a }',
      '  setA(a) { this.a = a }',
      '  static add(y, a) { return new Y(y.a + a) }',
      '}',
    ].join('\n'),
  });
  await call(worldFunc(page, 'test-imports'));
  await expectCall(page, 'exports.test-imports()', 'ok', 'ok');
  const rows = page.locator('resource-table tr.resource-row');
  await expect(rows).toHaveCount(6);
  await expect(rows.locator('td.handle')).toHaveText(Array(6).fill('host'));
  await expect(rows.locator('wa-tag')).toHaveText(['moved', 'dropped', 'moved', 'moved', 'dropped', 'dropped']);
  await expect(row(page, 'y-1').locator(':scope > td.history > .instance-origin')).toHaveText('new imports/y(10)');
  await expect(fate(row(page, 'y-1'))).toHaveText('→ moved into imports/y.add(#y-1, 10)');
  await expect(row(page, 'y-2').locator(':scope > td.history > .instance-origin')).toHaveText('imports/y.add(#y-1, 10)');
  await expect(fate(row(page, 'y-2'))).toHaveText('→ dropped by the guest');
});

test('Random picks a live instance for a resource argument', async ({ page }) => {
  await construct(page, 'kebab-case', '7');
  await call(funcCard(resource(page, 'kebab-case'), 'take-owned'), 'Random');
  await expectCall(page, 'exports/kebab-case.take-owned(#kebab-case-1)', 'ok', '7');
  await expect(row(page, 'kebab-case-1').locator('wa-tag')).toHaveText('moved');
});

import { expect, Page, test } from '@playwright/test';
import { arg, call, callEntries, expectCall, fate, funcCard, loadExample, resource, row } from './helpers';

test.beforeEach(async ({ page }) => {
  await loadExample(page, 'resource.wasm', { instantiate: true });
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
  await construct(page, 'X', '5');
  await expectCall(page, 'new X(5)', 'ok', 'x_1');
  await expect(row(page, 'x_1').locator('td.handle')).toHaveText('1');

  // The picker lists live instances only.
  const add = funcCard(resource(page, 'X'), 'add');
  const picker = arg(add, 0).locator('select');
  await expect(picker.locator('option:not([disabled])')).toHaveText(['x_1']);
  await picker.selectOption('x_1');
  await arg(add, 1).locator('input').fill('1');
  await call(add);

  // The result reuses the index freed by moving x_1; the moved instance is kept as history.
  await expectCall(page, 'X.add(x_1, 1)', 'ok', 'x_1');
  await expect(page.locator('resource-table tr.resource-row')).toHaveCount(1);
  await expect(row(page, 'x_1').locator('wa-tag')).toHaveText('live');
  await expect(row(page, 'x_1').locator(':scope > td.history > .instance-origin')).toHaveText('X.add(x_1, 1)');
  await expect(row(page, 'x_1').locator('.earlier summary')).toHaveText('1 earlier');
  await expect(row(page, 'x_1').locator('.earlier li')).toHaveText(/new X\(5\)\s*→ moved into X\.add\(x_1, 1\)/);

  // Methods take the instance as `self`.
  const getA = funcCard(resource(page, 'X'), 'getA');
  await arg(getA, 0).locator('select').selectOption('x_1');
  await call(getA);
  await expectCall(page, 'x_1.getA()', 'ok', '6');

  const consume = worldFunc(page, 'consume');
  await arg(consume, 0).locator('select').selectOption('x_1');
  await call(consume);
  await expectCall(page, 'consume(x_1)', 'ok', 'undefined');
  await expect(row(page, 'x_1')).toHaveClass(/\bdead\b/);
  await expect(row(page, 'x_1').locator('wa-tag')).toHaveText('moved');
  await expect(fate(row(page, 'x_1'))).toHaveText('→ moved into consume(x_1)');

  // A selection that was moved blocks the call.
  const entries = await callEntries(page).count();
  await call(getA);
  await expect(arg(getA, 0).locator('.field-error')).toHaveText('x_1 was moved into consume(x_1)');
  await expect(callEntries(page)).toHaveCount(entries);
});

test('borrowed arguments stay live, and Drop runs the destructor', async ({ page }) => {
  await construct(page, 'Z', '2');
  await construct(page, 'Z', '3');
  await expect(page.locator('resource-table tr.resource-row')).toHaveCount(2);

  const add = worldFunc(page, 'add');
  await arg(add, 0).locator('select').selectOption('z_1');
  await arg(add, 1).locator('select').selectOption('z_2');
  await call(add);
  await expectCall(page, 'add(z_1, z_2)', 'ok', 'z_3');
  await expect(row(page, 'z_1')).not.toHaveClass(/\bdead\b/);
  await expect(row(page, 'z_2')).not.toHaveClass(/\bdead\b/);
  const getA = funcCard(resource(page, 'Z'), 'getA');
  await arg(getA, 0).locator('select').selectOption('z_3');
  await call(getA);
  await expectCall(page, 'z_3.getA()', 'ok', '5');

  // The component counts destructor calls.
  const numDropped = funcCard(resource(page, 'Z'), 'numDropped');
  await call(numDropped);
  const before = Number(await page.locator('.log-entry').last().locator('.log-output pre').textContent());
  await row(page, 'z_1').locator('wa-button', { hasText: 'Drop' }).click();
  await expectCall(page, 'drop z_1', 'ok', 'dropped');
  await expect(row(page, 'z_1').locator('wa-tag')).toHaveText('dropped');
  await call(numDropped);
  await expect(page.locator('.log-entry').last().locator('.log-output pre')).toHaveText(`${before + 1}`);

  await row(page, 'z_1').locator('wa-button', { hasText: 'Dismiss' }).click();
  await expect(row(page, 'z_1')).toHaveCount(0);
});

test('a freed index is reused by any resource, and Clear freed removes freed rows', async ({ page }) => {
  await construct(page, 'X', '5');
  await row(page, 'x_1').locator('wa-button', { hasText: 'Drop' }).click();
  await expectCall(page, 'drop x_1', 'ok', 'dropped');
  await construct(page, 'Z', '2');
  await expectCall(page, 'new Z(2)', 'ok', 'z_1');
  await expect(row(page, 'x_1')).toHaveCount(0);
  await expect(row(page, 'z_1').locator('td.handle')).toHaveText('1');
  await expect(row(page, 'z_1').locator('.earlier li')).toHaveText(/^x_1 · new X\(5\)\s*→ dropped$/);

  // The id opens the instance's methods; picking one selects it as `self`.
  await row(page, 'z_1').locator('button.instance-id').click();
  await page.locator('wa-dropdown-item', { hasText: 'getA' }).click();
  const getA = funcCard(resource(page, 'Z'), 'getA');
  await expect(arg(getA, 0).locator('select')).toHaveValue('z_1');
  await call(getA);
  await expectCall(page, 'z_1.getA()', 'ok', '2');

  await construct(page, 'Z', '3');
  await row(page, 'z_2').locator('wa-button', { hasText: 'Drop' }).click();
  await expect(page.locator('resource-table .panel-title')).toContainText('1 live · 1 freed');
  await page.locator('resource-table wa-button', { hasText: 'Clear freed' }).click();
  await expect(page.locator('resource-table tr.resource-row')).toHaveCount(1);
  await expect(row(page, 'z_1')).toBeVisible();
});

test('resources the host hands to the guest are tracked until the guest drops or moves them', async ({ page }) => {
  await call(worldFunc(page, 'testImports'));
  await expectCall(page, 'testImports()', 'ok', 'undefined');
  const rows = page.locator('resource-table tr.resource-row');
  await expect(rows).toHaveCount(6);
  await expect(rows.locator('td.handle')).toHaveText(Array(6).fill('host'));
  await expect(rows.locator('wa-tag')).toHaveText(['moved', 'dropped', 'moved', 'moved', 'dropped', 'dropped']);
  await expect(row(page, 'y_host0').locator(':scope > td.history > .instance-origin')).toHaveText('new Y(10)');
  await expect(fate(row(page, 'y_host0'))).toHaveText('→ moved into Y.add(y_host0, 10)');
  await expect(row(page, 'y_host1').locator(':scope > td.history > .instance-origin')).toHaveText('Y.add(y_host0, 10)');
  await expect(fate(row(page, 'y_host1'))).toHaveText('→ dropped by the guest');
});

test('Random picks a live instance for a resource argument', async ({ page }) => {
  await construct(page, 'KebabCase', '7');
  await call(funcCard(resource(page, 'KebabCase'), 'takeOwned'), 'Random');
  await expectCall(page, 'KebabCase.takeOwned(kebabcase_1)', 'ok', '7');
  await expect(row(page, 'kebabcase_1').locator('wa-tag')).toHaveText('moved');
});

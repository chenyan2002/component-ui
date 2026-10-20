import { expect, test } from '@playwright/test';
import { arg, call, callEntries, expectCall, funcCard, instance, loadExample, resource } from './helpers';

test.beforeEach(async ({ page }) => {
  await loadExample(page, 'resource.wasm', { instantiate: true });
});

test('owned arguments are moved and returned resources are registered', async ({ page }) => {
  const x = resource(page, 'X');
  const ctor = funcCard(x, 'constructor');
  await arg(ctor, 0).locator('input').fill('5');
  await call(ctor);
  await expectCall(page, 'new X(5)', 'ok', 'x_0');

  // The picker lists live instances only.
  const add = funcCard(x, 'add');
  const picker = arg(add, 0).locator('select');
  await expect(picker.locator('option:not([disabled])')).toHaveText(['x_0']);
  await picker.selectOption('x_0');
  await arg(add, 1).locator('input').fill('1');
  await call(add);
  await expectCall(page, 'X.add(x_0, 1)', 'ok', 'x_1');
  await expect(instance(page, 'X', 'x_0')).toHaveClass(/\bdead\b/);
  await expect(instance(page, 'X', 'x_0').locator('wa-tag')).toHaveText('moved');
  await expect(instance(page, 'X', 'x_1').locator('.instance-origin')).toHaveText('from X.add(x_0, 1)');
  await expect(picker.locator('option:not([disabled])')).toHaveText(['x_1']);

  await call(funcCard(instance(page, 'X', 'x_1'), 'getA'));
  await expectCall(page, 'x_1.getA()', 'ok', '6');

  // A selection that was moved blocks the call.
  const entries = await callEntries(page).count();
  await call(add);
  await expect(arg(add, 0).locator('.field-error')).toHaveText('x_0 was moved into X.add(x_0, 1)');
  await expect(callEntries(page)).toHaveCount(entries);

  const consume = funcCard(page.locator('wa-details.interface').first().locator(':scope > .func-grid'), 'consume');
  await arg(consume, 0).locator('select').selectOption('x_1');
  await call(consume);
  await expectCall(page, 'consume(x_1)', 'ok', 'undefined');
  await expect(instance(page, 'X', 'x_1').locator('wa-tag')).toHaveText('moved');
});

test('borrowed arguments stay live, and Drop runs the destructor', async ({ page }) => {
  const z = resource(page, 'Z');
  for (const value of ['2', '3']) {
    await arg(funcCard(z, 'constructor'), 0).locator('input').fill(value);
    await call(funcCard(z, 'constructor'));
  }
  await expect(z.locator('.instance-card')).toHaveCount(2);

  const add = funcCard(page.locator('wa-details.interface').first().locator(':scope > .func-grid'), 'add');
  await arg(add, 0).locator('select').selectOption('z_0');
  await arg(add, 1).locator('select').selectOption('z_1');
  await call(add);
  await expectCall(page, 'add(z_0, z_1)', 'ok', 'z_2');
  await expect(instance(page, 'Z', 'z_0')).not.toHaveClass(/\bdead\b/);
  await expect(instance(page, 'Z', 'z_1')).not.toHaveClass(/\bdead\b/);
  await call(funcCard(instance(page, 'Z', 'z_2'), 'getA'));
  await expectCall(page, 'z_2.getA()', 'ok', '5');

  // The component counts destructor calls.
  await call(funcCard(z, 'numDropped'));
  const before = Number(await page.locator('.log-entry').last().locator('.log-output pre').textContent());
  await instance(page, 'Z', 'z_0').locator('wa-button', { hasText: 'Drop' }).click();
  await expectCall(page, 'drop z_0', 'ok', 'dropped');
  await expect(instance(page, 'Z', 'z_0').locator('wa-tag')).toHaveText('dropped');
  await call(funcCard(z, 'numDropped'));
  await expect(page.locator('.log-entry').last().locator('.log-output pre')).toHaveText(`${before + 1}`);

  await instance(page, 'Z', 'z_0').locator('wa-button', { hasText: 'Dismiss' }).click();
  await expect(instance(page, 'Z', 'z_0')).toHaveCount(0);
});

test('Random picks a live instance for a resource argument', async ({ page }) => {
  const kebab = resource(page, 'KebabCase');
  await arg(funcCard(kebab, 'constructor'), 0).locator('input').fill('7');
  await call(funcCard(kebab, 'constructor'));
  await call(funcCard(kebab, 'takeOwned'), 'Random');
  await expectCall(page, 'KebabCase.takeOwned(kebabcase_0)', 'ok', '7');
  await expect(instance(page, 'KebabCase', 'kebabcase_0').locator('wa-tag')).toHaveText('moved');
});

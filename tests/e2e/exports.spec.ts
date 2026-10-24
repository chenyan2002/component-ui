import { expect, test } from '@playwright/test';
import { arg, funcCard, loadExample, resource } from './helpers';

test('collapse and expand all interfaces', async ({ page }) => {
  await loadExample(page, 'calculator.wasm');
  const interfaces = page.locator('wa-details.interface');
  const toggle = page.locator('.exports-toolbar wa-button');
  await expect(toggle).toHaveText('Collapse all');

  await toggle.click();
  await expect(interfaces.and(page.locator('[open]'))).toHaveCount(0);
  await expect(toggle).toHaveText('Expand all');

  await toggle.click();
  await expect(interfaces.and(page.locator(':not([open])'))).toHaveCount(0);
  await expect(toggle).toHaveText('Collapse all');

  // Collapsing each one by hand flips the button too.
  for (const summary of await interfaces.locator('.section-summary').all()) {
    await summary.click();
  }
  await expect(toggle).toHaveText('Expand all');
});

test('search filters functions and opens the sections with matches', async ({ page }) => {
  await loadExample(page, 'resource.wasm');
  const search = page.locator('.exports-toolbar wa-input input');
  const getA = funcCard(resource(page, 'z'), 'get-a');
  await expect(getA).toBeHidden();

  await search.fill('num-dropped');
  // The collapsed resource with the match opens; the others hide.
  await expect(funcCard(resource(page, 'z'), 'num-dropped')).toBeVisible();
  await expect(getA).toBeHidden();
  await expect(resource(page, 'x')).toBeHidden();

  // A section's name matches all its functions.
  await search.fill('z');
  await expect(getA).toBeVisible();

  // Hidden cards keep what was typed into them.
  const constructor = funcCard(resource(page, 'x'), 'constructor');
  await search.fill('x');
  await arg(constructor, 0).locator('input').fill('7');
  await search.fill('zzz-no-match');
  await expect(page.locator('func-card').filter({ visible: true })).toHaveCount(0);
  await search.fill('');
  await expect(arg(constructor, 0).locator('input')).toHaveValue('7');
});

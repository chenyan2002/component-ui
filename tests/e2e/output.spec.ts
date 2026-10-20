import { expect, test } from '@playwright/test';
import { PRINTER_WASM } from '../global-setup';
import { arg, call, expectCall, funcCard, streamEntries } from './helpers';

test('stdout and stderr appear in the console', async ({ page }) => {
  await page.goto('./');
  await page.locator('#wasmFileInput').setInputFiles(PRINTER_WASM);
  await expect(funcCard(page, 'greet')).toBeVisible();
  // Every WASI interface it imports is provided by the shim.
  await expect(page.locator('#importsCard')).toHaveCount(0);

  const greet = funcCard(page, 'greet');
  await arg(greet, 0).locator('input').fill('Ada');
  await call(greet);
  await expectCall(page, 'greet("Ada")', 'ok', '"greeted Ada"');
  await expect(streamEntries(page, 'stdout')).toHaveText(['Hello, Ada!\nsecond line']);

  const warn = funcCard(page, 'warn');
  await arg(warn, 0).locator('input').fill('disk almost full');
  await call(warn);
  await expect(streamEntries(page, 'stderr')).toHaveText(['warning: disk almost full']);
});

import { expect, test } from '@playwright/test';
import { arg, call, callEntry, expectCall, funcCard, importPrompt, loadExample, streamEntries } from './helpers';

test('stdout and stderr appear in the console', async ({ page }) => {
  await loadExample(page, 'printer.wasm');
  // Every WASI interface it imports is provided by the shim.
  await expect(page.locator('#editImportsButton')).toHaveCount(0);
  // The exports don't involve resources: the resource table shows once the guest gets one.
  await expect(page.locator('.resource-pane')).toBeHidden();

  const greet = funcCard(page, 'greet');
  await arg(greet, 0).locator('input').fill('Ada');
  await call(greet);
  await expectCall(page, 'greet("Ada")', 'ok', '"greeted Ada"');
  await expect(streamEntries(page, 'stdout')).toHaveText(['Hello, Ada!\nsecond line']);

  // The stream the host handed to the guest for stdout is a host resource held by the guest.
  const stdout = page.locator('resource-table tr.resource-row', { hasText: 'wasi:cli/stdout@0.2.9.get-stdout()' });
  await expect(page.locator('.resource-pane')).toBeVisible();
  await expect(stdout).toHaveCount(1);
  await expect(stdout.locator('.instance-type')).toHaveText('output-stream');
  await expect(stdout.locator('td.handle')).toHaveText('host');
  await expect(stdout.locator('.instance-holders')).toHaveText('held by guest');
  await expect(stdout.locator('wa-button')).toHaveCount(0);

  const warn = funcCard(page, 'warn');
  await arg(warn, 0).locator('input').fill('disk almost full');
  await call(warn);
  await expect(streamEntries(page, 'stderr')).toHaveText(['warning: disk almost full']);
  await expect(page.locator('resource-table tr.resource-row', { hasText: 'wasi:cli/stderr@0.2.9.get-stderr()' })).toHaveCount(1);
});

test('without the WASI shim, WASI imports ask like any other, and the console logs them', async ({ page }) => {
  await loadExample(page, 'printer.wasm');
  const settings = async (check: boolean) => {
    await page.getByRole('button', { name: 'Console settings' }).click();
    const dialog = page.locator('console-panel wa-dialog.console-settings');
    await expect(dialog).toHaveAttribute('open');
    const wasi = dialog.locator('wa-switch.console-wasi-shim');
    await expect(wasi).toHaveJSProperty('checked', !check);
    await wasi.locator('[part="control"]').click();
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).not.toHaveAttribute('open');
  };
  await settings(false);
  // The component restarts with WASI as imports the user can implement.
  await expect(page.locator('#editImportsButton')).toBeVisible();
  const greet = funcCard(page, 'greet');
  await arg(greet, 0).locator('input').fill('Ada');
  await call(greet);
  const entry = callEntry(page, 'greet("Ada")');
  await expect(entry.locator('.log-import .log-call code').first()).toHaveText('wasi:cli/stdout@0.2.9.get-stdout()');
  await expect(importPrompt(page)).toBeVisible();
  await expect(streamEntries(page, 'stdout')).toHaveCount(0);

  // The choice is kept for the next component, until it is changed back.
  await page.reload();
  await loadExample(page, 'printer.wasm');
  await expect(page.locator('#editImportsButton')).toBeVisible();
  await settings(true);
  await expect(page.locator('#editImportsButton')).toHaveCount(0);
  await arg(funcCard(page, 'greet'), 0).locator('input').fill('Ada');
  await call(funcCard(page, 'greet'));
  await expect(streamEntries(page, 'stdout')).toHaveText(['Hello, Ada!\nsecond line']);
});

import { expect, Locator, Page } from '@playwright/test';

// Matches `text` exactly, except that any run of whitespace matches any other, as rendered.
function exactly(text: string): RegExp {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replace(/\s+/g, '\\s+')}$`);
}

function pageOf(scope: Page | Locator): Page {
  return 'page' in scope && typeof scope.page === 'function' ? scope.page() : (scope as Page);
}

// Opens the app and loads a bundled example, clicking Instantiate if it has custom imports.
export async function loadExample(page: Page, file: string, { instantiate = false } = {}) {
  if (!page.url().includes('/component-ui/')) {
    await page.goto('./');
  }
  await page.locator('#preselectedWasmFile').selectOption(file);
  if (instantiate) {
    await page.locator('#instantiateButton').click();
  }
  await expect(page.locator('func-card').first()).toBeVisible();
}

// The card of the exported function `name`, e.g. `add` or `constructor`.
export function funcCard(scope: Page | Locator, name: string): Locator {
  return scope.locator('func-card').filter({ has: pageOf(scope).locator('.sig-name', { hasText: exactly(name) }) });
}

// The `i`-th argument field of a function card.
export function arg(card: Locator, i: number): Locator {
  return card.locator('.func-args > .field').nth(i);
}

export async function call(card: Locator, button: 'Call' | 'Random' = 'Call') {
  await card.locator('wa-button', { hasText: button }).click();
}

// The resource section for `name`, with its function cards.
export function resource(page: Page, name: string): Locator {
  return page.locator('wa-details.resource').filter({ has: page.locator('.section-summary code', { hasText: exactly(name) }) });
}

// The resource table row whose current instance is `id`, e.g. `x_1`.
export function row(page: Page, id: string): Locator {
  return page.locator(`resource-table tr.resource-row[data-id="${id}"]`);
}

// What happened to the current instance of a row, e.g. `→ moved into consume(x_1)`.
export function fate(row: Locator): Locator {
  return row.locator(':scope > td.history > .instance-fate');
}

// Console entries for calls, or the one whose call label is exactly `label`.
export function callEntries(page: Page): Locator {
  return page.locator('.log-entry:not(.stream)');
}

export function callEntry(page: Page, label: string): Locator {
  return callEntries(page).filter({ has: page.locator('.log-call code', { hasText: exactly(label) }) });
}

// Asserts that the call `label` was logged with the given status and output.
export async function expectCall(page: Page, label: string, status: 'ok' | 'error', output: string | RegExp) {
  const entry = callEntry(page, label).last();
  await expect(entry).toHaveClass(new RegExp(`\\b${status}\\b`));
  await expect(entry.locator('.log-output pre')).toHaveText(output);
}

// The text of each stdout or stderr entry in the console.
export function streamEntries(page: Page, stream: 'stdout' | 'stderr'): Locator {
  return page.locator(`.log-entry.stream.${stream} pre`);
}

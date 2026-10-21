import { expect, Locator, Page } from '@playwright/test';

// Matches `text` exactly, except that any run of whitespace matches any other, as rendered.
function exactly(text: string): RegExp {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped.replace(/\s+/g, '\\s+')}$`);
}

function pageOf(scope: Page | Locator): Page {
  return 'page' in scope && typeof scope.page === 'function' ? scope.page() : (scope as Page);
}

// Opens the app and loads a bundled example, which instantiates right away.
export async function loadExample(page: Page, file: string) {
  if (!page.url().includes('/component-ui/')) {
    await page.goto('./');
  }
  await page.locator('#preselectedWasmFile').selectOption(file);
  // Cards in resource sections start collapsed, so wait for any visible one.
  await expect(page.locator('func-card').filter({ visible: true }).first()).toBeVisible();
}

// Implements imports in JavaScript, keyed by package, and restarts the component with them.
export async function applyImports(page: Page, code: Record<string, string>) {
  const card = page.locator('#importsCard');
  if ((await card.getAttribute('open')) === null) {
    await card.locator('.card-title').click();
  }
  for (const [pkg, source] of Object.entries(code)) {
    await card.locator(`wa-textarea[label="${pkg}"] textarea`).fill(source);
  }
  await card.locator('#applyImportsButton').click();
  // The card collapses once the new instance is ready.
  await expect(card).not.toHaveAttribute('open');
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

// The prompt of a missing import the guest called; at most one waits at a time.
export function importPrompt(page: Page): Locator {
  return page.locator('.import-prompt');
}

// Answers the pending import prompt, which must be for `call`, after filling it with `fill`.
export async function answerImport(
  page: Page,
  call: string,
  fill: (prompt: Locator) => Promise<void> = async () => {},
  button: 'Return' | 'Trap' = 'Return',
) {
  await expect(importPrompt(page)).toBeVisible();
  // The guest waits for the answer, so the prompt is on the latest import line.
  const lines = page.locator('.log-import');
  const index = (await lines.count()) - 1;
  await expect(lines.nth(index).locator('.log-call code').first()).toHaveText(exactly(call));
  await fill(importPrompt(page));
  await importPrompt(page).locator('wa-button', { hasText: button }).click();
  await expect(lines.nth(index).locator('.import-prompt')).toHaveCount(0);
}

// The text of each stdout or stderr entry in the console.
export function streamEntries(page: Page, stream: 'stdout' | 'stderr'): Locator {
  return page.locator(`.log-entry.stream.${stream} pre`);
}

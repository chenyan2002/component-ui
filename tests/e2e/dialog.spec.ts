import { expect, Page, test } from '@playwright/test';
import { answerImport, applyImports, arg, call, callEntry, expectCall, funcCard, importPrompt, loadExample, row } from './helpers';

// Loads the resource example with `stub` as the implementation of its `imports` interface,
// which defines the host resource `Y`.
async function loadResource(page: Page, stub = '') {
  await loadExample(page, 'resource.wasm');
  if (stub) {
    await applyImports(page, { imports: stub });
  }
}

const s32 = (value: string) => async (prompt: ReturnType<typeof importPrompt>) => {
  await expect(prompt.locator('.sig-type').first()).toHaveText('s32');
  await prompt.locator('input').fill(value);
};
const newMock = async (prompt: ReturnType<typeof importPrompt>) => {
  await expect(prompt.locator('.sig-type').first()).toHaveText('own<Y>');
  await prompt.locator('select').selectOption({ label: 'New mock Y' });
};

test('a missing host resource is mocked, and its calls ask for their results', async ({ page }) => {
  await loadResource(page);
  await call(funcCard(page, 'testImports'));
  const entry = callEntry(page, 'testImports()');
  await expect(entry.locator('.log-meta')).toHaveText('waiting for an import');
  // The guest is suspended, so other calls wait.
  await expect(funcCard(page, 'consume').locator('wa-button', { hasText: 'Call' })).toHaveAttribute('disabled');

  // Constructors return a new mock and void methods return right away, without asking.
  await answerImport(page, 'y_host0.getA()', s32('10'));
  await answerImport(page, 'y_host0.getA()', s32('20'));
  await answerImport(page, 'Y.add(y_host0, 10)', newMock);
  await answerImport(page, 'y_host1.getA()', s32('30'));
  await answerImport(page, 'y_host2.getA()', s32('1'));
  await answerImport(page, 'y_host3.getA()', s32('2'));
  await answerImport(page, 'y_host2.getA()', s32('10'));
  await answerImport(page, 'y_host3.getA()', s32('20'));
  await answerImport(page, 'Y.add(y_host2, 20)', newMock);
  await answerImport(page, 'Y.add(y_host3, 30)', newMock);
  await answerImport(page, 'y_host4.getA()', s32('30'));
  await answerImport(page, 'y_host5.getA()', s32('50'));
  // The guest checks the values it reads back.
  await expectCall(page, 'testImports()', 'ok', 'undefined');
  await expect(funcCard(page, 'consume').locator('wa-button', { hasText: 'Call' })).not.toHaveAttribute('disabled');

  await expect(entry.locator('.log-import').first().locator('.log-call')).toHaveText(/new Y\(10\)\s*=\s*y_host0/);
  await expect(entry.locator('.log-import', { hasText: 'y_host0.setA(20)' })).toContainText('= undefined');
  await expect(row(page, 'y_host1').locator('.instance-type')).toHaveText('Y · mock');
  await expect(page.locator('resource-table tr.resource-row wa-tag'))
    .toHaveText(['moved', 'dropped', 'moved', 'moved', 'dropped', 'dropped']);
});

test('a partial stub only asks for what it leaves out', async ({ page }) => {
  await loadResource(page, [
    'export class Y {',
    '  constructor(a) { this.a = a }',
    '  setA(a) { this.a = a }',
    '  static add(y, a) { return new Y(y.a + a) }',
    '}',
  ].join('\n'));
  await call(funcCard(page, 'testImports'));
  await answerImport(page, 'y_host0.getA()', s32('10'));
  await answerImport(page, 'y_host0.getA()', s32('20'));
  // `Y.add` is implemented, so it doesn't ask; its result is a real `Y`.
  await answerImport(page, 'y_host1.getA()', s32('30'));
  await expect(row(page, 'y_host1').locator('.instance-type')).toHaveText('Y');
});

test('Trap fails the import, and with it the call', async ({ page }) => {
  await loadResource(page);
  await call(funcCard(page, 'testImports'));
  await answerImport(page, 'y_host0.getA()', undefined, 'Trap');
  await expectCall(page, 'testImports()', 'error', /Trapped at y_host0\.getA\(\)/);
  await expect(callEntry(page, 'testImports()').locator('.log-import.error')).toContainText('y_host0.getA()');
  await expect(importPrompt(page)).toHaveCount(0);
  // Like a trap in the guest, it leaves the instance unusable.
  await call(funcCard(page, 'testImports'));
  await expectCall(page, 'testImports()', 'error', /cannot enter component instance/);
});

test('mock host resources stand in for the arguments a host would create', async ({ page }) => {
  await loadExample(page, 'wasi-http.wasm');
  // WASI HTTP has no constructors for these; the host creates them for each request. With no
  // live instances, a new mock is the only choice, so it is selected.
  const handle = funcCard(page, 'handle');
  await expect(arg(handle, 0).locator('select')).toHaveValue('+mock');
  await expect(arg(handle, 1).locator('select option:checked')).toHaveText('New mock ResponseOutparam');
  await call(handle);

  // Their methods ask, as do the mocks they return.
  const selectMock = (resource: string) => async (prompt: ReturnType<typeof importPrompt>) => {
    await prompt.locator('select').first().selectOption('ok');
    await prompt.locator('select').nth(1).selectOption({ label: `New mock ${resource}` });
  };
  await answerImport(page, 'incomingrequest_host0.headers()', async (prompt) => {
    await expect(prompt.locator('select option:checked')).toHaveText('New mock Fields');
  });
  await answerImport(page, 'fields_host2.entries()', async (prompt) => {
    await prompt.locator('input.length').fill('0');
    await prompt.locator('input.length').press('Tab');
  });
  await answerImport(page, 'incomingrequest_host0.method()', (prompt) => prompt.locator('select').selectOption('get').then(() => {}));
  await answerImport(page, 'incomingrequest_host0.scheme()');
  await answerImport(page, 'incomingrequest_host0.authority()');
  await answerImport(page, 'incomingrequest_host0.pathWithQuery()', async (prompt) => {
    await prompt.locator('input[type=checkbox]').check();
    await prompt.locator('input:not([type=checkbox])').fill('/hello');
  });
  await answerImport(page, 'incomingrequest_host0.consume()', selectMock('IncomingBody'));
  await answerImport(page, 'incomingbody_host3.stream()', selectMock('InputStream'));

  // The guest builds a real response with the shim, and hands it to the mock outparam: the
  // host can't handle a mock, so that call shows in the console instead.
  await expectCall(page, 'handle(incomingrequest_host0, responseoutparam_host1)', 'ok', 'undefined');
  const set = callEntry(page, 'handle(incomingrequest_host0, responseoutparam_host1)')
    .locator('.log-import', { hasText: 'ResponseOutparam.set(responseoutparam_host1' });
  await expect(set).toContainText('outgoingresponse_host6');
  await expect(row(page, 'incomingrequest_host0').locator('.instance-type')).toHaveText('IncomingRequest · mock');
  await expect(row(page, 'responseoutparam_host1').locator('wa-tag')).toHaveText('moved');
  await expect(row(page, 'outgoingresponse_host6').locator('.instance-type')).toHaveText('OutgoingResponse');
});

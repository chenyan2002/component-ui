import { expect, Page, test } from '@playwright/test';
import {
  answerImport, applyImports, arg, call, callEntry, choices, choose, chosen, expectCall, funcCard, importPrompt, loadExample, picker, row,
} from './helpers';

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
  await expect(prompt.locator('.sig-type').first()).toHaveText('Y');
  await choose(picker(prompt), { label: 'New mock Y' });
};

test('a missing host resource is mocked, and its calls ask for their results', async ({ page }) => {
  await loadResource(page);
  await call(funcCard(page, 'testImports'));
  const entry = callEntry(page, 'testImports()');
  await expect(entry.locator('.log-meta')).toHaveText('waiting for an import');
  // The guest is suspended, so other calls wait.
  await expect(funcCard(page, 'consume').locator('wa-button', { hasText: 'Call' })).toHaveAttribute('disabled');

  // Constructors return a new mock and void methods return right away, without asking.
  await answerImport(page, '#borrowed-host-y-1.getA()', s32('10'));
  await answerImport(page, '#borrowed-host-y-1.getA()', s32('20'));
  await answerImport(page, 'Y.add(#host-y-1, 10)', newMock);
  await answerImport(page, '#borrowed-host-y-2.getA()', s32('30'));
  await answerImport(page, '#borrowed-host-y-3.getA()', s32('1'));
  await answerImport(page, '#borrowed-host-y-4.getA()', s32('2'));
  await answerImport(page, '#borrowed-host-y-3.getA()', s32('10'));
  await answerImport(page, '#borrowed-host-y-4.getA()', s32('20'));
  await answerImport(page, 'Y.add(#host-y-3, 20)', newMock);
  await answerImport(page, 'Y.add(#host-y-4, 30)', newMock);
  await answerImport(page, '#borrowed-host-y-5.getA()', s32('30'));
  await answerImport(page, '#borrowed-host-y-6.getA()', s32('50'));
  // The guest checks the values it reads back.
  await expectCall(page, 'testImports()', 'ok', 'ok');
  await expect(funcCard(page, 'consume').locator('wa-button', { hasText: 'Call' })).not.toHaveAttribute('disabled');

  await expect(entry.locator('.log-import').first().locator('.log-call')).toHaveText(/new Y\(10\)\s*=\s*#host-y-1/);
  await expect(entry.locator('.log-import', { hasText: '#borrowed-host-y-1.setA(20)' }).locator('.log-import-output')).toHaveCount(0);
  await expect(row(page, 'host-y-2').locator('.instance-type')).toHaveText('Y · mock');
  await expect(page.locator('resource-table tr.resource-row wa-tag'))
    .toHaveText(['moved', 'dropped', 'moved', 'moved', 'dropped', 'dropped']);
});

test('an import returns instances the host owns, not those the guest holds', async ({ page }) => {
  await loadResource(page);
  await call(funcCard(page, 'testImports'));
  const returns = (offered: string[], pick: string) => async (prompt: ReturnType<typeof importPrompt>) => {
    await expect(choices(picker(prompt))).toHaveText(offered);
    await choose(picker(prompt), { label: pick });
  };
  await answerImport(page, '#borrowed-host-y-1.getA()', s32('10'));
  await answerImport(page, '#borrowed-host-y-1.getA()', s32('20'));
  // The guest moved host-y-1 into the call, so the host can hand it back.
  await answerImport(page, 'Y.add(#host-y-1, 10)', returns(['New mock Y', '#host-y-1'], '#host-y-1'));
  await answerImport(page, '#borrowed-host-y-1.getA()', s32('30'));
  await answerImport(page, '#borrowed-host-y-2.getA()', s32('1'));
  await answerImport(page, '#borrowed-host-y-3.getA()', s32('2'));
  await answerImport(page, '#borrowed-host-y-2.getA()', s32('10'));
  await answerImport(page, '#borrowed-host-y-3.getA()', s32('20'));
  // The guest still holds host-y-3, and dropped host-y-1.
  await answerImport(page, 'Y.add(#host-y-2, 20)', returns(['New mock Y', '#host-y-2'], 'New mock Y'));
  await answerImport(page, 'Y.add(#host-y-3, 30)', returns(['New mock Y', '#host-y-2', '#host-y-3'], 'New mock Y'));
  await answerImport(page, '#borrowed-host-y-4.getA()', s32('30'));
  await answerImport(page, '#borrowed-host-y-5.getA()', s32('50'));
  await expectCall(page, 'testImports()', 'ok', 'ok');
  await expect(page.locator('resource-table tr.resource-row wa-tag'))
    .toHaveText(['dropped', 'moved', 'moved', 'dropped', 'dropped']);
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
  await answerImport(page, '#borrowed-host-y-1.getA()', s32('10'));
  await answerImport(page, '#borrowed-host-y-1.getA()', s32('20'));
  // `Y.add` is implemented, so it doesn't ask; its result is a real `Y`.
  await answerImport(page, '#borrowed-host-y-2.getA()', s32('30'));
  await expect(row(page, 'host-y-2').locator('.instance-type')).toHaveText('Y');
});

test('Trap fails the import, and with it the call', async ({ page }) => {
  await loadResource(page);
  await call(funcCard(page, 'testImports'));
  await answerImport(page, '#borrowed-host-y-1.getA()', undefined, 'Trap');
  await expectCall(page, 'testImports()', 'error', /Trapped at #borrowed-host-y-1\.getA\(\)/);
  await expect(callEntry(page, 'testImports()').locator('.log-import.error')).toContainText('#borrowed-host-y-1.getA()');
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
  await expect(picker(arg(handle, 0))).toHaveJSProperty('value', '+mock');
  await expect(chosen(picker(arg(handle, 1)))).toHaveText('New mock ResponseOutparam');
  await call(handle);

  // Their methods ask, as do the mocks they return.
  const selectMock = (resource: string) => async (prompt: ReturnType<typeof importPrompt>) => {
    await choose(picker(prompt), 'ok');
    await choose(picker(prompt, 1), { label: `New mock ${resource}` });
  };
  await answerImport(page, '#borrowed-host-incomingrequest-1.headers()', async (prompt) => {
    await expect(chosen(picker(prompt))).toHaveText('New mock Fields');
  });
  // Items are added and removed one by one. A `list<u8>` is typed as text, sent as UTF-8, or as hex.
  await answerImport(page, '#borrowed-host-fields-3.entries()', async (prompt) => {
    const add = prompt.locator('wa-button', { hasText: 'Add item' });
    await add.click();
    await add.click();
    await prompt.locator('.remove-item').nth(1).click();
    await expect(prompt.locator('.remove-item')).toHaveCount(1);
    await prompt.locator('wa-input input').fill('x-id');
    const bytes = prompt.locator('wa-textarea textarea');
    await bytes.fill('hé');
    await expect(prompt.locator('.bytes-mode')).toContainText('3 bytes');
    await choose(picker(prompt), 'hex');
    await expect(bytes).toHaveValue('68 c3 a9');
    await bytes.fill('68 c3 zz');
    await bytes.blur();
    await expect(prompt.locator('.field-error')).toHaveText('Expected hex bytes, e.g. "48 69"');
    // Bytes that aren't UTF-8 can't be shown as text, so they stay hex.
    await bytes.fill('68 69 ff');
    await choose(picker(prompt), 'text');
    await expect(prompt.locator('.field-error')).toHaveText("These bytes aren't valid UTF-8 text");
    await expect(chosen(picker(prompt))).toHaveText('hex');
    await bytes.fill('0x68,0x69');
  });
  await expect(page.locator('.log-import').filter({ hasText: 'entries()' }).locator('.log-import-output code')).toHaveText('[("x-id", [104, 105])]');
  await answerImport(page, '#borrowed-host-incomingrequest-1.method()', (prompt) => choose(picker(prompt), 'get'));
  await answerImport(page, '#borrowed-host-incomingrequest-1.scheme()');
  await answerImport(page, '#borrowed-host-incomingrequest-1.authority()');
  await answerImport(page, '#borrowed-host-incomingrequest-1.pathWithQuery()', async (prompt) => {
    await choose(picker(prompt), 'some');
    await prompt.locator('wa-input input').fill('/');
  });
  await answerImport(page, '#borrowed-host-incomingrequest-1.consume()', selectMock('IncomingBody'));
  await answerImport(page, '#borrowed-host-incomingbody-4.stream()', selectMock('InputStream'));

  // The guest builds a real response with the shim, and hands it to the mock outparam: the
  // host can't handle a mock, so that call shows in the console, with the response it sends.
  await expectCall(page, 'handle(#host-incomingrequest-1, #host-responseoutparam-2)', 'ok', '');
  const set = callEntry(page, 'handle(#host-incomingrequest-1, #host-responseoutparam-2)')
    .locator('.log-import', { hasText: 'ResponseOutparam.set(#host-responseoutparam-2' });
  await expect(set.locator('.log-call')).toContainText('#host-outgoingresponse-7');
  await expect(set.locator('.log-output pre')).toHaveText('HTTP 200\ncontent-length: 30\n\nHello, wasi:http/proxy world!\n');
  await expect(row(page, 'host-incomingrequest-1').locator('.instance-type')).toHaveText('IncomingRequest · mock');
  await expect(row(page, 'host-responseoutparam-2').locator('wa-tag')).toHaveText('moved');
  await expect(row(page, 'host-outgoingresponse-7').locator('.instance-type')).toHaveText('OutgoingResponse');
});

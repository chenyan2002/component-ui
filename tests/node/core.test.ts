import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { call, CallActivity, ExportsContext } from '../../src/calls';
import { ImportDialogs } from '../../src/dialog';
import { TextDraft } from '../../src/draft';
import { HostResources } from '../../src/host-resources';
import { ImportLog, ImportPrompt } from '../../src/log';
import { instantiate, JSPI_SUPPORTED, LoadedComponent, loadComponent } from '../../src/loader';
import { nodePlatform } from '../../src/platform-node';
import { clashingNames, ResourceRegistry } from '../../src/resources';

// The core runs headless in Node: no DOM, the same WASI as the browser, and imports that wait
// for an answer. Built and run by `npm run test:node`.

interface Session {
  component: LoadedComponent;
  ctx: ExportsContext;
  // Each logged call with its result, e.g. `add(1, 2) -> 3`, in the order they finished.
  lines: string[];
  // What the component wrote to stdout and stderr.
  output: string[];
}

// Instantiates an example; `answer` handles the prompts of imports without an implementation.
async function start(file: string, answer: (call: string, prompt: ImportPrompt) => void = () => {}): Promise<Session> {
  const component = await loadComponent(nodePlatform, await readFile(resolve('public', file)));
  const registry = new ResourceRegistry(clashingNames(component.imports, component.interfaces));
  const host = new HostResources(registry, component.imports);
  const lines: string[] = [];
  const output: string[] = [];
  const log = (call: string): ImportLog => ({
    result: (text) => lines.push(`${call} -> ${text}`),
    error: (err) => lines.push(`${call} !! ${err}`),
    detail: (text) => lines.push(`${call} => ${text}`),
    ask: (prompt) => answer(call, prompt),
  });
  const dialogs = new ImportDialogs(registry, host, component.imports, log);
  const exports = await instantiate(nodePlatform, component.transpiled, {}, {
    stdout: (text) => output.push(text),
    stderr: (text) => output.push(text),
  }, {
    complete: (pkg, mod, wasi) => dialogs.complete(pkg, mod, wasi),
    wrap: (pkg, mod) => host.wrap(pkg, mod),
  });
  const ctx: ExportsContext = { exports, log, registry, host, activity: new CallActivity(), mocks: dialogs };
  return { component, ctx, lines, output };
}

// Calls the function `name`, by its jco name, of the exported interface `iface`.
function callFunc(s: Session, iface: string, name: string, args: any[]) {
  const exported = s.component.interfaces.find((i) => i._name === iface);
  assert.ok(exported, `no exported interface ${iface}`);
  return call(s.ctx, { type: 'func', iface: exported }, name, exported._fields[name], args);
}

test('JSPI is available', () => {
  assert.ok(JSPI_SUPPORTED, 'run Node with --experimental-wasm-jspi');
});

test('an import without an implementation waits for its answer', async () => {
  const prompts: string[] = [];
  const s = await start('calculator.wasm', (call, prompt) => {
    prompts.push(call);
    (prompt.draft as TextDraft).text = '42';
    prompt.answer();
  });
  await callFunc(s, 'docs:calculator/calculate@0.1.0', 'evalExpression', ['add', 1, 2]);
  assert.deepEqual(prompts, ['docs:adder/add@0.1.0.add(1, 2)']);
  assert.deepEqual(s.lines, [
    'docs:adder/add@0.1.0.add(1, 2) -> 42',
    'docs:calculator/calculate@0.1.0.eval-expression(add, 1, 2) -> 42',
  ]);
});

test('stdout and stderr go to the output callbacks', async () => {
  const s = await start('printer.wasm');
  const root = s.component.interfaces.find((i) => i.isRoot)!._name;
  await callFunc(s, root, 'greet', ['node']);
  await callFunc(s, root, 'warn', ['careful']);
  assert.deepEqual(s.lines, ['greet("node") -> "greeted node"', 'warn("careful") -> ']);
  assert.match(s.output.join(''), /Hello, node!/);
  assert.match(s.output.join(''), /careful/);
});

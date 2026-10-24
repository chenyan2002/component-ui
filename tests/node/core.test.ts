import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { CallRecord } from '../../src/call-record';
import { call, CallActivity, drop, ExportsContext } from '../../src/calls';
import { ImportDialogs } from '../../src/dialog';
import { TextDraft } from '../../src/draft';
import { HostResources, ownFunc } from '../../src/host-resources';
import { ImportLog, ImportPrompt } from '../../src/log';
import { instantiate, JSPI_SUPPORTED, LoadedComponent, loadComponent } from '../../src/loader';
import { nodePlatform } from '../../src/platform-node';
import { clashingNames, ResourceRegistry } from '../../src/resources';

// The core runs headless in Node: no DOM, the same WASI as the browser, and imports that wait
// for an answer. Built and run by `npm run test:node`.

interface Session {
  component: LoadedComponent;
  ctx: ExportsContext;
  // The logged calls, in the order they started.
  records: CallRecord[];
  // Each logged call with its result, e.g. `add(1, 2) -> 3`, in the order they finished.
  lines: string[];
  // What the component wrote to stdout and stderr.
  output: string[];
}

// Instantiates an example; `answer` handles the prompts of imports without an implementation.
async function start(file: string, answer: (call: CallRecord, prompt: ImportPrompt) => void = () => {}): Promise<Session> {
  const component = await loadComponent(nodePlatform, await readFile(resolve('public', file)));
  const registry = new ResourceRegistry(clashingNames(component.imports, component.interfaces));
  const host = new HostResources(registry, component.imports);
  const records: CallRecord[] = [];
  const lines: string[] = [];
  const output: string[] = [];
  const log = (call: CallRecord): ImportLog => {
    records.push(call);
    return {
      result: (text) => lines.push(`${call.label} -> ${text}`),
      error: (err) => lines.push(`${call.label} !! ${err}`),
      detail: (text) => lines.push(`${call.label} => ${text}`),
      ask: (prompt) => answer(call, prompt),
    };
  };
  const dialogs = new ImportDialogs(registry, host, component.imports, log);
  const exports = await instantiate(nodePlatform, component.transpiled, {}, {
    stdout: (text) => output.push(text),
    stderr: (text) => output.push(text),
  }, {
    complete: (pkg, mod, wasi) => dialogs.complete(pkg, mod, wasi),
    wrap: (pkg, mod) => host.wrap(pkg, mod),
  });
  const ctx: ExportsContext = { exports, log, registry, host, activity: new CallActivity(), mocks: dialogs };
  return { component, ctx, records, lines, output };
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
    prompts.push(call.label);
    (prompt.draft as TextDraft).text = '42';
    prompt.answer();
  });
  await callFunc(s, 'docs:calculator/calculate@0.1.0', 'evalExpression', ['add', 1, 2]);
  assert.deepEqual(prompts, ['docs:adder/add@0.1.0.add(1, 2)']);
  assert.deepEqual(s.lines, [
    'docs:adder/add@0.1.0.add(1, 2) -> 42',
    'docs:calculator/calculate@0.1.0.eval-expression(add, 1, 2) -> 42',
  ]);
  assert.deepEqual(s.records, [
    {
      kind: 'export', callKind: 'func', iface: 'docs:calculator/calculate@0.1.0', func: 'eval-expression', args: ['add', '1', '2'],
      label: 'docs:calculator/calculate@0.1.0.eval-expression(add, 1, 2)',
    },
    {
      kind: 'import', callKind: 'func', iface: 'docs:adder/add@0.1.0', func: 'add', args: ['1', '2'],
      label: 'docs:adder/add@0.1.0.add(1, 2)',
    },
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

test('calls on resources are recorded with their resource and instance', async () => {
  const s = await start('resource.wasm');
  const iface = s.component.interfaces.find((i) => i._name === 'exports')!;
  const x = iface.get_resources().find((r) => r.witName === 'x')!;
  await call(s.ctx, { type: 'constructor', iface, resource: x }, 'constructor', ownFunc(x._fields, 'constructor')!, [5]);
  const [instance] = s.ctx.registry.uiOwned(x);
  await call(s.ctx, { type: 'method', resource: x }, 'getA', x._fields.getA, [instance.obj]);
  drop(s.ctx, instance.id);
  assert.equal(instance.id, 'x-1');
  assert.deepEqual(s.records, [
    { kind: 'export', callKind: 'constructor', iface: 'exports', resource: 'x', func: 'constructor', args: ['5'], label: 'new exports/x(5)' },
    { kind: 'export', callKind: 'method', iface: 'exports', resource: 'x', func: 'get-a', self: '#borrow-x-1', args: [], label: '#borrow-x-1.get-a()' },
    { kind: 'export', callKind: 'drop', iface: 'exports', resource: 'x', func: 'drop', self: '#x-1', args: [], label: 'drop #x-1' },
  ]);
  assert.deepEqual(s.lines, ['new exports/x(5) -> #x-1', '#borrow-x-1.get-a() -> 5', 'drop #x-1 -> dropped']);
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { AnswerSource } from '../../src/answering';
import { CallLog } from '../../src/call-log';
import { CallRecord } from '../../src/call-record';
import { call, drop, ExportsContext } from '../../src/calls';
import { ComponentInstance } from '../../src/component-instance';
import { ownFunc } from '../../src/host-resources';
import { JSPI_SUPPORTED, LoadedComponent, loadComponent } from '../../src/loader';
import { nodePlatform } from '../../src/platform-node';

// The core runs headless in Node: no DOM, the same WASI as the browser, and imports that wait
// for an answer. Built and run by `npm run test:node`.

interface Session {
  component: LoadedComponent;
  ctx: ExportsContext;
  log: CallLog;
}

// Instantiates an example; `answers` answers the imports without an implementation.
async function start(file: string, answers: AnswerSource = { answer: () => undefined }): Promise<Session> {
  const component = await loadComponent(nodePlatform, await readFile(resolve('public', file)));
  const log = new CallLog();
  const { ctx } = await ComponentInstance.create(nodePlatform, component, log, { answers });
  return { component, ctx, log };
}

// The calls and the imports made during them, in the order they started.
function entries(log: CallLog) {
  return log.entries.flatMap((e) => (e.kind === 'call' ? [e, ...e.imports] : e.kind === 'import' ? [e] : []));
}

function records(log: CallLog): CallRecord[] {
  return entries(log).map((e) => e.record!);
}

// Each call and import with its result, e.g. `add(1, 2) -> 3`.
function lines(log: CallLog): string[] {
  return entries(log).map((e) => `${e.record!.label} ${e.status === 'error' ? '!!' : '->'} ${e.output}`);
}

// What the component wrote to stdout and stderr.
function output(log: CallLog): string {
  return log.entries.map((e) => (e.kind === 'stream' ? e.text : '')).join('');
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
  const s = await start('calculator.wasm', {
    answer: (record) => {
      prompts.push(record.label);
      return { source: 'test', value: '42' };
    },
  });
  await callFunc(s, 'docs:calculator/calculate@0.1.0', 'evalExpression', ['add', 1, 2]);
  assert.deepEqual(prompts, ['docs:adder/add@0.1.0.add(1, 2)']);
  assert.deepEqual(lines(s.log), [
    'docs:calculator/calculate@0.1.0.eval-expression(add, 1, 2) -> 42',
    'docs:adder/add@0.1.0.add(1, 2) -> 42',
  ]);
  assert.deepEqual(records(s.log), [
    {
      kind: 'export', callKind: 'func', iface: 'docs:calculator/calculate@0.1.0', func: 'eval-expression', args: ['add', '1', '2'],
      callee: 'docs:calculator/calculate@0.1.0.eval-expression', label: 'docs:calculator/calculate@0.1.0.eval-expression(add, 1, 2)',
    },
    {
      kind: 'import', callKind: 'func', iface: 'docs:adder/add@0.1.0', func: 'add', args: ['1', '2'],
      callee: 'docs:adder/add@0.1.0.add', label: 'docs:adder/add@0.1.0.add(1, 2)',
    },
  ]);
});

test('stdout and stderr go to the log', async () => {
  const s = await start('printer.wasm');
  const root = s.component.interfaces.find((i) => i.isRoot)!._name;
  await callFunc(s, root, 'greet', ['node']);
  await callFunc(s, root, 'warn', ['careful']);
  // The calls, among the shim's WASI calls that wrote, which the log records as the shim's answers.
  assert.deepEqual(lines(s.log).filter((line) => !line.startsWith('wasi:')), ['greet("node") -> "greeted node"', 'warn("careful") -> ']);
  assert.ok(entries(s.log).some((e) => e.kind === 'import' && e.answered?.by?.source === 'wasi'));
  assert.match(output(s.log), /Hello, node!/);
  assert.match(output(s.log), /careful/);
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
  assert.deepEqual(records(s.log), [
    {
      kind: 'export', callKind: 'constructor', iface: 'exports', resource: 'x', func: 'constructor', args: ['5'],
      callee: 'new exports/x', label: 'new exports/x(5)',
    },
    // A method's instance is its first argument.
    {
      kind: 'export', callKind: 'method', iface: 'exports', resource: 'x', func: 'get-a', self: '#borrow-x-1', args: ['#borrow-x-1'],
      callee: 'exports/x.get-a', label: 'exports/x.get-a(#borrow-x-1)',
    },
    {
      kind: 'export', callKind: 'drop', iface: 'exports', resource: 'x', func: 'drop', self: '#x-1', args: [],
      callee: 'drop', label: 'drop #x-1',
    },
  ]);
  assert.deepEqual(lines(s.log), ['new exports/x(5) -> #x-1', 'exports/x.get-a(#borrow-x-1) -> 5', 'drop #x-1 -> dropped']);
});

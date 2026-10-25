import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

// The CLI, as built into dist-cli by `npm run build:cli`, run as an agent would.

const dir = mkdtempSync(join(tmpdir(), 'component-ui-cli-'));

function cli(...args: string[]) {
  const result = spawnSync(process.execPath, ['dist-cli/component-ui.mjs', ...args], { encoding: 'utf8' });
  return { code: result.status, out: result.stdout, err: result.stderr };
}

function file(name: string, text: string): string {
  const path = join(dir, name);
  writeFileSync(path, text);
  return path;
}

const CALC = 'public/calculator.wasm';
const EVAL = 'docs:calculator/calculate@0.1.0.eval-expression(add, 1, 2)';

test('inspect shows the exports, the imports that ask, and the types', () => {
  const { code, out } = cli('inspect', CALC);
  assert.equal(code, 0);
  assert.match(out, /^ {2}docs:calculator\/calculate@0\.1\.0\.eval-expression\(op: op, x: u32, y: u32\) -> u32$/m);
  assert.match(out, /^ {2}docs:adder\/add@0\.1\.0\.add\(a: u32, b: u32\) -> u32$/m);
  assert.match(out, /^ {2}op = enum \{ add \}$/m);
});

test('a run stops at an import without an answer, and says what it expects', () => {
  const { code, out } = cli('call', CALC, EVAL);
  assert.equal(code, 2);
  assert.equal(out, [
    `› ${EVAL}`,
    '  ↳ docs:adder/add@0.1.0.add(1, 2)',
    '    ? u32',
    'stopped: No answer for docs:adder/add@0.1.0.add(1, 2)',
    "  answer 1 is needed, e.g. --answer 'docs:adder/add@0.1.0.add = <u32>'",
    '',
  ].join('\n'));
});

test('answers are used in order', () => {
  const { code, out } = cli('call', CALC, EVAL, EVAL, '--answer', 'docs:adder/add@0.1.0.add = 3', '--answer', 'docs:adder/add@0.1.0.add(1, 2) = 4');
  assert.equal(code, 0);
  assert.deepEqual(out.split('\n').filter((line) => line.startsWith('  =')), ['  = 3', '  = 4']);
});

test('an answer for another import, or other arguments, stops the run', () => {
  const other = cli('call', CALC, EVAL, '--answer', 'docs:adder/add@0.1.0.sub = 3');
  assert.equal(other.code, 1);
  assert.match(other.out, /stopped: --answer 1: the answer is for docs:adder\/add@0\.1\.0\.sub, but the guest called docs:adder\/add@0\.1\.0\.add\(1, 2\)/);
  const args = cli('call', CALC, EVAL, '--answer', 'docs:adder/add@0.1.0.add(2, 1) = 3');
  assert.equal(args.code, 1);
  assert.match(args.out, /the answer is for docs:adder\/add@0\.1\.0\.add\(2, 1\)/);
  const invalid = cli('call', CALC, EVAL, '--answer', 'docs:adder/add@0.1.0.add = "3"');
  assert.equal(invalid.code, 1);
  assert.match(invalid.out, /--answer 1: "3" is no u32/);
});

test('answers that no import asked for are reported', () => {
  const { code, out } = cli('call', CALC, EVAL, '--answer', 'docs:adder/add@0.1.0.add = 3', '--answer', 'docs:adder/add@0.1.0.add = 4');
  assert.equal(code, 0);
  assert.match(out, /warning: 1 answer was not used, from --answer 2/);
});

test('imports can be implemented in JavaScript', () => {
  const add = file('add.js', 'export function add(a, b) { return a + b; }');
  const { code, out } = cli('call', CALC, EVAL, '--imports', `docs:adder/add=${add}`);
  assert.equal(code, 0);
  assert.equal(out, `› ${EVAL}\n  = 3\n`);
});

test('resources: methods on instances, mocks of host resources, and a file of answers', () => {
  // As tests/e2e/dialog.spec.ts answers them in the UI.
  const answers = file('answers.txt', `// exports.test-imports()
#borrow-y-1.get-a = 10
#borrow-y-1.get-a = 20
imports/y.add(#y-1, 10) = #mock
#borrow-y-2.get-a = 30
#borrow-y-3.get-a = 1
#borrow-y-4.get-a = 2
imports/y.get-a = 10
imports/y.get-a = 20
imports/y.add(#y-3, 20) = #mock
imports/y.add(#y-4, 30) = #mock
#borrow-y-5.get-a = 30
#borrow-y-6.get-a = 50
`);
  const { code, out } = cli('call', 'public/resource.wasm', 'new exports/x(5)', '#borrow-x-1.get-a()', 'exports.test-imports()', '--answers', answers);
  assert.equal(code, 0, out);
  const lines = out.split('\n');
  assert.deepEqual(lines.slice(0, 4), ['› new exports/x(5)', '  = #x-1', '› #borrow-x-1.get-a()', '  = 5']);
  assert.ok(lines.includes('  ↳ imports/y.add(#y-1, 10)'));
  assert.ok(lines.includes('    = #y-2'));
  assert.equal(lines.at(-2), '  = ok');
});

test('calls that the component doesn\'t have, or with invalid arguments, fail', () => {
  const missing = cli('call', CALC, 'docs:calculator/calculate.eval-expression(add, 1, 2)');
  assert.equal(missing.code, 1);
  assert.match(missing.err, /No export docs:calculator\/calculate\.eval-expression; did you mean docs:calculator\/calculate@0\.1\.0\.eval-expression\?/);
  const args = cli('call', CALC, 'docs:calculator/calculate@0.1.0.eval-expression(add, 1)');
  assert.equal(args.code, 1);
  const owned = cli('call', 'public/resource.wasm', 'new exports/x(5)', '#x-1.get-a()');
  assert.equal(owned.code, 1);
  assert.match(owned.err, /No export #x-1\.get-a/);
});

test('--json prints the events as JSON lines', () => {
  const { code, out } = cli('call', CALC, EVAL, '--json');
  assert.equal(code, 2);
  const events = out.trim().split('\n').map((line) => JSON.parse(line));
  assert.deepEqual(events.map((e) => e.type), ['call', 'call', 'ask', 'stopped']);
  assert.deepEqual(events[1].record, {
    kind: 'import', callKind: 'func', iface: 'docs:adder/add@0.1.0', func: 'add', args: ['1', '2'], label: 'docs:adder/add@0.1.0.add(1, 2)',
  });
  assert.equal(events[3].expects, 'u32');
  assert.equal(events[3].unanswered, true);
});

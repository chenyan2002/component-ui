import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
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
const RESOURCE = 'public/resource.wasm';

test('inspect shows the exports, the imports that ask, and the types', () => {
  const { code, out } = cli('inspect', CALC);
  assert.equal(code, 0);
  assert.match(out, /^ {2}docs:calculator\/calculate@0\.1\.0\.eval-expression\(op: op, x: u32, y: u32\) -> u32$/m);
  assert.match(out, /^ {2}docs:adder\/add@0\.1\.0\.add\(a: u32, b: u32\) -> u32$/m);
  assert.match(out, /^ {2}op = enum \{ add \}$/m);
  // A method takes its instance first.
  assert.match(cli('inspect', RESOURCE).out, /^ {2}exports\/x\.get-a\(self: borrow<x>\) -> s32$/m);
});

test('a run stops at an import without an answer, and says what it expects', () => {
  const { code, out } = cli('call', CALC, EVAL);
  assert.equal(code, 2);
  assert.equal(out, [
    `› ${EVAL}`,
    '  ↳ docs:adder/add@0.1.0.add(1, 2)',
    '    ? u32',
    'stopped: No answer for docs:adder/add@0.1.0.add(1, 2)',
    '  expects u32',
    '  add the answer to the answers, e.g.:',
    '    docs:adder/add@0.1.0.add(1, 2) = <u32>',
    '',
  ].join('\n'));
});

test('answers are used in order, and show where they came from', () => {
  const { code, out } = cli('call', CALC, EVAL, EVAL, '--all', '--answer', 'docs:adder/add@0.1.0.add = 3', '--answer', 'docs:adder/add@0.1.0.add(1, 2) = 4');
  assert.equal(code, 0);
  assert.deepEqual(out.split('\n').filter((line) => line.includes('=')), [
    '    = 3  (--answer 1)', '  = 3', '    = 4  (--answer 2)', '  = 4',
  ]);
});

test('an answer for another import, or other arguments, stops the run, saying where to restart', () => {
  const other = cli('call', CALC, EVAL, '--answer', 'docs:adder/add@0.1.0.sub = 3');
  assert.equal(other.code, 1);
  assert.match(other.out, /stopped: --answer 1: the answer is for docs:adder\/add@0\.1\.0\.sub, but the guest called docs:adder\/add@0\.1\.0\.add\(1, 2\)\. The guest's calls changed here, .*remove this line and the ones after it/);
  const args = cli('call', CALC, EVAL, '--answer', 'docs:adder/add@0.1.0.add(2, 1) = 3');
  assert.equal(args.code, 1);
  assert.match(args.out, /the answer is for docs:adder\/add@0\.1\.0\.add\(2, 1\).*if these arguments vary between runs, remove them from the line instead/);
  const invalid = cli('call', CALC, EVAL, '--answer', 'docs:adder/add@0.1.0.add = "3"');
  assert.equal(invalid.code, 1);
  assert.match(invalid.out, /--answer 1: "3" is no u32/);
  const method = cli('call', CALC, EVAL, '--answer', '#borrow-y-1.get-a = 3');
  assert.equal(method.code, 1);
  assert.match(method.err, /Write a method as resource\.method\(#borrow-x-1, …\)/);
});

test('an answer that no import asked for means the guest\'s calls changed', () => {
  const { code, out } = cli('call', CALC, EVAL, '--answer', 'docs:adder/add@0.1.0.add = 3', '--answer', 'docs:adder/add@0.1.0.add = 4');
  assert.equal(code, 1);
  assert.match(out, /stopped: --answer 2: no import asked for this answer\. The guest's calls changed here/);
});

test('imports can be implemented in JavaScript', () => {
  const add = file('add.js', 'export function add(a, b) { return a + b; }');
  const { code, out } = cli('call', CALC, EVAL, '--imports', `docs:adder/add=${add}`);
  assert.equal(code, 0);
  assert.equal(out, `› ${EVAL}\n  = 3\n`);
});

test('methods take their instance first, and answers cover the run up to their end', () => {
  // As tests/e2e/dialog.spec.ts answers them in the UI. Answers apply in order until they run
  // out, so these include those of the happy path, as --save writes them.
  const answers = file('resource.txt', `// exports.test-imports()
imports/y.get-a(#borrow-y-1) = 10
imports/y.get-a(#borrow-y-1) = 20
imports/y.add(#y-1, 10) = #mock  // default
imports/y.get-a(#borrow-y-2) = 30
imports/y.get-a(#borrow-y-3) = 1
imports/y.get-a(#borrow-y-4) = 2
imports/y.get-a = 10
imports/y.get-a = 20
imports/y.add(#y-3, 20) = #mock  // default
imports/y.add(#y-4, 30) = #mock  // default
imports/y.get-a(#borrow-y-5) = 30
imports/y.get-a(#borrow-y-6) = 50
`);
  const { code, out } = cli('call', RESOURCE, 'new exports/x(5)', 'exports/x.get-a(#borrow-x-1)', 'exports.test-imports()', '--answers', answers, '--all');
  assert.equal(code, 0, out);
  const lines = out.split('\n');
  assert.deepEqual(lines.slice(0, 4), ['› new exports/x(5)', '  = #x-1', '› exports/x.get-a(#borrow-x-1)', '  = 5']);
  assert.ok(lines.includes('  ↳ imports/y.add(#y-1, 10)'));
  // The new mock, which `#mock` asked for, as --save writes it.
  assert.ok(lines.includes(`    = #mock-y-2  (${answers}:4)`));
  assert.ok(lines.includes(`    = 30  (${answers}:5)`));
  assert.equal(lines.at(-2), '  = ok');
});

// Replaces the first `?` of the answers file with the value.
function fill(path: string, value: string) {
  writeFileSync(path, readFileSync(path, 'utf8').replace(/ = \?  \/\/ expects .*$/m, ` = ${value}`));
}

test('--save writes a file that reproduces the run, with a ? where it stopped', () => {
  const saved = join(dir, 'saved.txt');
  const first = cli('call', RESOURCE, 'new exports/x(5)', 'exports.test-imports()', 'exports/x.get-a(#borrow-x-1)', '--save', saved);
  assert.equal(first.code, 2);
  assert.match(first.out, new RegExp(`replace the \\? at ${saved}:7 with the answer, and run again`));
  assert.equal(readFileSync(saved, 'utf8'), [
    '//! component-ui call public/resource.wasm --defaults eager',
    "//! imports implemented in JavaScript, whose calls aren't recorded: none",
    "//! WASI comes from the shim and isn't recorded; a run may differ where the guest uses it, e.g. its clocks or random numbers",
    '> new exports/x(5)  // = #x-1',
    '> exports.test-imports()',
    // An instance no answer returned: a mock's constructor needs no answer.
    '//! new imports/y(10) = #y-1',
    'imports/y.get-a(#borrow-y-1) = ?  // expects s32',
    // The calls the run didn't get to.
    '> exports/x.get-a(#borrow-x-1)',
    '',
  ].join('\n'));
  // The calls come from the file now; filling in each ? runs on to the next one.
  for (const value of ['10', '20', '30', '1', '2', '10', '20', '30']) {
    fill(saved, value);
    assert.equal(cli('call', RESOURCE, '--answers', saved, '--save', saved).code, 2);
  }
  fill(saved, '50');
  const last = cli('call', RESOURCE, '--answers', saved, '--save', saved);
  assert.equal(last.code, 0, last.out);
  const text = readFileSync(saved, 'utf8');
  // New mocks say the ids they get, and the happy path notes the instances it passed over.
  assert.match(text, /^imports\/y\.add\(#y-1, 10\) = #mock-y-2  \/\/ default; instances of y: #y-1 \(from new imports\/y\(10\)\)$/m);
  assert.match(text, /^imports\/y\.get-a\(#borrow-y-2\) = 30$/m);
  assert.match(text, /^> exports\.test-imports\(\)  \/\/ = ok$/m);
  // The file reproduces the run, and saves as it is.
  assert.equal(cli('call', RESOURCE, '--answers', saved, '--save', saved).code, 0);
  assert.equal(readFileSync(saved, 'utf8'), text);
  // A new mock that gets another id means the guest's calls changed.
  const edited = file('edited.txt', text.replace('= #mock-y-2', '= #mock-y-9'));
  const mock = cli('call', RESOURCE, '--answers', edited);
  assert.equal(mock.code, 1);
  assert.match(mock.out, /edited\.txt:\d+: the guest got #y-2, not #y-9, as the new mocks got other ids\. The guest's calls changed here/);
  // So does an answer the guest's checks fail on: the call traps, and its other answers are left.
  const trap = cli('call', RESOURCE, '--answers', file('trap.txt', text.replace('#borrow-y-1) = 20', '#borrow-y-1) = 21')));
  assert.equal(trap.code, 1, trap.out);
  assert.match(trap.out, /! wasm trap/);
  assert.match(trap.out, /trap\.txt:9: no import asked for this answer before the next call/);
  // A call that traps where the file ends exits with 3.
  const end = cli('call', RESOURCE, 'exports.test-imports()', '--answer', 'imports/y.get-a(#borrow-y-1) = !trap');
  assert.equal(end.code, 3, end.out);
  // Calls given on the command line must be the file's.
  const calls = cli('call', RESOURCE, 'exports.consume(#x-1)', '--answers', saved);
  assert.equal(calls.code, 1);
  assert.match(calls.err, /The calls differ from those of the answers/);
});

test('--defaults careful stops where there are instances to choose, and none at every import', () => {
  const answers = file('careful.txt', '> exports.test-imports()\nimports/y.get-a(#borrow-y-1) = 10\nimports/y.get-a(#borrow-y-1) = 20\n');
  const careful = cli('call', RESOURCE, '--answers', answers, '--defaults', 'careful');
  assert.equal(careful.code, 2);
  assert.match(careful.out, /stopped: No answer for imports\/y\.add\(#y-1, 10\)\n {2}expects y\n {2}instances of y: #y-1 \(from new imports\/y\(10\)\), or #mock/);
  // Answers must give their arguments.
  const unpinned = cli('call', RESOURCE, '--answers', file('unpinned.txt', '> exports.test-imports()\nimports/y.get-a = 10\n'), '--defaults', 'careful');
  assert.equal(unpinned.code, 1);
  assert.match(unpinned.err, /unpinned\.txt:2: --defaults careful needs the arguments of each answer/);
  const none = cli('call', CALC, EVAL, '--defaults', 'none', '--imports', `docs:adder/add=${file('add2.js', 'export function add(a, b) { return a + b; }')}`);
  assert.equal(none.code, 0);
  const host = cli('call', 'public/kv-store.wasm', 'fastly:compute/http-req/request@0.1.0.new()', '--defaults', 'none');
  assert.equal(host.code, 2);
  assert.match(host.out, /stopped: No answer for fastly:compute\/http-req\/request@0\.1\.0\.new\(\)/);
});

test('instances an answer or an argument could use are listed', () => {
  const owned = cli('call', RESOURCE, 'new exports/x(5)', 'exports.consume(#x-2)');
  assert.equal(owned.code, 1);
  assert.match(owned.err, /instances of x: #x-1 \(from new exports\/x\(5\)\)/);
});

test('a list<u8> of text shows as b"…", and answers may use it', () => {
  const { out } = cli('call', 'public/kv-store.wasm', 'fastly:compute/http-req/request@0.1.0.new()',
    'fastly:compute/http-req/request@0.1.0.insert-header(#borrow-request-1, "x", b"MISS\\u{0}")');
  assert.match(out, /insert-header\(#borrow-request-1, "x", b"MISS\\u\{0\}"\)/);
});

test('calls that the component doesn\'t have, or with invalid arguments, fail', () => {
  const missing = cli('call', CALC, 'docs:calculator/calculate.eval-expression(add, 1, 2)');
  assert.equal(missing.code, 1);
  assert.match(missing.err, /No export docs:calculator\/calculate\.eval-expression; did you mean docs:calculator\/calculate@0\.1\.0\.eval-expression\?/);
  const args = cli('call', CALC, 'docs:calculator/calculate@0.1.0.eval-expression(add, 1)');
  assert.equal(args.code, 1);
  const unborrowed = cli('call', RESOURCE, 'new exports/x(5)', 'exports/x.get-a(#x-1)');
  assert.equal(unborrowed.code, 1);
  assert.match(unborrowed.err, /Expected a handle like #borrow-x-1, got #x-1/);
});

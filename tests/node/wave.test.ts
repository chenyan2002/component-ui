import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as WIT from '../../src/wit';
import { INVALID, NEW_MOCK, parseDraft, TextDraft } from '../../src/draft';
import { ResourceRegistry } from '../../src/resources';
import { canonicalWave, formatValue, parseWave } from '../../src/wave';

// WAVE is written and read by crates/bindgen, with proxy-component's wasm-wave.

const registry = new ResourceRegistry();

function format(t: WIT.Type, value: any): string {
  return formatValue(registry, t, value);
}

// Reads the text as a value of the type, as the UI would take it from a form.
function parse(t: WIT.Type, text: string): any {
  const value = parseDraft(t, parseWave(t, text), registry);
  assert.notEqual(value, INVALID, `${text} is no valid ${t.name}`);
  return value;
}

const point = WIT.Record({ x: WIT.S32, label: WIT.Opt(WIT.String) });

test('values are written as proxy-component writes them', () => {
  // Fields that are `none` are left out.
  assert.equal(format(point, { x: 1, label: 'a' }), '{x: 1, label: some("a")}');
  assert.equal(format(point, { x: 1, label: null }), '{x: 1}');
  assert.equal(format(WIT.Record({ label: WIT.Opt(WIT.String) }), { label: null }), '{:}');
  // Both quotes are escaped, and so are characters Rust doesn't print as they are.
  assert.equal(format(WIT.String, `it's "q"\n`), String.raw`"it\'s \"q\"\n"`);
  assert.equal(format(WIT.String, 'é​'), String.raw`"e\u{301}\u{200b}"`);
  assert.equal(format(WIT.Char, '"'), String.raw`'\"'`);
  // Floats have no exponent, and an `f32` its shortest digits.
  assert.equal(format(WIT.F64, 1e21), '1000000000000000000000');
  assert.equal(format(WIT.F64, 1e-7), '0.0000001');
  assert.equal(format(WIT.F32, 0.1), '0.1');
  assert.deepEqual([NaN, Infinity, -Infinity, -0].map((v) => format(WIT.F64, v)), ['nan', 'inf', '-inf', '-0']);
  assert.equal(format(WIT.U64, 2n ** 64n - 1n), '18446744073709551615');
  assert.equal(format(WIT.S64, -(2n ** 63n)), '-9223372036854775808');
  assert.equal(format(WIT.Vec(WIT.U8), new Uint8Array([1, 2])), '[1, 2]');
  assert.equal(format(WIT.Vec(WIT.U16), [77, 73]), '[77, 73]');
  assert.equal(format(WIT.Opt(WIT.Opt(WIT.U32)), { tag: 'some', val: null }), 'some(none)');
  assert.equal(format(WIT.Result(WIT.Null, WIT.String), { tag: 'ok' }), 'ok');
  assert.equal(format(WIT.Result(WIT.Null, WIT.String), { tag: 'err', val: 'x' }), 'err("x")');
  // Cases that are keywords are escaped.
  assert.equal(format(WIT.Variant({ none: WIT.Null, some: WIT.U8 }), { tag: 'some', val: 3 }), '%some(3)');
  assert.equal(format(WIT.Enum(['true', 'b']), 'true'), '%true');
  assert.equal(format(WIT.Flags(['read', 'write']), { read: true, write: false }), '{read}');
  assert.equal(format(WIT.Tuple([WIT.Bool, WIT.Char]), [true, 'x']), "(true, 'x')");
});

test('values that don\'t match their type are shown as invalid', () => {
  assert.equal(format(WIT.U32, 3.5), '<invalid u32>');
  assert.equal(format(WIT.U8, 256), '<invalid u8>');
  assert.equal(format(WIT.Bool, 'yes'), '<invalid bool>');
  assert.equal(format(WIT.Char, 'ab'), '<invalid char>');
  assert.equal(format(WIT.Enum(['a']), 'b'), '<invalid enum { a }>');
});

test('written values read back as the same values', () => {
  const cases: Array<[WIT.Type, any]> = [
    [point, { x: -5, label: 'a, b)' }],
    [point, { x: 0, label: null }],
    [WIT.String, `it's "q"\n\u{1F44B}é`],
    [WIT.F64, 1e21],
    [WIT.F64, -0],
    [WIT.F64, NaN],
    [WIT.F32, 0.1],
    [WIT.U64, 2n ** 64n - 1n],
    [WIT.Vec(WIT.U8), new Uint8Array([0xff, 0])],
    [WIT.Vec(WIT.U8), new TextEncoder().encode('hi')],
    [WIT.Opt(WIT.Opt(WIT.U32)), { tag: 'some', val: null }],
    [WIT.Opt(WIT.Opt(WIT.U32)), { tag: 'some', val: 7 }],
    [WIT.Result(WIT.Null, WIT.String), { tag: 'ok', val: null }],
    [WIT.Result(WIT.U8, WIT.String), { tag: 'err', val: 'bad' }],
    [WIT.Variant({ none: WIT.Null, some: WIT.U8 }), { tag: 'none', val: null }],
    [WIT.Flags(['read', 'write']), { read: false, write: true }],
    [WIT.Vec(WIT.Tuple([WIT.Enum(['true', 'b']), WIT.Char])), [['true', "'"], ['b', '\\']]],
  ];
  for (const [t, value] of cases) {
    const text = format(t, value);
    assert.equal(format(t, parse(t, text)), text, `${t.name}: ${text}`);
  }
});

test('WAVE that only reads, e.g. with exponents or without the none fields', () => {
  assert.deepEqual(parse(point, '{x: 2}'), { x: 2, label: null });
  assert.deepEqual(parse(point, '{label: some("z"), x: 2}'), { x: 2, label: 'z' });
  assert.equal(parse(WIT.F64, '1.5e3'), 1500);
  assert.equal(parse(WIT.F64, 'inf'), Infinity);
  assert.equal(parse(WIT.String, '"\\u{1F44B}"'), '\u{1F44B}');
  // FIXME: wasm-wave ignores fields the record doesn't have, rather than reject them; see
  // docs/proxy-component-gap.md. These should throw once it doesn't.
  assert.deepEqual(parse(point, '{x: 1, y: 2}'), { x: 1, label: null });
  // FIXME: so a misspelled optional field reads as `none`.
  assert.deepEqual(parse(point, '{x: 1, lable: some("a")}'), { x: 1, label: null });
});

test('text that isn\'t WAVE of the type is rejected', () => {
  assert.throws(() => parseWave(WIT.U32, '"a"'), /invalid value type|expected/i);
  assert.throws(() => parseWave(WIT.U8, '300'));
  assert.throws(() => parseWave(WIT.Enum(['a']), 'b'));
});

test('handles select instances by id', () => {
  const rec = WIT.Rec();
  const y = WIT.Resource('Y', {}, 'imports');
  rec.fill(y);
  const instance = registry.add(y, {}, 'test', false);
  assert.equal(instance.id, 'y-1');
  assert.equal(format(WIT.Owned(rec), instance.obj), '#y-1');
  assert.equal(format(WIT.Borrow(rec), instance.obj), '#borrow-y-1');
  assert.equal(format(WIT.Owned(rec), {}), '#<y>');
  assert.equal(parse(WIT.Owned(rec), '#y-1'), instance.obj);
  assert.equal(parse(WIT.Borrow(rec), '#borrow-y-1'), instance.obj);
  // As in proxy-component, only a borrow has the prefix, and the label names the resource.
  for (const [t, text] of [
    [WIT.Borrow(rec), '#y-1'], [WIT.Owned(rec), '#borrow-y-1'], [WIT.Borrow(rec), '#borrowed-y-1'],
    [WIT.Owned(rec), '#z-1'], [WIT.Borrow(rec), '#borrow-z-1'], [WIT.Owned(rec), '#y'], [WIT.Owned(rec), '#y-x'],
  ] as const) {
    assert.throws(() => parseWave(t, text), /Expected a handle like #(borrow-)?y-1/, text);
  }
  // `#mock` stands for a new mock, which only resources the host implements can have.
  assert.equal((parseWave(WIT.Owned(rec), '#mock') as TextDraft).text, NEW_MOCK);
  assert.equal(parseDraft(WIT.Owned(rec), parseWave(WIT.Owned(rec), '#y-2'), registry), INVALID);
});

test('labels of resources whose names look like prefixes', () => {
  // A resource named `borrow` has ids like `borrow-1`, and one named `host-y` ids like
  // `host-y-1`, which the host's instances of a `y` have too.
  const borrow = WIT.Rec();
  borrow.fill(WIT.Resource('Borrow', {}, 'imports'));
  const hostY = WIT.Rec();
  hostY.fill(WIT.Resource('HostY', {}, 'imports'));
  const y = WIT.Rec();
  y.fill(WIT.Resource('Y', {}, 'imports'));
  const id = (t: WIT.Type, text: string) => (parseWave(t, text) as TextDraft).text;
  assert.equal(id(WIT.Owned(borrow), '#borrow-1'), 'borrow-1');
  assert.equal(id(WIT.Borrow(borrow), '#borrow-borrow-1'), 'borrow-1');
  assert.throws(() => parseWave(WIT.Borrow(borrow), '#borrow-1'));
  assert.equal(id(WIT.Owned(hostY), '#host-y-1'), 'host-y-1');
  assert.equal(id(WIT.Owned(y), '#host-y-1'), 'host-y-1');
  assert.equal(id(WIT.Borrow(y), '#borrow-host-y-1'), 'host-y-1');
});

test('#mock-y-2 is a new mock, which is to get the id y-2', () => {
  const y = WIT.Rec();
  y.fill(WIT.Resource('Y', {}, 'imports'));
  const mockX = WIT.Rec();
  mockX.fill(WIT.Resource('MockX', {}, 'imports'));
  const id = (t: WIT.Type, text: string) => (parseWave(t, text) as TextDraft).text;
  assert.equal(id(WIT.Owned(y), '#mock-y-2'), NEW_MOCK);
  assert.equal(id(WIT.Owned(y), '#mock'), NEW_MOCK);
  // Of a resource named `mock-x`, `#mock-x-1` is an instance, and `#mock-mock-x-1` a new mock.
  assert.equal(id(WIT.Owned(mockX), '#mock-x-1'), 'mock-x-1');
  assert.equal(id(WIT.Owned(mockX), '#mock-mock-x-1'), NEW_MOCK);
  // The id must be one of the resource's.
  assert.throws(() => parseWave(WIT.Owned(y), '#mock-x-1'), /Expected a handle like #y-1/);
});

test('a list<u8> of text shows as b"…", and reads back', () => {
  const bytes = WIT.Vec(WIT.U8);
  const encode = (text: string) => new TextEncoder().encode(text);
  // Text, with tabs, newlines and NULs, which strings in WAVE escape.
  assert.equal(format(bytes, encode('MISS\0')), String.raw`b"MISS\u{0}"`);
  assert.equal(format(bytes, encode('say "hi"\n')), String.raw`b"say \"hi\"\n"`);
  assert.equal(format(WIT.Tuple([bytes, WIT.Opt(WIT.U32)]), [encode('a'), null]), '(b"a", none)');
  // Anything else is a list: other control characters, bytes that aren't UTF-8, and no bytes.
  assert.equal(format(bytes, new Uint8Array([27, 91])), '[27, 91]');
  assert.equal(format(bytes, new Uint8Array([0xff, 0x41])), '[255, 65]');
  assert.equal(format(bytes, new Uint8Array([])), '[]');
  assert.deepEqual(parse(bytes, String.raw`b"MISS\u{0}"`), encode('MISS\0'));
  assert.deepEqual(parse(bytes, 'b"é"'), encode('é'));
  // `b"…"` is only bytes outside strings, and where a value starts.
  assert.equal(parse(WIT.String, '"b\\"x"'), 'b"x');
  assert.deepEqual(parse(WIT.Tuple([bytes, WIT.String]), '(b"(", "b\\"")'), [encode('('), 'b"']);
  assert.throws(() => parseWave(WIT.String, 'b"x"'));
  assert.equal(canonicalWave(bytes, 'b"hi"'), '[104, 105]');
});

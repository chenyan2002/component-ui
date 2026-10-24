import * as WIT from './wit';
import { BoolDraft, CaseDraft, Draft, FieldsDraft, isBytes, ListDraft, NEW_MOCK, OptDraft, TextDraft, toHex } from './draft';
import { wave } from './obj/bindgen';
import type { TypeNode, ValueNode } from './obj/interfaces/local-bindgen-wave';
import { ResourceRegistry, thrownType } from './resources';

// Reads and writes JS values, as jco represents them, in WAVE, the WebAssembly Value Encoding:
// https://github.com/bytecodealliance/wasm-tools/tree/main/crates/wasm-wave
// The text itself is read and written by crates/bindgen, with proxy-component's fork of
// wasm-wave, so both tools encode values alike. The fork writes a resource handle as `#label`;
// an instance shows by its id, e.g. `#x-1`, and a borrow of it as `#borrow-x-1`.
//
// Types and values cross into bindgen as lists of nodes, which refer to the nodes they contain
// by index; a type or value is the last of its nodes.

// The type nodes of each type, which don't change.
const typeNodes = new WeakMap<WIT.Type, TypeNode[]>();

function typeNodesOf(t: WIT.Type): TypeNode[] {
  let nodes = typeNodes.get(t);
  if (!nodes) {
    nodes = [];
    t.accept(new ToTypeNodes(nodes), null);
    typeNodes.set(t, nodes);
  }
  return nodes;
}

// A payload type, which is none for `_`.
function payloadType(t: WIT.Type): WIT.Type | undefined {
  return t instanceof WIT.NullClass ? undefined : t;
}

// Appends the nodes of a type, those it contains first, and returns its index.
class ToTypeNodes extends WIT.Visitor<null, number> {
  constructor(private readonly nodes: TypeNode[]) {
    super();
  }
  public visitType<T>(t: WIT.Type<T>, _d: null): number {
    throw new Error(`WAVE has no type ${t.name}`);
  }
  public visitBool(_t: WIT.BoolClass, _d: null): number {
    return this.push({ tag: 'bool' });
  }
  public visitString(_t: WIT.StringClass, _d: null): number {
    return this.push({ tag: 'string' });
  }
  public visitChar(_t: WIT.CharClass, _d: null): number {
    return this.push({ tag: 'char' });
  }
  public visitFixedNat(t: WIT.FixedNatClass, _d: null): number {
    return this.push({ tag: `u${t._bits}` } as TypeNode);
  }
  public visitFixedInt(t: WIT.FixedIntClass, _d: null): number {
    return this.push({ tag: `s${t._bits}` } as TypeNode);
  }
  public visitFixedFloat(t: WIT.FixedFloatClass, _d: null): number {
    return this.push({ tag: `f${t._bits}` } as TypeNode);
  }
  public visitOpt(_t: WIT.OptClass, ty: WIT.Type, _d: null): number {
    return this.push({ tag: 'option', val: this.child(ty) });
  }
  public visitVec(_t: WIT.VecClass, ty: WIT.Type, _d: null): number {
    return this.push({ tag: 'list', val: this.child(ty) });
  }
  public visitRecord(_t: WIT.RecordClass, fields: Record<string, WIT.Type>, _d: null): number {
    return this.push({ tag: 'record', val: Object.entries(fields).map(([name, ty]) => [name, this.child(ty)]) });
  }
  public visitFlags(t: WIT.FlagsClass, _fields: Record<string, WIT.Type>, _d: null): number {
    return this.push({ tag: 'flags', val: t._flags });
  }
  public visitTuple(_t: WIT.TupleClass, components: WIT.Type[], _d: null): number {
    return this.push({ tag: 'tuple', val: new Uint32Array(components.map((ty) => this.child(ty))) });
  }
  public visitVariant(t: WIT.VariantClass, fields: Record<string, WIT.Type>, _d: null): number {
    const payload = (ty: WIT.Type) => {
      const some = payloadType(ty);
      return some && this.child(some);
    };
    if (t instanceof WIT.ResultClass) {
      return this.push({ tag: 'result', val: [payload(fields.ok), payload(fields.err)] });
    }
    return this.push({ tag: 'variant', val: Object.entries(fields).map(([name, ty]) => [name, payload(ty)]) });
  }
  public visitEnum(_t: WIT.EnumClass, tags: string[], _d: null): number {
    return this.push({ tag: 'enum', val: tags });
  }
  public visitRec(_t: WIT.RecClass, ty: WIT.Type, d: null): number {
    return ty.accept(this, d);
  }
  public visitResource(_t: WIT.ResourceClass, _d: null): number {
    return this.push({ tag: 'handle' });
  }
  public visitOwned(_t: WIT.OwnedClass, _ty: WIT.Type, _d: null): number {
    return this.push({ tag: 'handle' });
  }
  public visitBorrow(_t: WIT.BorrowClass, _ty: WIT.Type, _d: null): number {
    return this.push({ tag: 'handle' });
  }
  private child(ty: WIT.Type): number {
    return ty.accept(this, null);
  }
  private push(node: TypeNode): number {
    return this.nodes.push(node) - 1;
  }
}

function integer(bits: number, signed: boolean, v: any): number | bigint {
  if (bits === 64) {
    if (typeof v === 'bigint' || Number.isInteger(v)) {
      const n = BigInt(v);
      if (n === (signed ? BigInt.asIntN(64, n) : BigInt.asUintN(64, n))) {
        return n;
      }
    }
  } else if (Number.isInteger(v)) {
    const [min, max] = signed ? [-(2 ** (bits - 1)), 2 ** (bits - 1) - 1] : [0, 2 ** bits - 1];
    if (v >= min && v <= max) {
      return v;
    }
  }
  throw new Error(`${v} is no ${signed ? 's' : 'u'}${bits}`);
}

// Appends the nodes of a JS value of the type, those it contains first, and returns its index.
// A value that doesn't match the type throws, rather than be converted as jco would.
class ToValueNodes extends WIT.Visitor<any, number> {
  constructor(private readonly registry: ResourceRegistry, private readonly nodes: ValueNode[]) {
    super();
  }
  public visitType<T>(t: WIT.Type<T>, _v: any): number {
    throw new Error(`WAVE has no type ${t.name}`);
  }
  public visitBool(_t: WIT.BoolClass, v: any): number {
    return this.push({ tag: 'bool', val: this.check(v, typeof v === 'boolean') });
  }
  public visitString(_t: WIT.StringClass, v: any): number {
    return this.push({ tag: 'string', val: this.check(v, typeof v === 'string') });
  }
  public visitChar(_t: WIT.CharClass, v: any): number {
    return this.push({ tag: 'char', val: this.check(v, typeof v === 'string' && [...v].length === 1) });
  }
  public visitFixedNat(t: WIT.FixedNatClass, v: any): number {
    return this.push({ tag: `u${t._bits}`, val: integer(t._bits, false, v) } as ValueNode);
  }
  public visitFixedInt(t: WIT.FixedIntClass, v: any): number {
    return this.push({ tag: `s${t._bits}`, val: integer(t._bits, true, v) } as ValueNode);
  }
  public visitFixedFloat(t: WIT.FixedFloatClass, v: any): number {
    return this.push({ tag: `f${t._bits}`, val: this.check(v, typeof v === 'number') } as ValueNode);
  }
  public visitOpt(t: WIT.OptClass, ty: WIT.Type, v: any): number {
    // Only `option<option<T>>` uses the tagged representation, to tell the layers apart.
    if (t.maybe_null()) {
      return this.push({ tag: 'option', val: v?.tag === 'some' ? ty.accept(this, v.val) : undefined });
    }
    return this.push({ tag: 'option', val: v === null || v === undefined ? undefined : ty.accept(this, v) });
  }
  public visitVec(_t: WIT.VecClass, ty: WIT.Type, v: any): number {
    // Lists of numbers may be typed arrays, e.g. a `Uint8Array` for `list<u8>`.
    const items = Array.from(this.check(v, typeof v?.length === 'number') as ArrayLike<any>, (item) => ty.accept(this, item));
    return this.push({ tag: 'list', val: new Uint32Array(items) });
  }
  public visitRecord(_t: WIT.RecordClass, fields: Record<string, WIT.Type>, v: any): number {
    const values = Object.entries(fields).map(([name, ty]) => ty.accept(this, v[WIT.jsFieldName(name)]));
    return this.push({ tag: 'record', val: new Uint32Array(values) });
  }
  public visitFlags(t: WIT.FlagsClass, _fields: Record<string, WIT.Type>, v: any): number {
    return this.push({ tag: 'flags', val: t._flags.filter((name) => v[WIT.jsFieldName(name)]) });
  }
  public visitTuple(_t: WIT.TupleClass, components: WIT.Type[], v: any): number {
    return this.push({ tag: 'tuple', val: new Uint32Array(components.map((ty, i) => ty.accept(this, v[i]))) });
  }
  public visitVariant(t: WIT.VariantClass, fields: Record<string, WIT.Type>, v: any): number {
    if (!Object.prototype.hasOwnProperty.call(fields, v?.tag)) {
      throw new Error(`${v?.tag} is no case of ${t.name}`);
    }
    const ty = payloadType(fields[v.tag]);
    const payload = ty && ty.accept(this, v.val);
    if (t instanceof WIT.ResultClass) {
      return this.push({ tag: 'result', val: v.tag === 'ok' ? { tag: 'ok', val: payload } : { tag: 'err', val: payload } });
    }
    return this.push({ tag: 'variant', val: [v.tag, payload] });
  }
  public visitEnum(t: WIT.EnumClass, tags: string[], v: any): number {
    if (!tags.includes(v)) {
      throw new Error(`${v} is no case of ${t.name}`);
    }
    return this.push({ tag: 'enum', val: v });
  }
  public visitRec(_t: WIT.RecClass, ty: WIT.Type, v: any): number {
    return ty.accept(this, v);
  }
  public visitResource(t: WIT.ResourceClass, v: any): number {
    return this.handle(v, t);
  }
  public visitOwned(t: WIT.OwnedClass, _ty: WIT.Type, v: any): number {
    return this.handle(v, t.resource);
  }
  public visitBorrow(t: WIT.BorrowClass, _ty: WIT.Type, v: any): number {
    return this.handle(v, t.resource, true);
  }
  private handle(obj: unknown, resource: WIT.ResourceClass, borrowed = false): number {
    return this.push({ tag: 'handle', val: formatHandle(this.registry, obj, resource, borrowed).slice(1) });
  }
  private check<T>(v: T, ok: boolean): T {
    if (!ok) {
      throw new Error(`Unexpected value ${v}`);
    }
    return v;
  }
  private push(node: ValueNode): number {
    return this.nodes.push(node) - 1;
  }
}

// A resource instance by its id, e.g. `#x-1`, or `#borrow-x-1` for a borrow, including a method's
// receiver; `#<X>` for an object the table doesn't track.
export function formatHandle(registry: ResourceRegistry, obj: unknown, resource?: WIT.ResourceClass, borrowed = false): string {
  const id = registry.idOf(obj) ?? `<${resource?.witName ?? 'unknown'}>`;
  return `#${borrowed ? 'borrow-' : ''}${id}`;
}

export function formatValue(registry: ResourceRegistry, t: WIT.Type, value: any): string {
  if (t instanceof WIT.NullClass) {
    return '_';
  }
  try {
    const nodes: ValueNode[] = [];
    t.accept(new ToValueNodes(registry, nodes), value);
    return wave.format(typeNodesOf(t), nodes);
  } catch {
    // A value that doesn't match its type, e.g. from an import implemented in JavaScript.
    return `<invalid ${t.name}>`;
  }
}

// Formats each call argument, which has the type of the function's parameter.
export function formatArgList(registry: ResourceRegistry, func: WIT.FuncClass | undefined, args: any[]): string[] {
  return args.map((arg, i) => {
    const ty = func?._args[i]?.[1];
    return ty ? formatValue(registry, ty, arg) : `${arg}`;
  });
}

// Formats what a call returned: the value of the function's result type, empty if it has none.
// jco returns the `ok` payload of a `result`, shown as `ok(…)`.
export function formatResult(registry: ResourceRegistry, func: WIT.FuncClass, value: any): string {
  const [type] = func._ret;
  if (!type) {
    return '';
  }
  return formatValue(registry, type, thrownType(func) === undefined ? value : { tag: 'ok', val: value });
}

// Formats the `err` payload jco throws for a function returning a `result`.
export function formatThrown(registry: ResourceRegistry, func: WIT.FuncClass, payload: any): string {
  return formatValue(registry, func._ret[0], { tag: 'err', val: payload });
}

// Whether `id` can be the id of an instance of the resource, e.g. `x-1`, or `host-x-1` for the
// host's when the guest also implements an `x`.
function isIdOf(id: string, resource: WIT.ResourceClass): boolean {
  const name = `${resource.witName}-`;
  return [id, id.replace(/^host-/, '')].some((rest) => rest.startsWith(name) && /^\d+$/.test(rest.slice(name.length)));
}

// The label of a mock, which no instance id can be: ids end in a number.
const MOCK_LABEL = 'mock';

function floatText(v: number): string {
  if (Number.isNaN(v)) {
    return 'nan';
  }
  if (!Number.isFinite(v)) {
    return v > 0 ? 'inf' : '-inf';
  }
  return Object.is(v, -0) ? '-0' : `${v}`;
}

type NodeValue<K extends ValueNode['tag']> = Extract<ValueNode, { tag: K }> extends { val: infer V } ? V : never;

// The draft of a value read from its nodes, as if the user had entered it.
class ToDraft extends WIT.Visitor<number, Draft> {
  constructor(private readonly nodes: ValueNode[]) {
    super();
  }
  public visitType<T>(t: WIT.Type<T>, _i: number): Draft {
    throw new Error(`WAVE has no type ${t.name}`);
  }
  public visitNull(_t: WIT.NullClass, _i: number): Draft {
    return { kind: 'null' };
  }
  public visitBool(_t: WIT.BoolClass, i: number): Draft {
    return { kind: 'bool', checked: this.node(i, 'bool') } satisfies BoolDraft;
  }
  public visitString(_t: WIT.StringClass, i: number): Draft {
    return this.text(this.node(i, 'string'));
  }
  public visitChar(_t: WIT.CharClass, i: number): Draft {
    return this.text(this.node(i, 'char'));
  }
  public visitNumber<T>(_t: WIT.Type<T>, i: number): Draft {
    const v = this.nodes[i].val as number | bigint;
    return this.text(typeof v === 'number' ? floatText(v) : `${v}`);
  }
  public visitOpt(_t: WIT.OptClass, ty: WIT.Type, i: number): Draft {
    const some = this.node(i, 'option');
    return { kind: 'opt', some: some !== undefined, inner: some === undefined ? undefined : ty.accept(this, some) } satisfies OptDraft;
  }
  public visitVec(_t: WIT.VecClass, ty: WIT.Type, i: number): Draft {
    const items = Array.from(this.node(i, 'list'));
    if (isBytes(ty)) {
      const bytes = Uint8Array.from(items, (item) => this.node(item, 'u8'));
      try {
        return { kind: 'bytes', text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'text' };
      } catch {
        return { kind: 'bytes', text: toHex(bytes), encoding: 'hex' };
      }
    }
    return { kind: 'list', length: `${items.length}`, items: items.map((item) => ty.accept(this, item)) } satisfies ListDraft;
  }
  public visitRecord(_t: WIT.RecordClass, fields: Record<string, WIT.Type>, i: number): Draft {
    const values = this.node(i, 'record');
    return { kind: 'fields', fields: Object.values(fields).map((ty, j) => ty.accept(this, values[j])) } satisfies FieldsDraft;
  }
  public visitFlags(t: WIT.FlagsClass, _fields: Record<string, WIT.Type>, i: number): Draft {
    const set = this.node(i, 'flags');
    return { kind: 'fields', fields: t._flags.map((name) => ({ kind: 'bool', checked: set.includes(name) })) } satisfies FieldsDraft;
  }
  public visitTuple(_t: WIT.TupleClass, components: WIT.Type[], i: number): Draft {
    const values = this.node(i, 'tuple');
    return { kind: 'fields', fields: components.map((ty, j) => ty.accept(this, values[j])) } satisfies FieldsDraft;
  }
  public visitVariant(t: WIT.VariantClass, fields: Record<string, WIT.Type>, i: number): Draft {
    const [tag, payload] = t instanceof WIT.ResultClass ? this.resultCase(i) : this.node(i, 'variant');
    const cases = Object.entries(fields);
    const index = cases.findIndex(([name]) => name === tag);
    const ty = cases[index][1];
    return { kind: 'case', index, payload: payload === undefined ? { kind: 'null' } : ty.accept(this, payload) } satisfies CaseDraft;
  }
  public visitEnum(_t: WIT.EnumClass, tags: string[], i: number): Draft {
    return { kind: 'case', index: tags.indexOf(this.node(i, 'enum')) } satisfies CaseDraft;
  }
  public visitRec(_t: WIT.RecClass, ty: WIT.Type, i: number): Draft {
    return ty.accept(this, i);
  }
  public visitResource(t: WIT.ResourceClass, i: number): Draft {
    return this.handle(i, t);
  }
  public visitOwned(t: WIT.OwnedClass, _ty: WIT.Type, i: number): Draft {
    return this.handle(i, t.resource);
  }
  public visitBorrow(t: WIT.BorrowClass, _ty: WIT.Type, i: number): Draft {
    return this.handle(i, t.resource, true);
  }
  // Selects the instance by its id. As in proxy-component, the label names the resource, and
  // has the `borrow-` prefix exactly for a borrow: `#x-1`, or `#borrow-x-1`. `#mock` is a new mock.
  private handle(i: number, resource: WIT.ResourceClass, borrowed = false): Draft {
    const label = this.node(i, 'handle');
    if (label === MOCK_LABEL) {
      return this.text(NEW_MOCK);
    }
    const prefix = borrowed ? 'borrow-' : '';
    const id = label.startsWith(prefix) ? label.slice(prefix.length) : '';
    if (!isIdOf(id, resource)) {
      throw new Error(`Expected a handle like #${prefix}${resource.witName}-1, got #${label}`);
    }
    return this.text(id);
  }
  private resultCase(i: number): [string, number | undefined] {
    const result = this.node(i, 'result');
    return [result.tag, result.val];
  }
  private text(text: string): TextDraft {
    return { kind: 'text', text };
  }
  // The payload of node `i`, which bindgen read as a value of the type with the given tag.
  private node<K extends ValueNode['tag']>(i: number, tag: K): NodeValue<K> {
    const node = this.nodes[i];
    if (node?.tag !== tag) {
      throw new Error(`Expected a ${tag} value`);
    }
    return (node as unknown as { val: NodeValue<K> }).val;
  }
}

// Reads a value of the type as the draft a user would enter, so that `parseDraft` turns it into
// the JS value: instances are checked and mocks created as for the UI's input. Throws if the
// text isn't WAVE of the type.
export function parseWave(t: WIT.Type, text: string): Draft {
  const nodes = wave.parse(typeNodesOf(t), text);
  return t.accept(new ToDraft(nodes), nodes.length - 1);
}

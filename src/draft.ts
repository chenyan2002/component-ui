import * as IDL from './wit';

// A draft is the editable state of an argument form, shaped after its WIT type.
interface DraftBase {
  error?: string;
  // Set when Random filled this value, so the next Random may replace it.
  auto?: boolean;
}
export interface NullDraft extends DraftBase { kind: 'null' }
// Strings, numbers and resource ids are edited as text.
export interface TextDraft extends DraftBase { kind: 'text'; text: string }
export interface BoolDraft extends DraftBase { kind: 'bool'; checked: boolean }
export interface OptDraft extends DraftBase { kind: 'opt'; some: boolean; inner?: Draft }
export interface ListDraft extends DraftBase { kind: 'list'; length: string; items: Draft[] }
// Records and tuples, in declaration order.
export interface FieldsDraft extends DraftBase { kind: 'fields'; fields: Draft[] }
// Variants and enums; `index` is -1 until a case is selected.
export interface CaseDraft extends DraftBase { kind: 'case'; index: number; payload?: Draft }
export type Draft = NullDraft | TextDraft | BoolDraft | OptDraft | ListDraft | FieldsDraft | CaseDraft;

export const INVALID = Symbol('invalid');

const MAX_LIST_LENGTH = 100;

class Init extends IDL.Visitor<null, Draft> {
  public visitType<T>(_t: IDL.Type<T>, _d: null): Draft {
    return { kind: 'text', text: '' };
  }
  public visitNull(_t: IDL.NullClass, _d: null): Draft {
    return { kind: 'null' };
  }
  public visitBool(_t: IDL.BoolClass, _d: null): Draft {
    return { kind: 'bool', checked: false };
  }
  // Options, lists and variants create their children lazily, which keeps recursive types finite.
  public visitOpt(_t: IDL.OptClass, _ty: IDL.Type, _d: null): Draft {
    return { kind: 'opt', some: false };
  }
  public visitVec(_t: IDL.VecClass, _ty: IDL.Type, _d: null): Draft {
    return { kind: 'list', length: '', items: [] };
  }
  public visitRecord(_t: IDL.RecordClass, fields: Record<string, IDL.Type>, _d: null): Draft {
    return { kind: 'fields', fields: Object.values(fields).map(initDraft) };
  }
  public visitTuple(_t: IDL.TupleClass, components: IDL.Type[], _d: null): Draft {
    return { kind: 'fields', fields: components.map(initDraft) };
  }
  public visitVariant(_t: IDL.VariantClass, _fields: Record<string, IDL.Type>, _d: null): Draft {
    return { kind: 'case', index: -1 };
  }
  public visitEnum(_t: IDL.EnumClass, _tags: Array<string>, _d: null): Draft {
    return { kind: 'case', index: -1 };
  }
  public visitRec(_t: IDL.RecClass, ty: IDL.Type, d: null): Draft {
    return ty.accept(this, d);
  }
}

export function initDraft(t: IDL.Type): Draft {
  return t.accept(new Init(), null);
}

export function setSome(d: OptDraft, ty: IDL.Type, some: boolean) {
  d.some = some;
  // Keep the inner value around so unchecking and rechecking doesn't lose input.
  if (some && !d.inner) {
    d.inner = initDraft(ty);
  }
}

export function resizeList(d: ListDraft, ty: IDL.Type, length: string) {
  const n = Math.min(Math.max(Math.floor(Number(length)) || 0, 0), MAX_LIST_LENGTH);
  d.length = length === '' ? '' : `${n}`;
  d.items = Array.from({ length: n }, (_, i) => d.items[i] ?? initDraft(ty));
}

// `ty` is the payload type of the selected case; enums have none.
export function selectCase(d: CaseDraft, index: number, ty?: IDL.Type) {
  d.index = index;
  d.payload = ty ? initDraft(ty) : undefined;
  d.error = undefined;
}

function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}

function randomNumber(signed: boolean): number {
  const num = randomInt(100);
  return signed && Math.random() < 0.5 ? -num : num;
}

// Fills empty (or previously randomized) values in place, leaving user input alone.
class Randomize extends IDL.Visitor<Draft, void> {
  public visitType<T>(_t: IDL.Type<T>, _d: Draft): void {}
  public visitString(_t: IDL.StringClass, d: Draft): void {
    this.fillText(d as TextDraft, () => Math.random().toString(36).substring(6));
  }
  public visitFixedNat(_t: IDL.FixedNatClass, d: Draft): void {
    this.fillText(d as TextDraft, () => `${randomNumber(false)}`);
  }
  public visitFixedInt(_t: IDL.FixedIntClass, d: Draft): void {
    this.fillText(d as TextDraft, () => `${randomNumber(true)}`);
  }
  public visitFixedFloat(_t: IDL.FixedFloatClass, d: Draft): void {
    this.fillText(d as TextDraft, () => `${Math.random() * 100}`);
  }
  public visitBool(_t: IDL.BoolClass, d: Draft): void {
    (d as BoolDraft).checked = Math.random() < 0.5;
  }
  public visitResource(t: IDL.ResourceClass, d: Draft): void {
    const keys = Object.keys(t.instances);
    if (keys.length > 0) {
      const text = d as TextDraft;
      text.text = keys[randomInt(keys.length)];
      text.error = undefined;
    }
  }
  public visitOpt(_t: IDL.OptClass, ty: IDL.Type, d: Draft): void {
    const opt = d as OptDraft;
    if (opt.some) {
      ty.accept(this, opt.inner!);
    }
  }
  public visitVec(_t: IDL.VecClass, ty: IDL.Type, d: Draft): void {
    const list = d as ListDraft;
    if (list.length === '' || list.auto) {
      resizeList(list, ty, `${randomInt(4)}`);
      list.auto = true;
    }
    list.items.forEach((item) => ty.accept(this, item));
  }
  public visitRecord(_t: IDL.RecordClass, fields: Record<string, IDL.Type>, d: Draft): void {
    Object.values(fields).forEach((ty, i) => ty.accept(this, (d as FieldsDraft).fields[i]));
  }
  public visitTuple(_t: IDL.TupleClass, components: IDL.Type[], d: Draft): void {
    components.forEach((ty, i) => ty.accept(this, (d as FieldsDraft).fields[i]));
  }
  public visitVariant(_t: IDL.VariantClass, fields: Record<string, IDL.Type>, d: Draft): void {
    const cases = Object.values(fields);
    const variant = d as CaseDraft;
    if (variant.index < 0 || variant.auto) {
      const index = randomInt(cases.length);
      selectCase(variant, index, cases[index]);
      variant.auto = true;
    }
    cases[variant.index].accept(this, variant.payload!);
  }
  public visitEnum(_t: IDL.EnumClass, tags: Array<string>, d: Draft): void {
    const enumDraft = d as CaseDraft;
    if (enumDraft.index < 0 || enumDraft.auto) {
      selectCase(enumDraft, randomInt(tags.length));
      enumDraft.auto = true;
    }
  }
  public visitRec(_t: IDL.RecClass, ty: IDL.Type, d: Draft): void {
    ty.accept(this, d);
  }
  private fillText(d: TextDraft, generate: () => string) {
    if (d.text === '' || d.auto) {
      d.text = generate();
      d.auto = true;
      d.error = undefined;
    }
  }
}

export function randomize(t: IDL.Type, d: Draft) {
  t.accept(new Randomize(), d);
}

// Converts to the JS representation jco expects: `number` up to 32 bits, `bigint` above.
function toInteger(bits: number, signed: boolean, value: bigint): number | bigint {
  const min = signed ? -(1n << BigInt(bits - 1)) : 0n;
  const max = signed ? (1n << BigInt(bits - 1)) - 1n : (1n << BigInt(bits)) - 1n;
  if (value < min || value > max) {
    throw new Error(`Out of range for ${signed ? 's' : 'u'}${bits}: [${min}, ${max}]`);
  }
  return bits <= 32 ? Number(value) : value;
}

function parseInteger(bits: number, signed: boolean, text: string): number | bigint {
  const trimmed = text.trim();
  if (!/^[-+]?\d+$/.test(trimmed)) {
    throw new Error(`Expected an integer, got "${text}"`);
  }
  return toInteger(bits, signed, BigInt(trimmed));
}

// Converts a draft into the JS value jco expects. Invalid drafts get an `error`
// and yield INVALID; every field is visited so all errors show at once.
class Parse extends IDL.Visitor<Draft, any> {
  public visitType<T>(t: IDL.Type<T>, d: Draft): any {
    return this.leaf(d, () => {
      throw new Error(`Unsupported type ${t.name}`);
    });
  }
  public visitNull(_t: IDL.NullClass, _d: Draft): null {
    return null;
  }
  public visitBool(_t: IDL.BoolClass, d: Draft): boolean {
    return (d as BoolDraft).checked;
  }
  public visitString(_t: IDL.StringClass, d: Draft): any {
    return (d as TextDraft).text;
  }
  public visitFixedNat(t: IDL.FixedNatClass, d: Draft): any {
    return this.leaf(d, () => parseInteger(t._bits, false, (d as TextDraft).text));
  }
  public visitFixedInt(t: IDL.FixedIntClass, d: Draft): any {
    return this.leaf(d, () => parseInteger(t._bits, true, (d as TextDraft).text));
  }
  public visitFixedFloat(_t: IDL.FixedFloatClass, d: Draft): any {
    return this.leaf(d, () => {
      const text = (d as TextDraft).text.trim();
      const value = Number(text);
      if (text === '' || Number.isNaN(value)) {
        throw new Error(`Expected a number, got "${text}"`);
      }
      return value;
    });
  }
  public visitResource(t: IDL.ResourceClass, d: Draft): any {
    return this.leaf(d, () => {
      const id = (d as TextDraft).text;
      if (id === '' && Object.keys(t.instances).length === 0) {
        throw new Error(`No ${t._name} instances yet`);
      }
      const result = t.instances[id];
      if (result === undefined) {
        throw new Error(`Resource not found: ${id}`);
      }
      return result;
    });
  }
  public visitOpt(t: IDL.OptClass, ty: IDL.Type, d: Draft): any {
    const opt = d as OptDraft;
    // Only `option<option<T>>` needs the tagged representation to tell the layers apart.
    const tagged = t.maybe_null();
    if (!opt.some) {
      return tagged ? { tag: 'none' } : null;
    }
    const val = ty.accept(this, opt.inner!);
    if (val === INVALID) {
      return INVALID;
    }
    return tagged ? { tag: 'some', val } : val;
  }
  public visitVec(_t: IDL.VecClass, ty: IDL.Type, d: Draft): any {
    return this.all((d as ListDraft).items.map((item) => ty.accept(this, item)));
  }
  public visitRecord(_t: IDL.RecordClass, fields: Record<string, IDL.Type>, d: Draft): any {
    const entries = Object.entries(fields);
    const values = this.all(entries.map(([_, ty], i) => ty.accept(this, (d as FieldsDraft).fields[i])));
    return values === INVALID ? INVALID : Object.fromEntries(entries.map(([key], i) => [key, values[i]]));
  }
  public visitTuple(_t: IDL.TupleClass, components: IDL.Type[], d: Draft): any {
    return this.all(components.map((ty, i) => ty.accept(this, (d as FieldsDraft).fields[i])));
  }
  public visitVariant(_t: IDL.VariantClass, fields: Record<string, IDL.Type>, d: Draft): any {
    const variant = d as CaseDraft;
    return this.selected(variant, () => {
      const [tag, ty] = Object.entries(fields)[variant.index];
      const val = ty.accept(this, variant.payload!);
      return val === INVALID ? INVALID : { tag, val };
    });
  }
  public visitEnum(_t: IDL.EnumClass, tags: Array<string>, d: Draft): any {
    const enumDraft = d as CaseDraft;
    return this.selected(enumDraft, () => tags[enumDraft.index]);
  }
  public visitRec(_t: IDL.RecClass, ty: IDL.Type, d: Draft): any {
    return ty.accept(this, d);
  }

  private leaf(d: Draft, parse: () => any): any {
    try {
      const value = parse();
      d.error = undefined;
      return value;
    } catch (err) {
      d.error = (err as Error).message;
      return INVALID;
    }
  }
  private all(values: any[]): any[] | typeof INVALID {
    return values.includes(INVALID) ? INVALID : values;
  }
  private selected(d: CaseDraft, parse: () => any): any {
    if (d.index < 0) {
      d.error = 'Select a case';
      return INVALID;
    }
    d.error = undefined;
    return parse();
  }
}

// Parses a single value, recording errors on the draft. Returns INVALID on failure.
export function parseDraft(t: IDL.Type, d: Draft): any {
  return t.accept(new Parse(), d);
}

// Parses all arguments, or returns undefined if any of them is invalid.
export function parseArgs(types: IDL.Type[], drafts: Draft[]): any[] | undefined {
  const values = types.map((t, i) => parseDraft(t, drafts[i]));
  return values.includes(INVALID) ? undefined : values;
}

import * as WIT from './wit';
import { ResourceRegistry, thrownType } from './resources';

// Formats JS values as jco represents them in WAVE, the WebAssembly Value Encoding:
// https://github.com/bytecodealliance/wasm-tools/tree/main/crates/wasm-wave
// WAVE has no syntax for resources; an instance shows as `#{id}`, e.g. `#x-1`, and a borrow of
// it as `#borrowed-{id}`.

// Labels that are WAVE keywords are prefixed with `%`.
const KEYWORDS = new Set(['true', 'false', 'some', 'none', 'ok', 'err', 'inf', 'nan']);

function label(name: string): string {
  return KEYWORDS.has(name) ? `%${name}` : name;
}

function escape(text: string, quote: string): string {
  return [...text].map((c) => {
    switch (c) {
      case '\\': return '\\\\';
      case '\n': return '\\n';
      case '\r': return '\\r';
      case '\t': return '\\t';
      case quote: return `\\${quote}`;
    }
    const code = c.codePointAt(0)!;
    return code < 0x20 || code === 0x7f ? `\\u{${code.toString(16)}}` : c;
  }).join('');
}

// The shortest decimal that reads back as the same `f32`, e.g. `0.1` for `0.10000000149011612`.
// An argument may not be an `f32` yet; the guest gets it rounded.
function float32(arg: number): string {
  const value = Math.fround(arg);
  for (let digits = 1; digits <= 9; digits++) {
    const short = Number(value.toPrecision(digits));
    if (Object.is(Math.fround(short), value)) {
      return float(short);
    }
  }
  return float(value);
}

function float(value: number): string {
  if (Number.isNaN(value)) {
    return 'nan';
  }
  if (!Number.isFinite(value)) {
    return value > 0 ? 'inf' : '-inf';
  }
  return Object.is(value, -0) ? '-0' : `${value}`;
}

function payload(name: string, ty: WIT.Type | undefined, value: string): string {
  return ty === undefined || ty instanceof WIT.NullClass ? name : `${name}(${value})`;
}

class Wave extends WIT.Visitor<any, string> {
  constructor(private readonly registry: ResourceRegistry) {
    super();
  }
  public visitType<T>(t: WIT.Type<T>, _v: any): string {
    throw new Error(`Can't format a value of type ${t.name}`);
  }
  public visitNull(_t: WIT.NullClass, _v: any): string {
    return '_';
  }
  public visitBool(_t: WIT.BoolClass, v: any): string {
    return v ? 'true' : 'false';
  }
  public visitString(_t: WIT.StringClass, v: any): string {
    return `"${escape(`${v}`, '"')}"`;
  }
  public visitChar(_t: WIT.CharClass, v: any): string {
    return `'${escape(`${v}`, "'")}'`;
  }
  public visitFixedNat(_t: WIT.FixedNatClass, v: any): string {
    return `${v}`;
  }
  public visitFixedInt(_t: WIT.FixedIntClass, v: any): string {
    return `${v}`;
  }
  public visitFixedFloat(t: WIT.FixedFloatClass, v: any): string {
    return t._bits === 32 ? float32(Number(v)) : float(Number(v));
  }
  public visitOpt(t: WIT.OptClass, ty: WIT.Type, v: any): string {
    // Only `option<option<T>>` uses the tagged representation, to tell the layers apart.
    if (t.maybe_null()) {
      return v?.tag === 'some' ? `some(${ty.accept(this, v.val)})` : 'none';
    }
    return v === null || v === undefined ? 'none' : `some(${ty.accept(this, v)})`;
  }
  public visitVec(_t: WIT.VecClass, ty: WIT.Type, v: any): string {
    // Lists of numbers may be typed arrays, e.g. a `Uint8Array` for `list<u8>`.
    return `[${Array.from(v as ArrayLike<any>, (item) => ty.accept(this, item)).join(', ')}]`;
  }
  public visitRecord(_t: WIT.RecordClass, fields: Record<string, WIT.Type>, v: any): string {
    const entries = Object.entries(fields);
    if (entries.length === 0) {
      return '{:}';
    }
    return `{${entries.map(([name, ty]) => `${label(name)}: ${ty.accept(this, v[WIT.jsFieldName(name)])}`).join(', ')}}`;
  }
  public visitFlags(t: WIT.FlagsClass, _fields: Record<string, WIT.Type>, v: any): string {
    return `{${t._flags.filter((name) => v[WIT.jsFieldName(name)]).map(label).join(', ')}}`;
  }
  public visitTuple(_t: WIT.TupleClass, components: WIT.Type[], v: any): string {
    return `(${components.map((ty, i) => ty.accept(this, v[i])).join(', ')})`;
  }
  public visitVariant(t: WIT.VariantClass, fields: Record<string, WIT.Type>, v: any): string {
    const ty = fields[v.tag];
    // The cases of a `result` are keywords themselves; a variant's are escaped if they're keywords.
    const name = t instanceof WIT.ResultClass ? v.tag : label(v.tag);
    return payload(name, ty, ty === undefined ? '' : ty.accept(this, v.val));
  }
  public visitEnum(_t: WIT.EnumClass, _tags: string[], v: any): string {
    return label(v);
  }
  public visitRec(_t: WIT.RecClass, ty: WIT.Type, v: any): string {
    return ty.accept(this, v);
  }
  public visitResource(t: WIT.ResourceClass, v: any): string {
    return formatHandle(this.registry, v, t);
  }
  public visitOwned(t: WIT.OwnedClass, _ty: WIT.Type, v: any): string {
    return formatHandle(this.registry, v, t.resource);
  }
  public visitBorrow(t: WIT.BorrowClass, _ty: WIT.Type, v: any): string {
    return formatHandle(this.registry, v, t.resource, true);
  }
}

// A resource instance by its id, e.g. `#x-1`, or `#borrowed-x-1` for a borrow, including a method's
// receiver; `#<X>` for an object the table doesn't track.
export function formatHandle(registry: ResourceRegistry, obj: unknown, resource?: WIT.ResourceClass, borrowed = false): string {
  const id = registry.idOf(obj) ?? `<${resource?.witName ?? 'unknown'}>`;
  return `#${borrowed ? 'borrowed-' : ''}${id}`;
}

export function formatValue(registry: ResourceRegistry, t: WIT.Type, value: any): string {
  try {
    return t.accept(new Wave(registry), value);
  } catch {
    // A value that doesn't match its type, e.g. from an import implemented in JavaScript.
    return `<invalid ${t.name}>`;
  }
}

// Formats call arguments, which have the types of the function's parameters.
export function formatArgs(registry: ResourceRegistry, func: WIT.FuncClass | undefined, args: any[]): string {
  return args.map((arg, i) => {
    const ty = func?._args[i]?.[1];
    return ty ? formatValue(registry, ty, arg) : `${arg}`;
  }).join(', ');
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

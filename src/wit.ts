export abstract class Visitor<D, R> {
    public visitType<T>(t: Type<T>, _data: D): R {
        throw new Error(`Type ${t.name} not implemented`);
    }
    public visitNull(t: NullClass, data: D): R {
        return this.visitType(t, data);
    }
    public visitBool(t: BoolClass, data: D): R {
        return this.visitType(t, data);
    }
    public visitString(t: StringClass, data: D): R {
        return this.visitType(t, data);
    }
    public visitChar(t: CharClass, data: D): R {
        return this.visitType(t, data);
    }
    public visitNumber<T>(t: Type<T>, data: D): R {
        return this.visitType(t, data);
    }
    public visitFixedNat(t: FixedNatClass, data: D): R {
        return this.visitNumber(t, data);
    }
    public visitFixedInt(t: FixedIntClass, data: D): R {
        return this.visitNumber(t, data);
    }
    public visitFixedFloat(t: FixedFloatClass, data: D): R {
        return this.visitNumber(t, data);
    }
    public visitOpt(t: OptClass, _ty: Type, data: D): R {
        return this.visitType(t, data);
    }
    public visitVec(t: VecClass, _ty: Type, data: D): R {
        return this.visitType(t, data);
    }
    public visitRecord(t: RecordClass, _fields: Record<string, Type>, data: D): R {
        return this.visitType(t, data);
    }
    // Flags default to visiting them as a record of bools.
    public visitFlags(t: FlagsClass, fields: Record<string, Type>, data: D): R {
        return this.visitRecord(t, fields, data);
    }
    public visitTuple(t: TupleClass, _components: Array<Type>, data: D): R {
        return this.visitType(t, data);
    }
    public visitVariant(t: VariantClass, _fields: Record<string, Type>, data: D): R {
        return this.visitType(t, data);
    }
    public visitEnum(t: EnumClass, _tags: Array<string>, data: D): R {
        return this.visitType(t, data);
    }
    public visitFunc(t: FuncClass, data: D): R {
        return this.visitType(t, data);
    }
    public visitInterface(t: InterfaceClass, data: D): R {
        return this.visitType(t, data);
    }
    public visitResource(t: ResourceClass, data: D): R {
        return this.visitType(t, data);
    }
    public visitRec(t: RecClass, _ty: Type, data: D): R {
        return this.visitType(t, data);
    }
    // Handles default to visiting the resource type itself.
    public visitOwned(_t: OwnedClass, ty: Type, data: D): R {
        return ty.accept(this, data);
    }
    public visitBorrow(_t: BorrowClass, ty: Type, data: D): R {
        return ty.accept(this, data);
    }
}

// A WIT name jco turned into camelCase or PascalCase, e.g. `getRegion` or `IncomingRequest`,
// back in kebab case. Single-letter words are ambiguous: `ABTest` reads as `ab-test`.
export function kebabName(name: string): string {
    return name.replace(/([A-Z])(?=[A-Z][a-z])/g, '$1-').replace(/([a-z0-9])(?=[A-Z])/g, '$1-').toLowerCase();
}

// jco exposes record fields (and flags) in lowerCamelCase, e.g. `link-count` as `linkCount`.
export function jsFieldName(name: string): string {
    const [first, ...rest] = name.split('-');
    return first.toLowerCase() + rest.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
}

export abstract class Type<T = any> {
    // Phantom field so `T` (the JS value type) participates in type checking.
    declare protected readonly _value?: T;
    // The WIT name of a type its interface declares, e.g. `op` for `enum op { add }`.
    public _typeName?: string;
    // The type as WIT writes it: its name if it has one, otherwise its expression.
    get name(): string {
        return this._typeName ?? this.expr;
    }
    // The type's structure, e.g. `enum { add }` or `tuple<u8, u8>`.
    public abstract readonly expr: string;
    // How WIT declares the type, e.g. `enum op { add }` or `type casts = tuple<c1, c2>`; an
    // unnamed type shows its expression.
    get definition(): string {
        if (!this._typeName) {
            return this.expr;
        }
        const keyword = /^(record|flags|variant|enum) /.exec(this.expr);
        return keyword
            ? `${keyword[1]} ${this._typeName} ${this.expr.slice(keyword[0].length)}`
            : `type ${this._typeName} = ${this.expr}`;
    }
    public abstract accept<D, R>(v: Visitor<D, R>, d: D): R;
}
export class NullClass extends Type<void> {
    public accept<D, R>(v: Visitor<D, R>, d: D): R {
        return v.visitNull(this, d);
    }
    get expr(): string {
        return '_';
    }
}
export class BoolClass extends Type<boolean> {
    public accept<D, R>(v: Visitor<D, R>, d: D): R {
        return v.visitBool(this, d);
    }
    get expr(): string {
        return 'bool';
    }
}
export class StringClass extends Type<string> {
    public accept<D, R>(v: Visitor<D, R>, d: D): R {
        return v.visitString(this, d);
    }
    get expr(): string {
        return 'string';
    }
}
export class CharClass extends Type<string> {
    public accept<D, R>(v: Visitor<D, R>, d: D): R {
        return v.visitChar(this, d);
    }
    get expr(): string {
        return 'char';
    }
}
export class FixedNatClass extends Type<number> {
    constructor(public readonly _bits: number) {
        super();
    }
    public accept<D, R>(v: Visitor<D, R>, d: D): R {
        return v.visitFixedNat(this, d);
    }
    get expr(): string {
        return `u${this._bits}`;
    }
}
export class FixedIntClass extends Type<number> {
    constructor(public readonly _bits: number) {
        super();
    }
    public accept<D, R>(v: Visitor<D, R>, d: D): R {
        return v.visitFixedInt(this, d);
    }
    get expr(): string {
        return `s${this._bits}`;
    }
}
export class FixedFloatClass extends Type<number> {
    constructor(public readonly _bits: number) {
        super();
    }
    public accept<D, R>(v: Visitor<D, R>, d: D): R {
        return v.visitFixedFloat(this, d);
    }
    get expr(): string {
        return `f${this._bits}`;
    }
}
export class OptClass extends Type<any> {
    constructor(public readonly _ty: Type) {
        super();
    }
    public accept<D, R>(v: Visitor<D, R>, d: D): R {
        return v.visitOpt(this, this._ty, d);
    }
    get expr(): string {
        return `option<${this._ty.name}>`;
    }
    public maybe_null(): boolean {
        if (this._ty instanceof OptClass) {
            return !this._ty.maybe_null();
        } else {
            return false;
        }
    }
}
export class VecClass extends Type<Array<any>> {
    constructor(public readonly _ty: Type) {
        super();
    }
    public accept<D, R>(v: Visitor<D, R>, d: D): R {
        return v.visitVec(this, this._ty, d);
    }
    get expr(): string {
        return `list<${this._ty.name}>`;
    }
}
export class RecordClass extends Type<Record<string, any>> {
    constructor(public readonly _fields: Record<string, Type>) {
        super();
    }
    public accept<D, R>(v: Visitor<D, R>, d: D): R {
        return v.visitRecord(this, this._fields, d);
    }
    get expr(): string {
        return `record { ${Object.entries(this._fields).map(([k, v]) => `${k}: ${v.name}`).join(', ')} }`;
    }
}
// jco represents flags as an object of bools, keyed like record fields.
export class FlagsClass extends RecordClass {
    constructor(public readonly _flags: Array<string>) {
        super(Object.fromEntries(_flags.map((f) => [f, Bool])));
    }
    public accept<D, R>(v: Visitor<D, R>, d: D): R {
        return v.visitFlags(this, this._fields, d);
    }
    get expr(): string {
        return `flags { ${this._flags.join(', ')} }`;
    }
}
export class TupleClass extends Type<Array<any>> {
    constructor(public readonly _components: Array<Type>) {
        super();
    }
    public accept<D, R>(v: Visitor<D, R>, d: D): R {
        return v.visitTuple(this, this._components, d);
    }
    get expr(): string {
        return `tuple<${this._components.map((c) => c.name).join(', ')}>`;
    }
}
export class VariantClass extends Type<Record<string, Type>> {
    constructor(public readonly _fields: Record<string, Type>) {
        super();
    }
    public accept<D, R>(v: Visitor<D, R>, d: D): R {
        return v.visitVariant(this, this._fields, d);
    }
    get expr(): string {
        return `variant { ${Object.entries(this._fields).map(([k, v]) => {
            return k + (v.name === '_' ? '' : `(${v.name})`);
        }).join(', ')} }`;
    }
}
// `result<T, E>`, which jco represents like a variant of `ok` and `err`. A missing payload is `_`.
export class ResultClass extends VariantClass {
    constructor(ok: Type, err: Type) {
        super({ ok, err });
    }
    get expr(): string {
        const [ok, err] = [this._fields.ok, this._fields.err].map((t) => (t instanceof NullClass ? undefined : t.name));
        if (err === undefined) {
            return ok === undefined ? 'result' : `result<${ok}>`;
        }
        return `result<${ok ?? '_'}, ${err}>`;
    }
}
export class EnumClass extends Type<Array<string>> {
    constructor(public readonly _tags: Array<string>) {
        super();
    }
    public accept<D, R>(v: Visitor<D, R>, d: D): R {
        return v.visitEnum(this, this._tags, d);
    }
    get expr(): string {
        return `enum { ${this._tags.join(', ')} }`;
    }
}
export class RecClass extends Type<any> {
    private static _counter = 0;
    private _id = RecClass._counter++;
    private _type: Type | undefined = undefined;
    public accept<D, R>(v: Visitor<D, R>, d: D): R {
        if (!this._type) {
            throw new Error('Recursive type uninitialized');
        }
        return v.visitRec(this, this._type, d);
    }
    public fill(t: Type) {
        this._type = t;
    }
    public get_type() {
        return this._type;
    }
    get expr(): string {
        if (!this._type) {
            return `rec_${this._id}`;
        }
        return this._type.name;
    }
}
export type CallKind = 'func' | 'constructor' | 'static' | 'method';
export class FuncClass extends Type<any> {
    // `_witName` is the name in the component, e.g. `[method]request.get-method`.
    constructor(public readonly _args: Array<[string, Type]>, public readonly _ret: Type[], public readonly _kind: string = '', public readonly _witName: string = '') {
        super();
    }
    public accept<D, R>(v: Visitor<D, R>, d: D): R {
        return v.visitFunc(this, d);
    }
    // `_kind` may carry an 'async ' prefix, e.g. 'async method'.
    get callKind(): CallKind {
        for (const kind of ['constructor', 'static', 'method'] as const) {
            if (this._kind.endsWith(kind)) {
                return kind;
            }
        }
        return 'func';
    }
    get expr(): string {
        const ret = this._ret.length > 0 ? ` -> ${this._ret[0].name}` : '';
        return `func(${this._args.map((a) => `${a[0]}: ${a[1].name}`).join(', ')})${ret}`;
    }
    // The name to show, as in WIT, e.g. `get-method` for `[method]request.get-method`. `key`,
    // jco's name for it, stands in if the WIT name is unknown.
    public displayName(key: string): string {
        if (this.callKind === 'constructor') {
            return 'constructor';
        }
        const name = this._witName.replace(/^\[[^\]]*\]/, '');
        return name === '' ? kebabName(key) : name.slice(name.indexOf('.') + 1);
    }
}
export class ResourceClass extends Type<any> {
    // `_name` is jco's class name for the resource, e.g. `IncomingRequest`, and `_interface` the
    // name of the interface that defines it.
    constructor(public readonly _name: string, public readonly _fields: Record<string, FuncClass>, public readonly _interface: string = '') {
        super();
    }
    public accept<D, R>(v: Visitor<D, R>, d: D): R {
        return v.visitResource(this, d);
    }
    get expr(): string {
        return `resource ${this.witName}`;
    }
    // The resource's name in WIT, e.g. `incoming-request` or `XML`, to show. Its functions' WIT
    // names include it, e.g. `[method]incoming-request.headers`; for a resource without any, jco's
    // class name stands in.
    get witName(): string {
        for (const func of Object.values(this._fields)) {
            const match = /^\[[^\]]*\](?:\[[^\]]*\])?([^.]+)/.exec(func._witName);
            if (match) {
                return match[1];
            }
        }
        return kebabName(this._name);
    }
    public get_static_funcs(): Array<[string, FuncClass]> {
        return Object.entries(this._fields).filter(([_, f]) => f.callKind === 'static' || f.callKind === 'constructor');
    }
    public get_method_funcs(): Array<[string, FuncClass]> {
        return Object.entries(this._fields).filter(([_, f]) => f.callKind === 'method');
    }
}
function resourceName(ty: RecClass): string {
    const resource = ty.get_type();
    return resource instanceof ResourceClass ? resource.witName : ty.name;
}
export class OwnedClass extends Type<any> {
    constructor(public readonly _ty: RecClass) {
        super();
    }
    public accept<D, R>(v: Visitor<D, R>, d: D): R {
        return v.visitOwned(this, this._ty, d);
    }
    get resource(): ResourceClass {
        return this._ty.get_type() as ResourceClass;
    }
    // As in WIT, where an owned handle is just the resource name.
    get expr(): string {
        return resourceName(this._ty);
    }
}
export class BorrowClass extends Type<any> {
    constructor(public readonly _ty: RecClass) {
        super();
    }
    public accept<D, R>(v: Visitor<D, R>, d: D): R {
        return v.visitBorrow(this, this._ty, d);
    }
    get resource(): ResourceClass {
        return this._ty.get_type() as ResourceClass;
    }
    get expr(): string {
        return `borrow<${resourceName(this._ty)}>`;
    }
}
// Name the bindgen gives to the interface holding world-level exports.
export const ROOT_INTERFACE = 'UNNAMED';
export class InterfaceClass extends Type<any> {
    [key: string]: any; // Add an index signature to allow dynamic property assignment
    constructor(public readonly _name: string, public readonly _fields: Record<string, FuncClass>, public readonly _vars: Record<string, Type> = {}) {
        super();
        for (const [k, v] of Object.entries(_vars)) {
            this[k] = v;
        }
    }
    public accept<D, R>(v: Visitor<D, R>, d: D): R {
        return v.visitInterface(this, d);
    }
    get expr(): string {
        return `interface ${this._name}`;
    }
    get isRoot(): boolean {
        return this._name === ROOT_INTERFACE;
    }
    // The resources of the interface, including those it `use`s from others.
    public get_resources(): Array<ResourceClass> {
        return Object.entries(this._vars).filter(([_, ty]) => ty instanceof RecClass && ty.get_type() instanceof ResourceClass).map(([_, ty]) => (ty as RecClass).get_type() as ResourceClass);
    }
}

export const Null = new NullClass();
export const Bool = new BoolClass();
export const String = new StringClass();
export const Char = new CharClass();
export const U8 = new FixedNatClass(8);
export const U16 = new FixedNatClass(16);
export const U32 = new FixedNatClass(32);
export const U64 = new FixedNatClass(64);
export const S8 = new FixedIntClass(8);
export const S16 = new FixedIntClass(16);
export const S32 = new FixedIntClass(32);
export const S64 = new FixedIntClass(64);
export const F32 = new FixedFloatClass(32);
export const F64 = new FixedFloatClass(64);
export function Opt(ty: Type): OptClass {
    return new OptClass(ty);
}
export function Vec(ty: Type): VecClass {
    return new VecClass(ty);
}
export function Record(fields: Record<string, Type>): RecordClass {
    return new RecordClass(fields);
}
export function Flags(flags: Array<string>): FlagsClass {
    return new FlagsClass(flags);
}
export function Tuple(components: Array<Type>): TupleClass {
    return new TupleClass(components);
}
export function Result(ok: Type, err: Type): ResultClass {
    return new ResultClass(ok, err);
}
// Names a type its interface declares. Each declaration is a type of its own, so naming it
// doesn't name others.
export function Named<T extends Type>(name: string, ty: T): T {
    ty._typeName = name;
    return ty;
}
export function Enum(tags: Array<string>): EnumClass {
    return new EnumClass(tags);
}
export function Variant(fields: Record<string, Type>): VariantClass {
    return new VariantClass(fields);
}
export function Func(args: Array<[string, Type]>, ret: [] | [Type], kind: string, witName = ''): FuncClass {
    return new FuncClass(args, ret, kind, witName);
}
export function Interface(name: string, fields: Record<string, FuncClass>, vars: Record<string, Type> = {}): InterfaceClass {
    return new InterfaceClass(name, fields, vars);
}
export function Resource(name: string, fields: Record<string, FuncClass>, iface = ''): ResourceClass {
    return new ResourceClass(name, fields, iface);
}
export function Rec(): RecClass {
    return new RecClass();
}
export function Owned(ty: RecClass): OwnedClass {
    return new OwnedClass(ty);
}
export function Borrow(ty: RecClass): BorrowClass {
    return new BorrowClass(ty);
}
const borrows = new WeakMap<ResourceClass, BorrowClass>();
// `borrow<r>`, the type of a method's `self`.
export function borrowOf(resource: ResourceClass): BorrowClass {
    let borrow = borrows.get(resource);
    if (!borrow) {
        const rec = Rec();
        rec.fill(resource);
        borrow = Borrow(rec);
        borrows.set(resource, borrow);
    }
    return borrow;
}

export abstract class Visitor<D, R> {
    public visitType<T>(t: Type<T>, data: D): R {
        throw new Error('Not implemented');
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
    public visitOpt(t: OptClass, ty: Type, data: D): R {
        return this.visitType(t, data);
    }
    public visitVec(t: VecClass, ty: Type, data: D): R {
        return this.visitType(t, data);
    }
    public visitRecord(t: RecordClass, fields: Record<string, Type>, data: D): R {
        return this.visitType(t, data);
    }
    public visitTuple(t: TupleClass, components: Array<Type>, data: D): R {
        return this.visitType(t, data);
    }
    public visitVariant(t: VariantClass, fields: Record<string, Type>, data: D): R {
        return this.visitType(t, data);
    }
    public visitEnum(t: EnumClass, tags: Array<string>, data: D): R {
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
    public visitRec(t: RecClass, ty: Type, data: D): R {
        return this.visitType(t, data);
    }
}

export abstract class Type<T = any> {
    public abstract readonly name: string;
    public abstract accept<D, R>(v: Visitor<D, R>, d: D): R;
}
export class NullClass extends Type<void> {
    public accept<D, R>(v: Visitor<D, R>, d: D): R {
        return v.visitNull(this, d);
    }
    get name(): string {
        return '_';
    }
}
export class BoolClass extends Type<boolean> {
    public accept<D, R>(v: Visitor<D, R>, d: D): R {
        return v.visitBool(this, d);
    }
    get name(): string {
        return 'bool';
    }
}
export class StringClass extends Type<string> {
    public accept<D, R>(v: Visitor<D, R>, d: D): R {
        return v.visitString(this, d);
    }
    get name(): string {
        return 'string';
    }
}
export class FixedNatClass extends Type<number> {
    constructor(public readonly _bits: number) {
        super();
    }
    public accept<D, R>(v: Visitor<D, R>, d: D): R {
        return v.visitFixedNat(this, d);
    }
    get name(): string {
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
    get name(): string {
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
    get name(): string {
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
    get name(): string {
        return `option&lt;${this._ty.name}&gt;`;
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
    get name(): string {
        return `list&lt;${this._ty.name}&gt;`;
    }
}
export class RecordClass extends Type<Record<string, any>> {
    constructor(public readonly _fields: Record<string, Type>) {
        super();
    }
    public accept<D, R>(v: Visitor<D, R>, d: D): R {
        return v.visitRecord(this, this._fields, d);
    }
    get name(): string {    
        return `record { ${Object.entries(this._fields).map(([k, v]) => `${k}: ${v.name}`).join(', ')} }`;
    }
}
export class TupleClass extends Type<Array<any>> {
    constructor(public readonly _components: Array<Type>) {
        super();
    }
    public accept<D, R>(v: Visitor<D, R>, d: D): R {
        return v.visitTuple(this, this._components, d);
    }
    get name(): string {    
        return `tuple&lt;${this._components.map((c) => c.name).join(', ')}&gt;`;
    }
}
export class VariantClass extends Type<Record<string, Type>> {
    constructor(public readonly _fields: Record<string, Type>) {
        super();
    }
    public accept<D, R>(v: Visitor<D, R>, d: D): R {
        return v.visitVariant(this, this._fields, d);
    }
    get name(): string {
        return `variant { ${Object.entries(this._fields).map(([k, v]) => {
            return k + (v.name === '_' ? '' : `(${v.name})`);
        }).join(', ')} }`;
    }
}
export class EnumClass extends Type<Array<string>> {
    constructor(public readonly _tags: Array<string>) {
        super();
    }
    public accept<D, R>(v: Visitor<D, R>, d: D): R {
        return v.visitEnum(this, this._tags, d);
    }
    get name(): string {
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
    get name(): string {
        if (!this._type) {
            return `rec_${this._id}`;
        }
        return this._type.name;
    }
}
export class FuncClass extends Type<any> {
    constructor(public readonly _args: Array<[string, Type]>, public readonly _ret: Type[], public readonly _kind: string = '') {
        super();
    }
    public accept<D, R>(v: Visitor<D, R>, d: D): R {
        return v.visitFunc(this, d);
    }
    get name(): string {
        return `func(${this._args.map((a) => `${a[0]}: ${a[1].name}`).join(', ')}) -> (${this._ret.map((a) => a.name).join(', ')})`;
    }
}
export class ResourceClass extends Type<any> {
    public instances: Record<string, any> = {};
    private _counter = 0;
    constructor(public readonly _name: string, public readonly _fields: Record<string, FuncClass>) {
        super();
    }
    public accept<D, R>(v: Visitor<D, R>, d: D): R {
        return v.visitResource(this, d);
    }
    get name(): string {
        return `resource ${this._name}`;
    }
    public get_static_funcs(): Array<[string, FuncClass]> {
        return Object.entries(this._fields).filter(([_, f]) => f._kind.endsWith('static') || f._kind.endsWith('constructor'));
    }
    public get_method_funcs(): Array<[string, FuncClass]> {
        return Object.entries(this._fields).filter(([_, f]) => f._kind.endsWith('method'));
    }
    public add_instance(obj: any): string {
        const name = `${this._name.toLowerCase()}_${this._counter++}`;
        this.instances[name] = obj;
        return name;
    }
}
export class OwnedClass extends Type<any> {
    constructor(public readonly _ty: RecClass) {
        super();
    }
    public accept<D, R>(v: Visitor<D, R>, d: D): R {
        return this._ty.accept(v, d);
    }
    get name(): string {
        return `${this._ty.name}`;
    }
}
export class BorrowClass extends Type<any> {
    constructor(public readonly _ty: RecClass) {
        super();
    }
    public accept<D, R>(v: Visitor<D, R>, d: D): R {
        return this._ty.accept(v, d);
    }
    get name(): string {
        return `borrow&lt;${this._ty.name}&gt;`;
    }
}
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
    get name(): string {
        return `interface ${this._name}`;
    }
    public get_resources(): Array<ResourceClass> {
        return Object.entries(this._vars).filter(([_, ty]) => ty instanceof RecClass && ty.get_type() instanceof ResourceClass).map(([_, ty]) => (ty as RecClass).get_type() as ResourceClass);
    }
}

export const Null = new NullClass();
export const Bool = new BoolClass();
export const String = new StringClass();
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
export function Flags(flags: Array<string>): RecordClass {
    return new RecordClass(Object.fromEntries(flags.map((f) => [f, Bool])));
}
export function Tuple(components: Array<Type>): TupleClass {
    return new TupleClass(components);
}
export function Enum(tags: Array<string>): EnumClass {
    return new EnumClass(tags);
}
export function Variant(fields: Record<string, Type>): VariantClass {
    return new VariantClass(fields);
}
export function Func(args: Array<[string, Type]>, ret: [] | [Type], kind: string): FuncClass {
    return new FuncClass(args, ret, kind);
}
export function Interface(name: string, fields: Record<string, FuncClass>, resources: Array<ResourceClass>): InterfaceClass {
    return new InterfaceClass(name, fields, resources);
}
export function Resource(name: string, fields: Record<string, FuncClass>): ResourceClass {
    return new ResourceClass(name, fields);
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

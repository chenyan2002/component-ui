export abstract class Visitor<D, R> {
    public visitType<T>(t: Type<T>, data: D): R {
        throw new Error('Not implemented');
    }
    public visitNull(t: NullClass, data: D): R {
        return this.visitType(t, data);
    }
    public visitNumber<T>(t: Type<T>, data: D): R {
        return this.visitType(t, data);
    }
    public visitFixedNat(t: FixedNatClass, data: D): R {
        return this.visitNumber(t, data);
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
        return 'null';
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
export class VariantClass extends Type<Record<string, Type>> {
    constructor(public readonly _fields: Record<string, Type>) {
        super();
    }
    public accept<D, R>(v: Visitor<D, R>, d: D): R {
        return v.visitVariant(this, this._fields, d);
    }
    get name(): string {
        return `variant { ${Object.entries(this._fields).map(([k, v]) => `${k}: ${v.name}`).join(', ')} }`;
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
export class FuncClass extends Type<any> {
    constructor(public readonly _args: Array<[string, Type]>, public readonly _ret: Type[]) {
        super();
    }
    public accept<D, R>(v: Visitor<D, R>, d: D): R {
        return v.visitFunc(this, d);
    }
    get name(): string {
        return `func(${this._args.map((a) => a[1].name).join(', ')}) -> (${this._ret.map((a) => a.name).join(', ')})`;
    }
}
export class InterfaceClass extends Type<any> {
    constructor(public readonly _name: string, public readonly _fields: Record<string, FuncClass>) {
        super();
    }
    public accept<D, R>(v: Visitor<D, R>, d: D): R {
        return v.visitInterface(this, d);
    }
    get name(): string {
        return `interface ${this._name}`;
    }
}

export const Null = new NullClass();
export const U32 = new FixedNatClass(32);
export const U64 = new FixedNatClass(64);
export function Enum(tags: Array<string>): EnumClass {
    return new EnumClass(tags);
}
export function Variant(fields: Record<string, Type>): VariantClass {
    return new VariantClass(fields);
}
export function Func(args: Array<[string, Type]>, ret: Type[]): FuncClass {
    return new FuncClass(args, ret);
}
export function Interface(name: string, fields: Record<string, FuncClass>): InterfaceClass {
    return new InterfaceClass(name, fields);
}

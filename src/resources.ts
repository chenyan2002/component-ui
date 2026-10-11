import * as WIT from './wit';

export type InstanceState = 'live' | 'moved' | 'dropped';

export interface Instance {
  id: string;
  resource: WIT.ResourceClass;
  obj: object;
  state: InstanceState;
  // The call that produced the instance, e.g. `new X(5)`.
  origin: string;
  // What happened to it once it is no longer live, e.g. `moved into consume(x_0)`.
  fate?: string;
}

// jco keeps the handle of a component-owned resource under a private `Symbol('handle')`
// and clears it when ownership moves. Returns undefined for objects without one
// (e.g. host-implemented resources), where liveness can't be observed.
function hasLiveHandle(obj: object): boolean | undefined {
  const symbol = Object.getOwnPropertySymbols(obj).find((s) => s.description === 'handle');
  return symbol === undefined ? undefined : (obj as any)[symbol] !== undefined;
}

const dispose: symbol = (Symbol as any).dispose ?? Symbol.for('dispose');

// Tracks the resource instances of one component instance. Emits `change` events.
export class ResourceRegistry extends EventTarget {
  private readonly byId = new Map<string, Instance>();
  private readonly byObj = new Map<object, Instance>();
  private readonly counters = new Map<string, number>();

  public add(resource: WIT.ResourceClass, obj: object, origin: string): Instance {
    const existing = this.byObj.get(obj);
    if (existing) {
      return existing;
    }
    const prefix = resource._name.toLowerCase();
    const n = this.counters.get(prefix) ?? 0;
    this.counters.set(prefix, n + 1);
    const instance: Instance = { id: `${prefix}_${n}`, resource, obj, state: 'live', origin };
    this.byId.set(instance.id, instance);
    this.byObj.set(obj, instance);
    this.changed();
    return instance;
  }

  public get(id: string): Instance | undefined {
    return this.byId.get(id);
  }

  public idOf(obj: unknown): string | undefined {
    return typeof obj === 'object' && obj !== null ? this.byObj.get(obj)?.id : undefined;
  }

  public instances(resource: WIT.ResourceClass): Instance[] {
    return [...this.byId.values()].filter((i) => i.resource === resource);
  }

  public live(resource: WIT.ResourceClass): Instance[] {
    return this.instances(resource).filter((i) => i.state === 'live');
  }

  public resources(): WIT.ResourceClass[] {
    return [...new Set([...this.byId.values()].map((i) => i.resource))];
  }

  // Updates instance states after a call. `owned` are the objects passed as owned
  // handles; they are assumed moved on success when their handle can't be observed.
  public settle(owned: object[], fate: string, succeeded: boolean) {
    let changed = false;
    for (const instance of this.byId.values()) {
      if (instance.state !== 'live') {
        continue;
      }
      const alive = hasLiveHandle(instance.obj);
      if (alive === false || (alive === undefined && succeeded && owned.includes(instance.obj))) {
        instance.state = 'moved';
        instance.fate = fate;
        changed = true;
      }
    }
    if (changed) {
      this.changed();
    }
  }

  // Drops the instance, running the resource's destructor in the component.
  public drop(id: string) {
    const instance = this.byId.get(id)!;
    const destructor = (instance.obj as any)[dispose];
    if (typeof destructor !== 'function') {
      throw new Error(`${id} can't be dropped`);
    }
    destructor.call(instance.obj);
    instance.state = 'dropped';
    instance.fate = 'dropped';
    this.changed();
  }

  // Forgets an instance that is no longer live.
  public dismiss(id: string) {
    const instance = this.byId.get(id);
    if (instance && instance.state !== 'live') {
      this.byId.delete(id);
      this.byObj.delete(instance.obj);
      this.changed();
    }
  }

  private changed() {
    this.dispatchEvent(new Event('change'));
  }
}

function isHandle(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

// Collects the owned handles inside a JS value of the given type.
class OwnedHandles extends WIT.Visitor<any, void> {
  public readonly found: Array<[WIT.ResourceClass, object]> = [];

  public visitType<T>(_t: WIT.Type<T>, _v: any): void {}
  public visitOwned(t: WIT.OwnedClass, _ty: WIT.Type, v: any): void {
    if (isHandle(v)) {
      this.found.push([t.resource, v]);
    }
  }
  public visitBorrow(_t: WIT.BorrowClass, _ty: WIT.Type, _v: any): void {}
  public visitOpt(t: WIT.OptClass, ty: WIT.Type, v: any): void {
    if (t.maybe_null()) {
      if (v?.tag === 'some') {
        ty.accept(this, v.val);
      }
    } else if (v !== null && v !== undefined) {
      ty.accept(this, v);
    }
  }
  public visitVec(_t: WIT.VecClass, ty: WIT.Type, v: any): void {
    if (Array.isArray(v)) {
      v.forEach((item) => ty.accept(this, item));
    }
  }
  public visitRecord(_t: WIT.RecordClass, fields: Record<string, WIT.Type>, v: any): void {
    if (isHandle(v)) {
      Object.entries(fields).forEach(([key, ty]) => ty.accept(this, (v as any)[WIT.jsFieldName(key)]));
    }
  }
  public visitTuple(_t: WIT.TupleClass, components: WIT.Type[], v: any): void {
    if (Array.isArray(v)) {
      components.forEach((ty, i) => ty.accept(this, v[i]));
    }
  }
  public visitVariant(_t: WIT.VariantClass, fields: Record<string, WIT.Type>, v: any): void {
    const ty = isHandle(v) ? fields[(v as any).tag] : undefined;
    if (ty) {
      ty.accept(this, (v as any).val);
    }
  }
  public visitRec(_t: WIT.RecClass, ty: WIT.Type, v: any): void {
    ty.accept(this, v);
  }
}

export function ownedHandles(t: WIT.Type, value: any): Array<[WIT.ResourceClass, object]> {
  const visitor = new OwnedHandles();
  t.accept(visitor, value);
  return visitor.found;
}

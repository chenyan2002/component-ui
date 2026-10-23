import * as WIT from './wit';

export type InstanceState = 'live' | 'moved' | 'dropped';

export interface Instance {
  // `{resource}-{handle}`, e.g. `x-1`, with the resource's WIT name. Host-implemented
  // instances have no handle index, as jco doesn't expose the host side's handles, so they are
  // numbered in creation order instead, e.g. `y-1`. A resource name the host and the guest both
  // implement gets a `host-` prefix on the host side, e.g. `host-y-1`, so ids can't clash.
  // The console shows it as `#x-1`.
  id: string;
  // The handle index in the component instance's table.
  handle?: number;
  resource: WIT.ResourceClass;
  obj: object;
  state: InstanceState;
  // The call that produced the instance, e.g. `new X(5)`.
  origin: string;
  // What happened to it once it is no longer live, e.g. `moved into consume(#x-1)`.
  fate?: string;
  // Who holds a host-implemented instance, whose handle index isn't observable: the number of
  // handles the guest has on the object, and whether an export returned it to the UI.
  holders?: { guest: number; ui: boolean };
}

// A row of the resource table: one handle index and the instances that held it.
export interface Slot {
  key: string;
  handle?: number;
  current: Instance;
  // Earlier occupants of a reused index, oldest first. They are all dead.
  earlier: Instance[];
  // Bumped whenever `current` changes, so the table can highlight the row.
  version: number;
}

function ownSymbol(obj: object, description: string): symbol | undefined {
  return Object.getOwnPropertySymbols(obj).find((s) => s.description === description);
}

// jco keeps the handle of a resource under a private `Symbol('handle')` and clears it
// when ownership moves. Returns undefined for objects without one (e.g. host-implemented
// resources), where liveness can't be observed.
function hasLiveHandle(obj: object): boolean | undefined {
  const symbol = ownSymbol(obj, 'handle');
  return symbol === undefined ? undefined : (obj as any)[symbol] !== undefined;
}

// The handle index of a resource the component owns. Host-implemented resources lifted out
// of the component carry `Symbol.for('cabiRep')`; their handle was already freed.
function handleIndex(obj: object): number | undefined {
  const symbol = ownSymbol(obj, 'handle');
  if (symbol === undefined || Object.prototype.hasOwnProperty.call(obj, Symbol.for('cabiRep'))) {
    return undefined;
  }
  const handle = (obj as any)[symbol];
  return typeof handle === 'number' ? handle : undefined;
}

export const dispose: symbol = (Symbol as any).dispose ?? Symbol.for('dispose');

// Whether the UI can call the instance's methods: it isn't a host object only the guest holds.
export function callable(instance: Instance): boolean {
  return !instance.holders || instance.holders.ui;
}

// Names of resources both the host and the guest implement, e.g. those of an interface the
// component imports and exports. Exports also refer to imported resources they `use`, which the
// guest doesn't implement.
export function clashingNames(imports: WIT.InterfaceClass[], exports: WIT.InterfaceClass[]): Set<string> {
  const imported = new Set(imports.map((iface) => iface._name));
  const exported = new Set(exports.map((iface) => iface._name));
  const host = new Set(imports.flatMap((iface) => iface.get_resources()).map((r) => r.witName));
  const guest = exports.flatMap((iface) => iface.get_resources())
    .filter((r) => exported.has(r._interface) || !imported.has(r._interface))
    .map((r) => r.witName);
  return new Set(guest.filter((name) => host.has(name)));
}

// Tracks the resource instances of one component instance, by handle index. Indices are
// shared by all resource types of the component instance and reused once freed, so an
// id refers to the latest instance that held the index. Host-implemented instances have no
// index; they are tracked by who holds them. Emits `change` events.
export class ResourceRegistry extends EventTarget {
  // Called for each new host-implemented instance, to observe what the guest does with it.
  public onHostInstance?: (instance: Instance) => void;

  // `clashing` names resources both sides implement, from `clashingNames`.
  constructor(private readonly clashing: ReadonlySet<string> = new Set()) {
    super();
  }

  private readonly slots = new Map<string, Slot>();
  private readonly byId = new Map<string, Instance>();
  private readonly byObj = new Map<object, Instance>();
  // Numbers host instances from 1, like handle indices.
  private hostCount = 1;
  // The object whose destructor `drop` is running, which isn't the guest dropping it.
  private dropping?: object;

  // Registers an instance returned to the UI, by an export or, when `fromGuest` is false, by
  // the host directly.
  public add(resource: WIT.ResourceClass, obj: object, origin: string, fromGuest = true): Instance {
    const existing = this.byObj.get(obj);
    if (existing?.holders) {
      // An export returning a host object takes it from the guest.
      this.hold(existing, existing.holders.guest - (fromGuest ? 1 : 0), true);
    }
    if (existing) {
      return existing;
    }
    const handle = handleIndex(obj);
    return this.create(resource, obj, origin, handle, handle === undefined ? { guest: 0, ui: true } : undefined);
  }

  // Registers a host object handed to the guest, e.g. the stream returned by `get-stdout`. One
  // the UI held is the guest's now.
  public acquire(resource: WIT.ResourceClass, obj: object, origin: string): Instance {
    const existing = this.byObj.get(obj);
    if (existing?.holders) {
      this.hold(existing, existing.holders.guest + 1, false);
    }
    return existing ?? this.create(resource, obj, origin, undefined, { guest: 1, ui: false });
  }

  // The guest gave up a handle on a host object, by dropping it or moving it into an import.
  public release(obj: object, state: 'moved' | 'dropped', fate: string) {
    const instance = this.byObj.get(obj);
    if (instance?.holders && obj !== this.dropping) {
      this.hold(instance, instance.holders.guest - 1, instance.holders.ui, [state, fate]);
    }
  }

  private create(
    resource: WIT.ResourceClass, obj: object, origin: string, handle?: number, holders?: Instance['holders'],
  ): Instance {
    const prefix = resource.witName;
    const number = handle ?? this.hostCount++;
    // Host instances get slots apart from those of handle indices.
    const key = handle === undefined ? `host${number}` : `${number}`;
    const host = handle === undefined && this.clashing.has(prefix) ? 'host-' : '';
    const instance: Instance = { id: `${host}${prefix}-${number}`, handle, resource, obj, state: 'live', origin, holders };
    const slot = this.slots.get(key);
    if (slot) {
      slot.earlier.push(slot.current);
      slot.current = instance;
      slot.version++;
    } else {
      this.slots.set(key, { key, handle, current: instance, earlier: [], version: 0 });
    }
    this.byId.set(instance.id, instance);
    this.byObj.set(obj, instance);
    if (holders) {
      this.onHostInstance?.(instance);
    }
    this.changed();
    return instance;
  }

  // Updates who holds a host-implemented instance; it is live while anyone does.
  private hold(instance: Instance, guest: number, ui: boolean, ending?: [InstanceState, string]) {
    instance.holders = { guest: Math.max(0, guest), ui };
    if (instance.holders.guest > 0 || ui) {
      instance.state = 'live';
      instance.fate = undefined;
    } else if (ending) {
      [instance.state, instance.fate] = ending;
    }
    this.touch(instance);
  }

  public get(id: string): Instance | undefined {
    return this.byId.get(id);
  }

  public instanceOf(obj: unknown): Instance | undefined {
    return typeof obj === 'object' && obj !== null ? this.byObj.get(obj) : undefined;
  }

  public idOf(obj: unknown): string | undefined {
    return this.instanceOf(obj)?.id;
  }

  // Table rows by handle index; instances without one come last, in creation order.
  public rows(): Slot[] {
    const position = (slot: Slot) => slot.handle ?? Infinity;
    return [...this.slots.values()].sort((a, b) => position(a) - position(b));
  }

  // Live instances the UI holds, which it can pass to calls. Not host objects only the guest
  // holds, which aren't the UI's to give, even if the UI passed them to the guest before.
  public uiOwned(resource: WIT.ResourceClass): Instance[] {
    return this.rows().map((slot) => slot.current)
      .filter((i) => i.resource === resource && i.state === 'live' && callable(i));
  }

  // Host objects the host owns, which it can return to the guest from an import: those the UI
  // holds, and those moved into the host. Not those the guest holds, which aren't the host's.
  public hostOwned(resource: WIT.ResourceClass): Instance[] {
    return this.rows().map((slot) => slot.current)
      .filter((i) => i.resource === resource && i.holders?.guest === 0 && i.state !== 'dropped');
  }

  // Resources the UI has held instances of, whose methods it can call. Host resources only
  // the guest holds are just observed.
  public resources(): WIT.ResourceClass[] {
    const instances = [...this.slots.values()].flatMap((slot) => [...slot.earlier, slot.current]);
    return [...new Set(instances.filter(callable).map((i) => i.resource))];
  }

  // Passes the host objects among `owned`, the owned arguments of a call the UI makes, to the
  // guest, which gets a handle as the call starts, or `into` the host, which takes them.
  public transfer(owned: object[], fate: string, into: 'guest' | 'host') {
    for (const obj of owned) {
      const instance = this.byObj.get(obj);
      if (instance?.holders && instance.state === 'live') {
        this.hold(instance, instance.holders.guest + (into === 'guest' ? 1 : 0), false, ['moved', fate]);
      }
    }
  }

  // Updates the states of instances the guest implements after a call, as their handles show.
  public settle(fate: string) {
    let changed = false;
    for (const slot of this.slots.values()) {
      const instance = slot.current;
      if (instance.state !== 'live' || instance.holders) {
        continue;
      }
      if (hasLiveHandle(instance.obj) === false) {
        instance.state = 'moved';
        instance.fate = fate;
        slot.version++;
        changed = true;
      }
    }
    if (changed) {
      this.changed();
    }
  }

  // Drops the instance, running the resource's destructor.
  public drop(id: string) {
    const instance = this.byId.get(id)!;
    const destructor = (instance.obj as any)[dispose];
    if (typeof destructor !== 'function') {
      throw new Error(`${id} can't be dropped`);
    }
    this.dropping = instance.obj;
    try {
      destructor.call(instance.obj);
    } finally {
      this.dropping = undefined;
    }
    if (instance.holders) {
      instance.holders.ui = false;
    }
    instance.state = 'dropped';
    instance.fate = 'dropped';
    this.touch(instance);
  }

  // Forgets the row of an instance that is no longer live, including earlier occupants.
  public dismiss(id: string) {
    const instance = this.byId.get(id);
    const slot = instance && this.slotOf(instance);
    if (slot && instance.state !== 'live') {
      this.remove(slot);
      this.changed();
    }
  }

  // Forgets every row whose instance is no longer live.
  public dismissFreed() {
    const freed = [...this.slots.values()].filter((slot) => slot.current.state !== 'live');
    freed.forEach((slot) => this.remove(slot));
    if (freed.length > 0) {
      this.changed();
    }
  }

  // The row an instance currently occupies; earlier occupants have none.
  private slotOf(instance: Instance): Slot | undefined {
    return [...this.slots.values()].find((slot) => slot.current === instance);
  }

  private touch(instance: Instance) {
    const slot = this.slotOf(instance);
    if (slot) {
      slot.version++;
      this.changed();
    }
  }

  private remove(slot: Slot) {
    for (const instance of [...slot.earlier, slot.current]) {
      if (this.byId.get(instance.id) === instance) {
        this.byId.delete(instance.id);
      }
      this.byObj.delete(instance.obj);
    }
    this.slots.delete(slot.key);
  }

  private changed() {
    this.dispatchEvent(new Event('change'));
  }
}

// Whether a value of the type can contain resource handles.
class HasResource extends WIT.Visitor<Set<WIT.RecClass>, boolean> {
  public visitType<T>(_t: WIT.Type<T>, _seen: Set<WIT.RecClass>): boolean {
    return false;
  }
  public visitResource(_t: WIT.ResourceClass, _seen: Set<WIT.RecClass>): boolean {
    return true;
  }
  public visitOpt(_t: WIT.OptClass, ty: WIT.Type, seen: Set<WIT.RecClass>): boolean {
    return ty.accept(this, seen);
  }
  public visitVec(_t: WIT.VecClass, ty: WIT.Type, seen: Set<WIT.RecClass>): boolean {
    return ty.accept(this, seen);
  }
  public visitRecord(_t: WIT.RecordClass, fields: Record<string, WIT.Type>, seen: Set<WIT.RecClass>): boolean {
    return Object.values(fields).some((ty) => ty.accept(this, seen));
  }
  public visitTuple(_t: WIT.TupleClass, components: WIT.Type[], seen: Set<WIT.RecClass>): boolean {
    return components.some((ty) => ty.accept(this, seen));
  }
  public visitVariant(_t: WIT.VariantClass, fields: Record<string, WIT.Type>, seen: Set<WIT.RecClass>): boolean {
    return Object.values(fields).some((ty) => ty.accept(this, seen));
  }
  public visitRec(t: WIT.RecClass, ty: WIT.Type, seen: Set<WIT.RecClass>): boolean {
    if (seen.has(t)) {
      return false;
    }
    seen.add(t);
    return ty.accept(this, seen);
  }
}

const hasResource = new HasResource();

// Whether calling the function can pass resource handles either way.
export function involvesResources(func: WIT.FuncClass): boolean {
  return func.callKind === 'constructor'
    || [...func._args.map(([_, ty]) => ty), ...func._ret].some((ty) => ty.accept(hasResource, new Set()));
}

// Whether the interfaces involve resource instances.
export function usesResources(interfaces: WIT.InterfaceClass[]): boolean {
  return interfaces.some((iface) => iface.get_resources().length > 0
    || Object.values(iface._fields).some(involvesResources));
}

// The `ok` and `err` types of a function returning a `result`; jco returns the `ok` payload
// and throws on `err`.
function resultTypes(func: WIT.FuncClass): { ok?: WIT.Type; err?: WIT.Type } | undefined {
  const [ret] = func._ret;
  const inner = ret instanceof WIT.RecClass ? ret.get_type() : ret;
  return inner instanceof WIT.ResultClass ? inner._fields : undefined;
}

// The type of the JS value a call returns.
export function returnedType(func: WIT.FuncClass): WIT.Type | undefined {
  const result = resultTypes(func);
  return result ? result.ok : func._ret[0];
}

// The type of the error payload a call throws, if it returns a `result`.
export function thrownType(func: WIT.FuncClass): WIT.Type | undefined {
  return resultTypes(func)?.err;
}

function isHandle(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

// Collects the owned handles, and optionally the borrowed ones, inside a JS value of the given type.
class Handles extends WIT.Visitor<any, void> {
  public readonly found: Array<[WIT.ResourceClass, object]> = [];

  constructor(private readonly borrows: boolean) {
    super();
  }

  public visitType<T>(_t: WIT.Type<T>, _v: any): void {}
  public visitOwned(t: WIT.OwnedClass, _ty: WIT.Type, v: any): void {
    if (isHandle(v)) {
      this.found.push([t.resource, v]);
    }
  }
  public visitBorrow(t: WIT.BorrowClass, _ty: WIT.Type, v: any): void {
    if (this.borrows && isHandle(v)) {
      this.found.push([t._ty.get_type() as WIT.ResourceClass, v]);
    }
  }
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
  const visitor = new Handles(false);
  t.accept(visitor, value);
  return visitor.found;
}

// The owned and borrowed handles in the arguments of a call.
export function argHandles(func: WIT.FuncClass, args: any[]): Array<[WIT.ResourceClass, object]> {
  const visitor = new Handles(true);
  func._args.forEach(([_, type], i) => type.accept(visitor, args[i]));
  return visitor.found;
}

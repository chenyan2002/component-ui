import * as WIT from './wit';
import { customStringify } from './console';
import { dispose, Instance, involvesResources, ownedHandles, ResourceRegistry, returnedType, thrownType } from './resources';

// Hooks are installed on a host object once; they report to the component instance that
// last received it, in case the host shares an object between instances.
const observers = new WeakMap<object, HostResources>();

function isThenable(value: any): value is PromiseLike<any> {
  return typeof value?.then === 'function';
}

// The value jco passes to the guest as the `err` of a `result` when an import throws.
function errorPayload(err: any): any {
  if (typeof err === 'object' && err !== null && Object.prototype.hasOwnProperty.call(err, 'payload')) {
    return err.payload;
  }
  return err instanceof Error ? undefined : err;
}

function define(obj: object, key: PropertyKey, value: unknown) {
  try {
    Object.defineProperty(obj, key, { value, writable: true, configurable: true });
  } catch {
    // A frozen object can't be observed.
  }
}

// A function of an interface or resource; field names like `constructor` aren't inherited.
function ownFunc(fields: Record<string, WIT.FuncClass>, key: string): WIT.FuncClass | undefined {
  return Object.prototype.hasOwnProperty.call(fields, key) ? fields[key] : undefined;
}

// `wasi:cli/stdout@0.2.0` → `wasi:cli/stdout`.
function unversioned(pkg: string): string {
  return pkg.replace(/@[^/]*$/, '');
}

// Observes the imports of a component instance: resources the host hands to the guest are
// registered, and the guest's handles on them are counted as it moves and drops them.
export class HostResources {
  private readonly interfaces: Map<string, WIT.InterfaceClass>;

  constructor(private readonly registry: ResourceRegistry, interfaces: WIT.InterfaceClass[]) {
    // jco may key imports without their version.
    this.interfaces = new Map(interfaces.map((iface) => [unversioned(iface._name), iface]));
    registry.onHostInstance = (instance) => this.hook(instance);
  }

  // Wraps the import object for `pkg`, e.g. `wasi:cli/stdout`.
  public wrap(pkg: string, mod: any): any {
    const name = unversioned(pkg);
    const iface = this.interfaces.get(name);
    if (!iface) {
      return mod;
    }
    const resources = new Map(iface.get_resources().map((r) => [r._name, r]));
    const wrapped = new Map<string, unknown>();
    // An empty target, so wrapped values don't break the invariants of a frozen import object.
    return new Proxy(Object.create(null), {
      get: (_target, key) => {
        const value = Reflect.get(mod, key);
        if (typeof key !== 'string' || typeof value !== 'function') {
          return value;
        }
        if (!wrapped.has(key)) {
          const func = ownFunc(iface._fields, key);
          const resource = resources.get(key);
          wrapped.set(key, func
            ? this.wrapFunc(func, value, (args) => `${name}#${key}(${this.format(args)})`)
            : resource ? this.wrapClass(resource, value) : value);
        }
        return wrapped.get(key);
      },
      has: (_target, key) => Reflect.has(mod, key),
    });
  }

  private wrapFunc(func: WIT.FuncClass, fn: Function, label: (args: any[]) => string): Function {
    if (!involvesResources(func)) {
      return fn;
    }
    const host = this;
    return function (this: any, ...args: any[]) {
      return host.observe(func, args, () => fn.apply(this, args), () => label(args));
    };
  }

  private wrapClass(resource: WIT.ResourceClass, cls: Function): Function {
    const fields = resource._fields;
    const statics = new Map<string, Function>();
    return new Proxy(cls, {
      construct: (target, args, newTarget) => {
        const ctor = ownFunc(fields, 'constructor');
        const construct = () => Reflect.construct(target, args, newTarget);
        return ctor
          ? this.observe(ctor, args, construct, () => `new ${resource._name}(${this.format(args)})`, resource)
          : construct();
      },
      get: (target, key, receiver) => {
        const value = Reflect.get(target, key, receiver);
        const func = typeof key === 'string' ? ownFunc(fields, key) : undefined;
        if (typeof key !== 'string' || func?.callKind !== 'static' || typeof value !== 'function') {
          return value;
        }
        if (!statics.has(key)) {
          statics.set(key, this.wrapFunc(func, value.bind(target), (args) => `${resource._name}.${key}(${this.format(args)})`));
        }
        return statics.get(key);
      },
    });
  }

  // Watches what the guest does with a host object: dropping it, and calling its methods.
  private hook(instance: Instance) {
    const obj = instance.obj as any;
    const hooked = observers.has(obj);
    observers.set(obj, this);
    if (hooked) {
      return;
    }
    const destructor = obj[dispose];
    define(obj, dispose, function (this: any) {
      observers.get(obj)?.registry.release(obj, 'dropped', 'dropped by the guest');
      return typeof destructor === 'function' ? destructor.call(this) : undefined;
    });
    for (const [name, func] of instance.resource.get_method_funcs()) {
      const method = obj[name];
      if (typeof method !== 'function' || !involvesResources(func)) {
        continue;
      }
      define(obj, name, function (this: any, ...args: any[]) {
        const host = observers.get(obj);
        const call = () => method.apply(this, args);
        return host
          ? host.observe(func, args, call, () => `${host.registry.idOf(obj)}.${name}(${host.format(args)})`)
          : call();
      });
    }
  }

  // Calls an import for the guest. Owned arguments move from the guest to the host; owned
  // results, including in a thrown `err` payload, are handed to the guest.
  private observe(func: WIT.FuncClass, args: any[], invoke: () => any, label: () => string, constructs?: WIT.ResourceClass) {
    let name: string | undefined;
    const callLabel = () => (name ??= label());
    const owned = func._args.flatMap(([_, type], i) => ownedHandles(type, args[i]).map(([_, obj]) => obj));
    const moveArgs = () => owned.forEach((obj) => this.registry.release(obj, 'moved', `moved into ${callLabel()}`));
    const acquire = (type: WIT.Type | undefined, value: any) => {
      for (const [resource, obj] of type ? ownedHandles(type, value) : []) {
        this.registry.acquire(resource, obj, callLabel());
      }
    };
    const succeeded = (value: any) => {
      if (constructs) {
        this.registry.acquire(constructs, value, callLabel());
      } else {
        acquire(returnedType(func), value);
      }
    };
    const failed = (err: unknown) => acquire(thrownType(func), errorPayload(err));
    // The guest's handles on owned arguments are gone even if the call fails.
    moveArgs();
    let result: any;
    try {
      result = invoke();
    } catch (err) {
      failed(err);
      throw err;
    }
    if (isThenable(result)) {
      result.then(succeeded, failed);
    } else {
      succeeded(result);
    }
    return result;
  }

  private format(args: any[]): string {
    return args.map((arg) => customStringify(arg, (v) => this.registry.idOf(v))).join(', ');
  }
}

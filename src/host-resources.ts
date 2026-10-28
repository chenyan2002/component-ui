import * as WIT from './wit';
import type { Answer } from './answering';
import { CallRecord, Callee, describeCall, describeDrop, unversioned } from './call-record';
import { ImportLog } from './log';
import { dispose, Instance, involvesResources, ownedHandles, ResourceRegistry, returnedType, thrownType } from './resources';
import { formatHandle, formatResult, formatThrown } from './wave';

// Who answers an import call the host's own code runs: the user's JavaScript, or the WASI shim.
// The log records the call as their answer, marked as theirs, so that a replay can answer it.
export type HostCode = 'javascript' | 'wasi';

// What a replay says of a call the WASI shim answers: that the run differs there, or the answer
// recorded of it, `by`. With `returns`, the guest gets the recorded value in place of the shim's:
// it returns it, or throws, e.g. the `err` of a `result`. Without, the guest gets the shim's, e.g.
// a stream, as a value with handles needs the shim's own objects.
export type Replayed = 'stop' | { by: Answer; returns?: () => any };

// Hooks are installed on a host object once; they report to the component instance that
// last received it, in case the host shares an object between instances.
const observers = new WeakMap<object, HostResources>();

export function isThenable(value: any): value is PromiseLike<any> {
  return typeof value?.then === 'function';
}

// The value jco passes to the guest as the `err` of a `result` when an import throws.
function errorPayload(err: any): any {
  if (typeof err === 'object' && err !== null && Object.prototype.hasOwnProperty.call(err, 'payload')) {
    return err.payload;
  }
  return err instanceof Error ? undefined : err;
}

// The functions that ask for their results, e.g. those standing in for the ones the user didn't
// write, which log their calls themselves.
const asking = new WeakSet<Function>();

export function markAsking(fn: Function) {
  asking.add(fn);
}

export function asks(fn: Function): boolean {
  return asking.has(fn);
}

// Whether jco passes what an import threw to the guest as the `err` of a `result`, rather than
// trapping it: a payload, or anything that isn't an `Error`.
function isErrPayload(err: unknown): boolean {
  return !(err instanceof Error) || Object.prototype.hasOwnProperty.call(err, 'payload');
}

function define(obj: object, key: PropertyKey, value: unknown) {
  try {
    Object.defineProperty(obj, key, { value, writable: true, configurable: true });
  } catch {
    // A frozen object can't be observed.
  }
}

// A function of an interface or resource; field names like `constructor` aren't inherited.
export function ownFunc(fields: Record<string, WIT.FuncClass>, key: string): WIT.FuncClass | undefined {
  return Object.prototype.hasOwnProperty.call(fields, key) ? fields[key] : undefined;
}

// Imported interfaces by unversioned name, as jco keys imports: it gives all versions of an
// interface one import object. The bindgen already merges semver-compatible versions, e.g.
// `wasi:io/streams@0.2.0` into `@0.2.3`, so a name only has several for incompatible ones.
// World-level functions are each an import of their own, named as in WIT, e.g. `log-line`,
// whose default export is the function.
export function byImportName(interfaces: WIT.InterfaceClass[]): Map<string, WIT.InterfaceClass[]> {
  const grouped = new Map<string, WIT.InterfaceClass[]>();
  for (const iface of interfaces) {
    if (iface.isRoot) {
      Object.values(iface._fields).forEach((func) => grouped.set(func._witName, [WIT.Interface(iface._name, { default: func })]));
      continue;
    }
    const name = unversioned(iface._name);
    grouped.set(name, [...(grouped.get(name) ?? []), iface]);
  }
  return grouped;
}

// Observes the imports of a component instance: resources the host hands to the guest are
// registered, and the guest's handles on them are counted as it moves and drops them. The UI
// can also call the host's imported resources directly, e.g. to create arguments for exports.
export class HostResources {
  private readonly interfaces: Map<string, WIT.InterfaceClass[]>;
  private readonly imported: Set<WIT.ResourceClass>;
  // The host's class for each imported resource, from the import jco takes it from.
  private readonly classes = new Map<WIT.ResourceClass, Function>();
  // Set while the UI calls the host directly, which isn't the guest using its imports.
  private direct = 0;
  // Set while the host's own code runs for component-ui, e.g. reading the HTTP response a
  // handler set to show it, which isn't a call at all.
  private internal = 0;
  // Whose code implements each imported resource whose class the host has.
  private readonly code = new Map<WIT.ResourceClass, HostCode>();
  // Logs what the guest does with host instances that no import call shows: dropping its
  // handles on them, which the component model does without calling an import.
  public log?: (record: CallRecord) => ImportLog;
  // Replays the shim's calls that return a value, from what a run recorded of them.
  public replay?: (record: CallRecord, func: WIT.FuncClass) => Replayed | undefined;

  constructor(private readonly registry: ResourceRegistry, interfaces: WIT.InterfaceClass[]) {
    // jco may key imports without their version.
    this.interfaces = byImportName(interfaces);
    this.imported = new Set(interfaces.flatMap((iface) => iface.get_resources()));
    registry.onHostInstance = (instance) => this.hook(instance);
  }

  // Whether the host implements the resource, i.e. an import defines it.
  public isImported(resource: WIT.ResourceClass): boolean {
    return this.imported.has(resource);
  }

  public hostClass(resource: WIT.ResourceClass): Function | undefined {
    return this.classes.get(resource);
  }

  // Runs a call the UI makes on the host, e.g. a host resource's constructor.
  public callDirect<T>(call: () => T): T {
    this.direct++;
    try {
      return call();
    } finally {
      this.direct--;
    }
  }

  // Runs the host's own code for component-ui, e.g. to show what a call did; what it calls of
  // the host is neither logged nor the guest's.
  public internally<T>(call: () => T): T {
    this.internal++;
    try {
      return this.callDirect(call);
    } finally {
      this.internal--;
    }
  }

  // Wraps the import object for `pkg`, e.g. `wasi:cli/stdout`, which for `wasi` is the shim's.
  public wrap(pkg: string, mod: any, wasi: boolean): any {
    const name = unversioned(pkg);
    const ifaces = this.interfaces.get(name);
    if (!ifaces) {
      return mod;
    }
    ifaces.flatMap((iface) => iface.get_resources()).forEach((resource) => this.code.set(resource, wasi ? 'wasi' : 'javascript'));
    const wrapped = new Map<string, unknown>();
    // An empty target, so wrapped values don't break the invariants of a frozen import object.
    return new Proxy(Object.create(null), {
      get: (_target, key) => {
        const value = Reflect.get(mod, key);
        if (typeof key !== 'string' || typeof value !== 'function') {
          return value;
        }
        if (!wrapped.has(key)) {
          const iface = ifaces.find((iface) => ownFunc(iface._fields, key) !== undefined);
          const func = iface && ownFunc(iface._fields, key);
          // One resource per version of the interface.
          const resources = ifaces.flatMap((iface) => iface.get_resources()).filter((r) => r._name === key);
          if (!func) {
            // jco takes a resource class from the import that defines it.
            resources.forEach((resource) => this.classes.set(resource, value));
          }
          wrapped.set(key, func
            ? this.wrapFunc(func, value, (args) => this.label({ callKind: 'func', iface: iface!._name }, func, key, args))
            : resources.length > 0 ? this.wrapClass(resources[0], value) : value);
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
        if (!ctor) {
          return construct();
        }
        const callee: Callee = { callKind: 'constructor', resource };
        // A mock class logs its constructions itself.
        const run = asks(cls) ? construct : () => this.construct(callee, ctor, args, resource, construct);
        return this.observe(ctor, args, run, () => this.label(callee, ctor, 'constructor', args), resource);
      },
      get: (target, key, receiver) => {
        const value = Reflect.get(target, key, receiver);
        const func = typeof key === 'string' ? ownFunc(fields, key) : undefined;
        if (typeof key !== 'string' || func?.callKind !== 'static' || typeof value !== 'function') {
          return value;
        }
        if (!statics.has(key)) {
          statics.set(key, this.wrapFunc(func, value.bind(target), (args) => this.label({ callKind: 'static', resource }, func, key, args)));
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
      const host = observers.get(obj);
      const dropped = host?.registry.release(obj, 'dropped', 'dropped by the guest');
      if (host && dropped) {
        host.log?.(describeDrop(dropped, 'import')).result('');
      }
      return typeof destructor === 'function' ? destructor.call(this) : undefined;
    });
    const { resource } = instance;
    for (const [name, func] of resource.get_method_funcs()) {
      const method = obj[name];
      // Methods that ask, e.g. a mock's, log their calls themselves.
      const prompts = typeof method === 'function' && asks(method);
      if (typeof method !== 'function' || (prompts && !involvesResources(func))) {
        continue;
      }
      define(obj, name, function (this: any, ...args: any[]) {
        const host = observers.get(obj);
        if (!host) {
          return method.apply(this, args);
        }
        const callee: Callee = { callKind: 'method', resource, self: obj };
        const invoke = () => method.apply(this, args);
        const call = prompts ? invoke : () => host.record(callee, func, name, args, host.code.get(resource) ?? 'javascript', invoke);
        return involvesResources(func) ? host.observe(func, args, call, () => host.label(callee, func, name, args)) : call();
      });
    }
  }

  // Calls an import for the guest. Owned arguments move from the guest to the host; owned
  // results, including in a thrown `err` payload, are handed to the guest.
  private observe(func: WIT.FuncClass, args: any[], invoke: () => any, label: () => string, constructs?: WIT.ResourceClass) {
    if (this.direct > 0) {
      return invoke();
    }
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

  // Runs an import call that the host's own code answers, the user's JavaScript or the shim's,
  // logging it with its result as answered by that code, so that answers files record it. A
  // function without a result answers nothing; its call is logged, as one that didn't ask.
  public record(callee: Callee, func: WIT.FuncClass, key: string, args: any[], code: HostCode, invoke: () => any): any {
    if (this.internal > 0 || !this.log) {
      return invoke();
    }
    const record = describeCall(this.registry, 'import', callee, func, key, args);
    const line = this.log(record);
    const replayed = code === 'wasi' && func._ret.length > 0 ? this.replay?.(record, func) : undefined;
    if (replayed === 'stop') {
      // Where the run differs from the replay, the guest waits, as for an answer.
      return new Promise(() => {});
    }
    const by: Answer = replayed?.by ?? { source: code };
    // Before the host wrapper registers the instances it returns, so that they are new in the
    // answer; the result after, so that they show by id.
    const returned = (value: any) => {
      if (func._ret.length === 0) {
        line.result('');
        return;
      }
      line.answered(false, by);
      queueMicrotask(() => line.result(formatResult(this.registry, func, value)));
    };
    const threw = (err: unknown) => {
      if (thrownType(func) !== undefined && isErrPayload(err)) {
        line.answered(false, by);
        queueMicrotask(() => line.result(formatThrown(this.registry, func, errorPayload(err))));
      } else {
        line.answered(true, by);
        line.error(err);
      }
    };
    const returns = replayed?.returns;
    let result: any;
    try {
      result = invoke();
    } catch (err) {
      if (!returns) {
        threw(err);
        throw err;
      }
    }
    if (returns) {
      // The shim ran, for its state; the guest gets the recorded answer.
      const give = () => {
        let value: any;
        try {
          value = returns();
        } catch (err) {
          threw(err);
          throw err;
        }
        returned(value);
        return value;
      };
      return isThenable(result) ? result.then(give, give) : give();
    }
    if (isThenable(result)) {
      result.then(returned, threw);
    } else {
      returned(result);
    }
    return result;
  }

  // Runs a constructor of the host's own code, logging the call. It needs no answer: a replay
  // without that code constructs a mock.
  private construct(callee: Callee, func: WIT.FuncClass, args: any[], resource: WIT.ResourceClass, invoke: () => object): object {
    const line = this.internal > 0 ? undefined : this.log?.(describeCall(this.registry, 'import', callee, func, 'constructor', args));
    let obj: object;
    try {
      obj = invoke();
    } catch (err) {
      line?.error(err);
      throw err;
    }
    // Once the host wrapper has registered the instance, so that it shows by id.
    queueMicrotask(() => line?.result(formatHandle(this.registry, obj, resource)));
    return obj;
  }

  // How the console shows an import call, for the origins and fates of instances.
  private label(callee: Callee, func: WIT.FuncClass, key: string, args: any[]): string {
    return describeCall(this.registry, 'import', callee, func, key, args).label;
  }
}

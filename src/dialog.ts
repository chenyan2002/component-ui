import * as WIT from './wit';
import { CallRecord, Callee, describeCall, unversioned } from './call-record';
import { ImportLog } from './log';
import { initDraft, INVALID, MockFactory, parseDraft, randomize } from './draft';
import { byImportName, HostResources, ownFunc } from './host-resources';
import { stubMissingImports } from './loader';
import { argHandles, dispose, involvesResources, ResourceRegistry, thrownType } from './resources';
import { formatHandle, formatValue } from './wave';
import { sentResponse } from './wasi-http';

// Marks mock instances, which have no host implementation behind them.
export const MOCK = Symbol('mock');

// The base of the mock classes standing in for resources the user's stubs don't implement.
// Each resource type gets its own subclass, so jco's `instanceof` checks tell them apart.
export class MockResource {
  constructor() {
    (this as any)[MOCK] = true;
  }
}

// What a host would do with a call that receives a mock, where that is worth showing in place
// of the call's result. Keyed by unversioned interface and WIT name.
const HOST_EFFECTS: Record<string, (args: any[]) => Promise<string>> = {
  // The response a WASI HTTP handler sends.
  'wasi:http/types#[static]response-outparam.set': ([_outparam, response]) => sentResponse(response),
};

function define(obj: object, key: PropertyKey, value: unknown) {
  Object.defineProperty(obj, key, { value, writable: true, configurable: true });
}

// Stands in for the imports the user's stubs don't implement, like proxy-component's dialog
// mode: a call with a return value asks the user for it in the console and waits for the
// answer. Mock instances of host resources work the same way. JSPI lets the guest wait on the
// returned promise.
export class ImportDialogs implements MockFactory {
  private readonly interfaces: Map<string, WIT.InterfaceClass[]>;
  // Generated for resource classes the user's stubs lack; their instances are all mocks.
  private readonly mockClasses = new Map<WIT.ResourceClass, Function>();
  // Subclasses of the host's classes, for mock instances of resources the host implements.
  private readonly mockSubclasses = new Map<WIT.ResourceClass, Function>();
  // The functions that ask for their results, which stand in for those the user didn't write.
  private readonly prompts = new WeakSet<Function>();

  constructor(
    private readonly registry: ResourceRegistry,
    private readonly host: HostResources,
    interfaces: WIT.InterfaceClass[],
    private readonly log: (call: CallRecord) => ImportLog,
  ) {
    this.interfaces = byImportName(interfaces);
  }

  // Completes the module for `pkg`: the user's, or for `wasi` the shim's. Prompts stand in for
  // the functions and resource classes it lacks, and for calls that receive a mock, which the
  // host can't handle since it didn't create it.
  public complete(pkg: string, mod: any, wasi: boolean): object {
    const name = unversioned(pkg);
    const ifaces = this.interfaces.get(name);
    if (!ifaces) {
      return wasi ? mod : stubMissingImports(pkg, mod);
    }
    const completed: Record<string, unknown> = { ...mod };
    // jco gives all versions of an interface one import object; the first one's types stand for all.
    const funcs = new Map(ifaces.flatMap((iface) => Object.entries(iface._fields).map(([key, func]) => [key, { iface, func }] as const)).reverse());
    for (const [key, { iface, func }] of funcs) {
      const callee: Callee = { callKind: 'func', iface: iface._name };
      completed[key] = typeof mod[key] === 'function'
        ? this.routing(`${name}#${func._witName}`, func, key, mod[key], () => callee, wasi)
        : this.prompting(func, key, () => callee);
    }
    const resources = new Map(ifaces.flatMap((iface) => iface.get_resources()).map((r) => [r._name, r] as const).reverse());
    for (const resource of resources.values()) {
      const cls = mod[resource._name];
      if (typeof cls === 'function') {
        completed[resource._name] = this.routeStatics(name, resource, wasi ? cls : this.fill(resource, cls), wasi);
      } else if (!wasi) {
        completed[resource._name] = this.mockClass(resource);
      }
    }
    // Anything the WIT doesn't describe still fails when called.
    return wasi ? completed : stubMissingImports(pkg, completed);
  }

  // Imported resources can be mocked with the class jco uses for them.
  public canMock(t: WIT.ResourceClass): boolean {
    return this.host.isImported(t) && this.host.hostClass(t) !== undefined;
  }

  // A mock instance, e.g. for an export's argument or an import's result; its methods ask.
  public create(t: WIT.ResourceClass): object {
    const mock = Object.create(this.mockSubclass(t).prototype);
    mock[MOCK] = true;
    return mock;
  }

  // The class of mocks of a resource: a subclass of the host's, so jco's `instanceof` checks
  // pass, whose methods all ask instead of running host code.
  private mockSubclass(resource: WIT.ResourceClass): Function {
    const base = this.host.hostClass(resource)!;
    if ([...this.mockClasses.values()].includes(base)) {
      return base;
    }
    let cls = this.mockSubclasses.get(resource);
    if (!cls) {
      cls = class extends (base as any) {};
      define(cls, 'name', resource._name);
      // Dropping a mock frees nothing; the host's destructor would expect its own state.
      define(cls.prototype, dispose, () => {});
      for (const [key, func] of resource.get_method_funcs()) {
        define(cls.prototype, key, this.prompting(func, key, (self) => ({ callKind: 'method', resource, self })));
      }
      this.mockSubclasses.set(resource, cls);
    }
    return cls;
  }

  // Asks instead of calling `fn`, jco's `key`, when one of the arguments is a mock, which the
  // host's code doesn't know. `name` is the function's `iface#wit-name`, which may have a host
  // effect to show. The call notes when `fn` is the user's JavaScript rather than WASI's.
  private routing(name: string, func: WIT.FuncClass, key: string, fn: Function, callee: (self: unknown) => Callee, wasi: boolean): Function {
    if (!involvesResources(func)) {
      return fn;
    }
    const dialogs = this;
    const effect = HOST_EFFECTS[name];
    const note = wasi ? undefined : `your JavaScript ${func.displayName(key)} wasn't called, as an argument is a mock`;
    return function (this: unknown, ...args: any[]) {
      if (!argHandles(func, args).some(([_, obj]) => MOCK in obj)) {
        return fn.apply(this, args);
      }
      return dialogs.ask(func, dialogs.describe(callee(this), func, key, args), effect && (() => effect(args)), note);
    };
  }

  // Routes the static functions of a host class, e.g. `ResponseOutparam.set(mock, …)`; not those
  // `fill` added, which ask anyway.
  private routeStatics(name: string, resource: WIT.ResourceClass, cls: Function, wasi: boolean): Function {
    const statics = new Map(resource.get_static_funcs()
      .filter(([key, func]) => func.callKind === 'static' && typeof (cls as any)[key] === 'function' && !this.prompts.has((cls as any)[key]))
      .map(([key, func]) => [key, this.routing(`${name}#${func._witName}`, func, key, (cls as any)[key].bind(cls), () => ({ callKind: 'static', resource }), wasi)]));
    return statics.size === 0 ? cls : new Proxy(cls, {
      get: (target, key, receiver) => (typeof key === 'string' && statics.get(key)) || Reflect.get(target, key, receiver),
    });
  }

  private mockClass(resource: WIT.ResourceClass): Function {
    let cls = this.mockClasses.get(resource);
    if (!cls) {
      const dialogs = this;
      cls = class extends MockResource {
        constructor(...args: any[]) {
          super();
          const ctor = ownFunc(resource._fields, 'constructor');
          dialogs.constructed(this, resource, dialogs.describe({ callKind: 'constructor', resource }, ctor, 'constructor', args));
        }
      };
      define(cls, 'name', resource._name);
      this.mockClasses.set(resource, this.fill(resource, cls));
    }
    return cls;
  }

  // Adds prompting methods and statics a resource class lacks.
  private fill(resource: WIT.ResourceClass, cls: Function): Function {
    for (const [key, func] of resource.get_method_funcs()) {
      if (typeof cls.prototype[key] !== 'function') {
        define(cls.prototype, key, this.prompting(func, key, (self) => ({ callKind: 'method', resource, self })));
      }
    }
    for (const [key, func] of resource.get_static_funcs()) {
      if (func.callKind === 'static' && typeof (cls as any)[key] !== 'function') {
        define(cls, key, this.prompting(func, key, () => ({ callKind: 'static', resource })));
      }
    }
    return cls;
  }

  // Logs the guest constructing a mock, which needs no answer. The host wrapper registers the
  // instance once the constructor returns, so its id is known a microtask later.
  private constructed(obj: object, resource: WIT.ResourceClass, call: CallRecord) {
    const line = this.log(call);
    queueMicrotask(() => line.result(formatHandle(this.registry, obj, resource)));
  }

  // A function, jco's `key`, that asks for its result; `callee` gets the instance it is called on.
  private prompting(func: WIT.FuncClass, key: string, callee: (self: unknown) => Callee): Function {
    const dialogs = this;
    const prompt = function (this: unknown, ...args: any[]) {
      return dialogs.ask(func, dialogs.describe(callee(this), func, key, args));
    };
    this.prompts.add(prompt);
    return prompt;
  }

  // Asks for the return value of an import call; one without a return value returns right away,
  // showing what the host would do with it if there is an `effect` to show.
  private ask(func: WIT.FuncClass, call: CallRecord, effect?: () => Promise<string>, note?: string): any {
    const line = this.log(call);
    if (note) {
      line.note(note);
    }
    const [type] = func._ret;
    if (!type) {
      if (effect) {
        effect().then((text) => line.detail(text), (err) => line.error(err));
      } else {
        line.result('');
      }
      return undefined;
    }
    // jco returns the `ok` payload of a `result` and throws the `err` payload.
    const isResult = thrownType(func) !== undefined;
    return new Promise((resolve, reject) => {
      const draft = initDraft(type);
      line.ask({
        func,
        type,
        draft,
        registry: this.registry,
        mock: this,
        answer: (given = draft) => {
          const value = parseDraft(type, given, this.registry, this, 'host');
          if (value === INVALID) {
            return false;
          }
          // Before the host wrapper registers the mocks the value returns, so they can be told.
          line.answered(false);
          if (isResult && value.tag === 'err') {
            reject(Object.assign(new Error(formatValue(this.registry, type, value)), { payload: value.val }));
          } else {
            resolve(isResult ? value.val : value);
          }
          // After the host wrapper registers returned resources, so they show by id.
          queueMicrotask(() => line.result(formatValue(this.registry, type, value)));
          return true;
        },
        random: () => randomize(type, draft, this.registry, this, 'host'),
        trap: () => {
          // jco treats a runtime error as a trap of the component instance.
          const err = new WebAssembly.RuntimeError(`Trapped at ${call.label}`);
          line.answered(true);
          reject(err);
          line.error(err);
        },
      });
    });
  }

  private describe(callee: Callee, func: WIT.FuncClass | undefined, key: string, args: any[]): CallRecord {
    return describeCall(this.registry, 'import', callee, func, key, args);
  }
}

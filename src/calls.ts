import * as WIT from './wit';
import { CallRecord, Callee, describeCall, describeDrop } from './call-record';
import { LogEntry } from './log';
import { MOCK } from './dialog';
import { MockFactory } from './draft';
import { HostResources } from './host-resources';
import { argHandles, ownedHandles, ResourceRegistry, returnedType, thrownType } from './resources';
import { formatHandle, formatResult, formatThrown } from './wave';

export interface ExportsContext {
  // Exports of the instantiated component, as returned by jco's `instantiate`.
  exports: any;
  log(call: CallRecord): LogEntry;
  registry: ResourceRegistry;
  host: HostResources;
  activity: CallActivity;
  // Mock instances of host resources, whose methods ask in the console.
  mocks: MockFactory;
  // Reports an error a call failed with, e.g. a trap's stack; the browser's console by default.
  report?: (err: unknown) => void;
}

// Counts calls that haven't returned. While one waits, e.g. on an import prompt, the component
// instance can't be entered again, so the UI doesn't start others. Emits `change` events.
export class CallActivity extends EventTarget {
  public pending = 0;

  public async track<T>(call: () => Promise<T>): Promise<T> {
    this.set(this.pending + 1);
    try {
      return await call();
    } finally {
      this.set(this.pending - 1);
    }
  }

  private set(pending: number) {
    this.pending = pending;
    this.dispatchEvent(new Event('change'));
  }
}

// (Un)subscribes `listener` to changes of the context's instances and running calls.
export function watchContext(ctx: ExportsContext | undefined, listener: () => void, on: boolean) {
  for (const target of [ctx?.registry, ctx?.activity]) {
    if (on) {
      target?.addEventListener('change', listener);
    } else {
      target?.removeEventListener('change', listener);
    }
  }
}

export type CallTarget =
  | { type: 'func'; iface: WIT.InterfaceClass }
  | { type: 'constructor' | 'static'; iface: WIT.InterfaceClass; resource: WIT.ResourceClass }
  // Methods take the instance (`self`) as their first argument.
  | { type: 'method'; resource: WIT.ResourceClass };

function exportsOf(ctx: ExportsContext, iface: WIT.InterfaceClass): any {
  return iface.isRoot ? ctx.exports : ctx.exports[iface._name];
}

// The class of a resource: the component's export, or the host's class for an imported one.
function resourceClass(ctx: ExportsContext, iface: WIT.InterfaceClass, resource: WIT.ResourceClass): any {
  if (!ctx.host.isImported(resource)) {
    return exportsOf(ctx, iface)[resource._name];
  }
  const cls = ctx.host.hostClass(resource);
  if (!cls) {
    throw new Error(`The host doesn't implement ${resource.witName}`);
  }
  return cls;
}

// Whether the call goes to the host rather than the guest: it is on an imported resource.
function callsHost(ctx: ExportsContext, target: CallTarget, args: any[]): boolean {
  switch (target.type) {
    case 'func':
      return false;
    case 'constructor':
    case 'static':
      return ctx.host.isImported(target.resource);
    case 'method':
      return !!ctx.registry.instanceOf(args[0])?.holders;
  }
}

// jco throws a `ComponentError` carrying the `err` payload of a function returning a `result`.
function errorText(ctx: ExportsContext, func: WIT.FuncClass, err: unknown): unknown {
  if (thrownType(func) !== undefined && err instanceof Error && 'payload' in err) {
    return formatThrown(ctx.registry, func, err.payload);
  }
  return err;
}

function callee(target: CallTarget, args: any[]): Callee {
  switch (target.type) {
    case 'func':
      return { callKind: 'func', iface: target.iface._name };
    case 'constructor':
    case 'static':
      return { callKind: target.type, resource: target.resource };
    case 'method':
      return { callKind: 'method', resource: target.resource, self: args[0] };
  }
}

// The call of `name`, jco's name for `func`, with `args`, as a function to invoke.
function resolveCall(ctx: ExportsContext, target: CallTarget, name: string, func: WIT.FuncClass, args: any[]): () => any {
  switch (target.type) {
    case 'func': {
      const mod = exportsOf(ctx, target.iface);
      return () => mod[name](...args);
    }
    case 'constructor': {
      const cls = resourceClass(ctx, target.iface, target.resource);
      return () => new cls(...args);
    }
    case 'static': {
      const cls = resourceClass(ctx, target.iface, target.resource);
      if (typeof cls[name] !== 'function') {
        throw new Error(`${target.resource.witName}.${func.displayName(name)} is not implemented`);
      }
      return () => cls[name](...args);
    }
    case 'method': {
      const [self, ...rest] = args;
      return () => self[name](...rest);
    }
  }
}

// Calls `name`, jco's name for `func`, with `args`. `check`, if given, sees the call as it is
// about to be made, with its arguments' new mocks by the ids they got, and can keep it from
// being made, e.g. as a replay expected other ids.
export function call(ctx: ExportsContext, target: CallTarget, name: string, func: WIT.FuncClass, args: any[], check?: (record: CallRecord) => boolean) {
  return ctx.activity.track(() => run(ctx, target, name, func, args, check));
}

async function run(ctx: ExportsContext, target: CallTarget, name: string, func: WIT.FuncClass, args: any[], check?: (record: CallRecord) => boolean) {
  const { registry } = ctx;
  const funcArgs = target.type === 'method' ? args.slice(1) : args;
  // Mocks the user picked for arguments are theirs until the call takes them; registered
  // first, so that the call shows them by id.
  const handles = argHandles(func, funcArgs);
  if (target.type === 'method') {
    handles.push([target.resource, args[0]]);
  }
  for (const [resource, obj] of handles) {
    if (MOCK in obj && !registry.instanceOf(obj)) {
      registry.add(resource, obj, 'new mock', false);
    }
  }
  const toHost = callsHost(ctx, target, args);
  const record = describeCall(registry, toHost ? 'host' : 'export', callee(target, args), func, name, funcArgs);
  if (check && !check(record)) {
    return;
  }
  let invoke: () => any;
  try {
    invoke = resolveCall(ctx, target, name, func, args);
  } catch (err) {
    ctx.log(record).error(err);
    return;
  }
  const owned = func._args.flatMap(([_, type], i) => ownedHandles(type, funcArgs[i]).map(([_, obj]) => obj));
  const fate = `moved into ${record.label}`;
  const entry = ctx.log(record);
  // Owned host objects change hands as the call starts, before the guest can use them.
  registry.transfer(owned, fate, toHost ? 'host' : 'guest');
  let result: any;
  try {
    result = await (toHost ? ctx.host.callDirect(invoke) : invoke());
  } catch (err) {
    registry.settle(fate);
    entry.error(errorText(ctx, func, err));
    (ctx.report ?? console.error)(err);
    return;
  }
  // Settle moved arguments first: returned resources may reuse their handle indices.
  registry.settle(fate);
  if (target.type === 'constructor') {
    registry.add(target.resource, result, record.label, !toHost);
  } else {
    const type = returnedType(func);
    for (const [resource, obj] of type ? ownedHandles(type, result) : []) {
      registry.add(resource, obj, record.label, !toHost);
    }
  }
  entry.result(target.type === 'constructor' ? formatHandle(registry, result, target.resource) : formatResult(registry, func, result));
}

export function drop(ctx: ExportsContext, instance: string) {
  const entry = ctx.log(describeDrop(ctx.registry.instance(instance)!));
  try {
    ctx.registry.drop(instance);
    entry.result('dropped');
  } catch (err) {
    entry.error(err);
  }
}

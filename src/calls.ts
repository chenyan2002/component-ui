import * as WIT from './wit';
import { LogEntry } from './console';
import { MOCK } from './dialog';
import { MockFactory } from './draft';
import { HostResources } from './host-resources';
import { argHandles, ownedHandles, ResourceRegistry, returnedType, thrownType } from './resources';
import { formatArgs, formatHandle, formatResult, formatThrown } from './wave';

export interface ExportsContext {
  // Exports of the instantiated component, as returned by jco's `instantiate`.
  exports: any;
  log(call: string): LogEntry;
  registry: ResourceRegistry;
  host: HostResources;
  activity: CallActivity;
  // Mock instances of host resources, whose methods ask in the console.
  mocks: MockFactory;
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

interface Call {
  label: string;
  invoke(): any;
}

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

function resolveCall(ctx: ExportsContext, target: CallTarget, name: string, func: WIT.FuncClass, args: any[]): Call {
  // Labels show the WIT name; `name` is jco's.
  const shown = func.displayName(name);
  const argList = formatArgs(ctx.registry, func, target.type === 'method' ? args.slice(1) : args);
  switch (target.type) {
    case 'func': {
      const mod = exportsOf(ctx, target.iface);
      return { label: `${shown}(${argList})`, invoke: () => mod[name](...args) };
    }
    case 'constructor': {
      const cls = resourceClass(ctx, target.iface, target.resource);
      return { label: `new ${target.resource.witName}(${argList})`, invoke: () => new cls(...args) };
    }
    case 'static': {
      const cls = resourceClass(ctx, target.iface, target.resource);
      if (typeof cls[name] !== 'function') {
        throw new Error(`${target.resource.witName}.${shown} is not implemented`);
      }
      return { label: `${target.resource.witName}.${shown}(${argList})`, invoke: () => cls[name](...args) };
    }
    case 'method': {
      const [self, ...rest] = args;
      return { label: `${formatHandle(ctx.registry, self, target.resource, true)}.${shown}(${argList})`, invoke: () => self[name](...rest) };
    }
  }
}

export function call(ctx: ExportsContext, target: CallTarget, name: string, func: WIT.FuncClass, args: any[]) {
  return ctx.activity.track(() => run(ctx, target, name, func, args));
}

async function run(ctx: ExportsContext, target: CallTarget, name: string, func: WIT.FuncClass, args: any[]) {
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
  let resolved: Call;
  try {
    resolved = resolveCall(ctx, target, name, func, args);
  } catch (err) {
    ctx.log(name).error(err);
    return;
  }
  const owned = func._args.flatMap(([_, type], i) => ownedHandles(type, funcArgs[i]).map(([_, obj]) => obj));
  const fate = `moved into ${resolved.label}`;
  const toHost = callsHost(ctx, target, args);
  const entry = ctx.log(resolved.label);
  // Owned host objects change hands as the call starts, before the guest can use them.
  registry.transfer(owned, fate, toHost ? 'host' : 'guest');
  let result: any;
  try {
    result = await (toHost ? ctx.host.callDirect(resolved.invoke) : resolved.invoke());
  } catch (err) {
    registry.settle(fate);
    entry.error(errorText(ctx, func, err));
    console.error(err);
    return;
  }
  // Settle moved arguments first: returned resources may reuse their handle indices.
  registry.settle(fate);
  if (target.type === 'constructor') {
    registry.add(target.resource, result, resolved.label, !toHost);
  } else {
    const type = returnedType(func);
    for (const [resource, obj] of type ? ownedHandles(type, result) : []) {
      registry.add(resource, obj, resolved.label, !toHost);
    }
  }
  entry.result(target.type === 'constructor' ? formatHandle(registry, result, target.resource) : formatResult(registry, func, result));
}

export function drop(ctx: ExportsContext, instance: string) {
  const entry = ctx.log(`drop #${instance}`);
  try {
    ctx.registry.drop(instance);
    entry.result('dropped');
  } catch (err) {
    entry.error(err);
  }
}

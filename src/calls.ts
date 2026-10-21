import * as WIT from './wit';
import { customStringify, LogEntry } from './console';
import { ownedHandles, ResourceRegistry, returnedType } from './resources';

export interface ExportsContext {
  // Exports of the instantiated component, as returned by jco's `instantiate`.
  exports: any;
  log(call: string): LogEntry;
  registry: ResourceRegistry;
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

// Formats a value for the console, showing resource handles by their instance id.
function format(ctx: ExportsContext, value: any): string {
  return customStringify(value, (v) => ctx.registry.idOf(v));
}

function resolveCall(ctx: ExportsContext, target: CallTarget, name: string, args: any[]): Call {
  const argList = args.map((arg) => format(ctx, arg)).join(', ');
  switch (target.type) {
    case 'func': {
      const mod = exportsOf(ctx, target.iface);
      return { label: `${name}(${argList})`, invoke: () => mod[name](...args) };
    }
    case 'constructor': {
      const cls = exportsOf(ctx, target.iface)[target.resource._name];
      return { label: `new ${target.resource._name}(${argList})`, invoke: () => new cls(...args) };
    }
    case 'static': {
      const cls = exportsOf(ctx, target.iface)[target.resource._name];
      return { label: `${target.resource._name}.${name}(${argList})`, invoke: () => cls[name](...args) };
    }
    case 'method': {
      const [self, ...rest] = args;
      const restList = rest.map((arg) => format(ctx, arg)).join(', ');
      return { label: `${format(ctx, self)}.${name}(${restList})`, invoke: () => self[name](...rest) };
    }
  }
}

export async function call(ctx: ExportsContext, target: CallTarget, name: string, func: WIT.FuncClass, args: any[]) {
  let resolved: Call;
  try {
    resolved = resolveCall(ctx, target, name, args);
  } catch (err) {
    ctx.log(name).error(err);
    return;
  }
  const { registry } = ctx;
  const funcArgs = target.type === 'method' ? args.slice(1) : args;
  const owned = func._args.flatMap(([_, type], i) => ownedHandles(type, funcArgs[i]).map(([_, obj]) => obj));
  const fate = `moved into ${resolved.label}`;
  const entry = ctx.log(resolved.label);
  let result: any;
  try {
    result = await resolved.invoke();
  } catch (err) {
    registry.settle(owned, fate, false);
    entry.error(err);
    console.error(err);
    return;
  }
  // Settle moved arguments first: returned resources may reuse their handle indices.
  registry.settle(owned, fate, true);
  if (target.type === 'constructor') {
    registry.add(target.resource, result, resolved.label);
  } else {
    const type = returnedType(func);
    for (const [resource, obj] of type ? ownedHandles(type, result) : []) {
      registry.add(resource, obj, resolved.label);
    }
  }
  entry.result(format(ctx, result));
}

export function drop(ctx: ExportsContext, instance: string) {
  const entry = ctx.log(`drop ${instance}`);
  try {
    ctx.registry.drop(instance);
    entry.result('dropped');
  } catch (err) {
    entry.error(err);
  }
}

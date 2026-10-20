import * as WIT from './wit';
import { customStringify, LogEntry } from './console';
import { ownedHandles, ResourceRegistry } from './resources';

export interface ExportsContext {
  // Exports of the instantiated component, as returned by jco's `instantiate`.
  exports: any;
  log(call: string): LogEntry;
  registry: ResourceRegistry;
}

export type CallTarget =
  | { type: 'func'; iface: WIT.InterfaceClass }
  | { type: 'constructor' | 'static'; iface: WIT.InterfaceClass; resource: WIT.ResourceClass }
  | { type: 'method'; resource: WIT.ResourceClass; instance: string };

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
      const obj: any = ctx.registry.get(target.instance)!.obj;
      return { label: `${target.instance}.${name}(${argList})`, invoke: () => obj[name](...args) };
    }
  }
}

// The type of the JS value a call returns. jco returns the `ok` payload of a top-level
// `result` and throws on `err`. The bindgen encodes results as `variant { ok, err }`.
function returnedType(func: WIT.FuncClass): WIT.Type | undefined {
  const [ret] = func._ret;
  const inner = ret instanceof WIT.RecClass ? ret.get_type() : ret;
  if (inner instanceof WIT.VariantClass) {
    const cases = Object.keys(inner._fields);
    if (cases.length === 2 && cases[0] === 'ok' && cases[1] === 'err') {
      return inner._fields.ok;
    }
  }
  return ret;
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
  const owned = func._args.flatMap(([_, type], i) => ownedHandles(type, args[i]).map(([_, obj]) => obj));
  const entry = ctx.log(resolved.label);
  let succeeded = false;
  try {
    const result = await resolved.invoke();
    succeeded = true;
    if (target.type === 'constructor') {
      registry.add(target.resource, result, resolved.label);
    } else {
      const type = returnedType(func);
      for (const [resource, obj] of type ? ownedHandles(type, result) : []) {
        registry.add(resource, obj, resolved.label);
      }
    }
    entry.result(format(ctx, result));
  } catch (err) {
    entry.error(err);
    console.error(err);
  } finally {
    registry.settle(owned, `moved into ${resolved.label}`, succeeded);
  }
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

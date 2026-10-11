import * as WIT from './wit';
import { customStringify, LogEntry } from './console';

export interface ExportsContext {
  // Exports of the instantiated component, as returned by jco's `instantiate`.
  exports: any;
  log(call: string): LogEntry;
  // Tracks a new resource instance and returns its id.
  addInstance(resource: WIT.ResourceClass, obj: any): string;
}

export type CallTarget =
  | { type: 'func'; iface: WIT.InterfaceClass }
  | { type: 'constructor' | 'static'; iface: WIT.InterfaceClass; resource: WIT.ResourceClass }
  | { type: 'method'; resource: WIT.ResourceClass; instance: string };

interface Call {
  label: string;
  invoke(): any;
  // Handles the result and optionally returns what to log in its place.
  onResult?(result: any): any;
}

function exportsOf(ctx: ExportsContext, iface: WIT.InterfaceClass): any {
  return iface.isRoot ? ctx.exports : ctx.exports[iface._name];
}

function resolveCall(ctx: ExportsContext, target: CallTarget, name: string, args: any[]): Call {
  const argList = args.map((arg) => customStringify(arg)).join(', ');
  switch (target.type) {
    case 'func': {
      const mod = exportsOf(ctx, target.iface);
      return { label: `${name}(${argList})`, invoke: () => mod[name](...args) };
    }
    case 'constructor': {
      const cls = exportsOf(ctx, target.iface)[target.resource._name];
      return {
        label: `new ${target.resource._name}(${argList})`,
        invoke: () => new cls(...args),
        onResult: (obj) => ctx.addInstance(target.resource, obj),
      };
    }
    case 'static': {
      const cls = exportsOf(ctx, target.iface)[target.resource._name];
      return { label: `${target.resource._name}.${name}(${argList})`, invoke: () => cls[name](...args) };
    }
    case 'method': {
      const obj = target.resource.instances[target.instance];
      return { label: `${target.instance}.${name}(${argList})`, invoke: () => obj[name](...args) };
    }
  }
}

export async function call(ctx: ExportsContext, target: CallTarget, name: string, args: any[]) {
  let resolved: Call;
  try {
    resolved = resolveCall(ctx, target, name, args);
  } catch (err) {
    ctx.log(name).error(err);
    return;
  }
  const entry = ctx.log(resolved.label);
  try {
    const result = await resolved.invoke();
    entry.result(resolved.onResult?.(result) ?? result);
  } catch (err) {
    entry.error(err);
    console.error(err);
  }
}

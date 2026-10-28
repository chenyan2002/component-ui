import * as WIT from './wit';
import { qualified, qualifiedResource } from './call-record';
import type { CallTarget } from './calls';
import { definedResources, ResourceRegistry } from './resources';

// The functions there are to call, as the UI's exports show them and the CLI's calls are written:
// each interface's functions and those of the resources it defines, and the functions of the
// resources defined elsewhere, i.e. by imports, that the exports use.

// A function to call: as the console shows it, e.g. `docs:calc/calc@0.1.0.eval`, `new exports/x`
// or `exports/x.get-a`; jco's name for it; and what it is called on.
export interface Callable {
  callee: string;
  key: string;
  func: WIT.FuncClass;
  target: CallTarget;
}

export interface ResourceCallables {
  resource: WIT.ResourceClass;
  callables: Callable[];
}

export interface InterfaceCallables {
  iface: WIT.InterfaceClass;
  funcs: Callable[];
  // The resources it defines; those it `use`s, under its own name or another, e.g. `pollable as
  // body`, are where they are defined.
  resources: ResourceCallables[];
}

export interface ExportCallables {
  interfaces: InterfaceCallables[];
  // The resources the exports use that imports define, whose functions can make their arguments.
  hostResources: ResourceCallables[];
}

// The functions of a resource: its constructor and statics, called through `iface`, which a call
// to an imported resource doesn't need, then its methods. Without `iface`, only its methods.
export function resourceCallables(resource: WIT.ResourceClass, iface?: WIT.InterfaceClass): Callable[] {
  const name = qualifiedResource(resource);
  const statics = iface === undefined ? [] : resource.get_static_funcs().map(([key, func]): Callable => ({
    callee: func.callKind === 'constructor' ? `new ${name}` : `${name}.${func.displayName(key)}`,
    key, func, target: { type: func.callKind as 'constructor' | 'static', iface, resource },
  }));
  const methods = resource.get_method_funcs().map(([key, func]): Callable => ({
    callee: `${name}.${func.displayName(key)}`, key, func, target: { type: 'method', resource },
  }));
  return [...statics, ...methods];
}

// The functions of an interface, and those of the resources it defines.
export function interfaceCallables(iface: WIT.InterfaceClass): InterfaceCallables {
  return {
    iface,
    funcs: Object.entries(iface._fields).map(([key, func]) => ({
      callee: qualified(iface._name, func.displayName(key)), key, func, target: { type: 'func', iface },
    })),
    resources: definedResources(iface).map((resource) => ({ resource, callables: resourceCallables(resource, iface) })),
  };
}

export function exportCallables(interfaces: WIT.InterfaceClass[]): ExportCallables {
  const defined = new Set(interfaces.flatMap(definedResources));
  // Each with the first interface that uses it.
  const used = new Map<WIT.ResourceClass, WIT.InterfaceClass>();
  for (const iface of interfaces) {
    for (const resource of iface.get_resources()) {
      if (!defined.has(resource) && !used.has(resource)) {
        used.set(resource, iface);
      }
    }
  }
  return {
    interfaces: interfaces.map(interfaceCallables),
    hostResources: [...used].map(([resource, iface]) => ({ resource, callables: resourceCallables(resource, iface) })),
  };
}

// The resources the UI has held instances of that the exports don't have, e.g. a host object an
// export returned, whose methods it can call.
export function heldResources(registry: ResourceRegistry, exports: ExportCallables): ResourceCallables[] {
  const known = new Set([...exports.interfaces.flatMap((i) => i.resources), ...exports.hostResources].map((r) => r.resource));
  return registry.resources().filter((resource) => !known.has(resource)).map((resource) => ({ resource, callables: resourceCallables(resource) }));
}

// All the functions, of the interfaces and then of their resources, in order.
export function allCallables(interfaces: InterfaceCallables[], resources: ResourceCallables[] = []): Callable[] {
  return [...interfaces.flatMap((i) => [...i.funcs, ...i.resources.flatMap((r) => r.callables)]), ...resources.flatMap((r) => r.callables)];
}

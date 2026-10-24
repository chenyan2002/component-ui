import * as WIT from './wit';
import { Instance, ResourceRegistry } from './resources';
import { formatArgList, formatHandle } from './wave';

// Who makes a call and who serves it: the UI calling an export of the guest, the UI calling the
// host directly, e.g. a method of a host resource, or the guest calling an import.
export type CallSide = 'export' | 'host' | 'import';

// A call as it is logged: what was called with which arguments, and how the console shows it.
export interface CallRecord {
  kind: CallSide;
  callKind: WIT.CallKind | 'drop';
  // The interface of the function, or the one defining the resource, with its version, e.g.
  // `wasi:cli/stdout@0.2.3`; empty at the world level.
  iface: string;
  // The resource of a constructor, method, static function or drop, by WIT name.
  resource?: string;
  // The function's WIT name, without the resource's, e.g. `headers` for
  // `[method]fields.headers`; `constructor` for a constructor and `drop` for a drop.
  func: string;
  // The instance a method is called on or a drop drops, e.g. `#borrowed-x-1`.
  self?: string;
  // The arguments in WAVE, one per parameter; a method's `self` isn't one.
  args: string[];
  // How the console shows the call, e.g. `wasi:cli/stdout@0.2.3.get-stdout()`.
  label: string;
}

// What a call is to: a function of an interface, or a function of a resource. A method's `self`
// is the instance it is called on.
export type Callee =
  | { callKind: 'func'; iface: string }
  | { callKind: 'constructor' | 'static'; resource: WIT.ResourceClass }
  | { callKind: 'method'; resource: WIT.ResourceClass; self: unknown };

function isWorldLevel(iface: string): boolean {
  return iface === '' || iface === WIT.ROOT_INTERFACE;
}

// `wasi:cli/stdout@0.2.0` → `wasi:cli/stdout`.
export function unversioned(pkg: string): string {
  return pkg.replace(/@[^/]*$/, '');
}

// A function of an interface as the console shows it, e.g. `wasi:cli/stdout@0.2.3.get-stdout`;
// functions at the world level have no interface.
export function qualified(iface: string, name: string): string {
  return isWorldLevel(iface) ? name : `${iface}.${name}`;
}

// A resource as the console shows it, under the interface that defines it and followed by its
// version, e.g. `wasi:http/types/fields@0.2.3`.
export function qualifiedResource(resource: WIT.ResourceClass): string {
  const iface = resource._interface;
  if (isWorldLevel(iface)) {
    return resource.witName;
  }
  const name = unversioned(iface);
  return `${name}/${resource.witName}${iface.slice(name.length)}`;
}

// Describes a call of `func`, jco's `key` on the callee, with `args`. Made before the call
// takes the arguments, so owned ones show by the ids they have now.
export function describeCall(
  registry: ResourceRegistry, kind: CallSide, callee: Callee, func: WIT.FuncClass | undefined, key: string, args: any[],
): CallRecord {
  const name = callee.callKind === 'constructor' ? 'constructor' : func?.displayName(key) ?? WIT.kebabName(key);
  const formatted = formatArgList(registry, func, args);
  const list = formatted.join(', ');
  const record = { kind, callKind: callee.callKind, func: name, args: formatted };
  switch (callee.callKind) {
    case 'func':
      return { ...record, iface: isWorldLevel(callee.iface) ? '' : callee.iface, label: `${qualified(callee.iface, name)}(${list})` };
    case 'constructor':
    case 'static': {
      const { resource } = callee;
      const label = callee.callKind === 'constructor'
        ? `new ${qualifiedResource(resource)}(${list})`
        : `${qualifiedResource(resource)}.${name}(${list})`;
      return { ...record, ...resourceFields(resource), label };
    }
    case 'method': {
      const self = formatHandle(registry, callee.self, callee.resource, true);
      return { ...record, ...resourceFields(callee.resource), self, label: `${self}.${name}(${list})` };
    }
  }
}

// Describes the UI dropping `instance`, which runs the destructor of its guest or host.
export function describeDrop(instance: Instance): CallRecord {
  const self = `#${instance.id}`;
  return {
    kind: instance.holders ? 'host' : 'export', callKind: 'drop', ...resourceFields(instance.resource), func: 'drop', self, args: [],
    label: `drop ${self}`,
  };
}

function resourceFields(resource: WIT.ResourceClass): Pick<CallRecord, 'iface' | 'resource'> {
  return { iface: isWorldLevel(resource._interface) ? '' : resource._interface, resource: resource.witName };
}

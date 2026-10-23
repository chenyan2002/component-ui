import { html, nothing } from 'lit';
import * as WIT from './wit';
import { CallTarget, ExportsContext } from './calls';
import { qualifiedResource } from './host-resources';
import './func-card';

function funcCards(ctx: ExportsContext, funcs: Array<[string, WIT.FuncClass]>, target: (func: WIT.FuncClass) => CallTarget) {
  if (funcs.length === 0) {
    return nothing;
  }
  return html`<div class="func-grid">
    ${funcs.map(([name, func]) =>
      html`<func-card .ctx=${ctx} .name=${name} .func=${func} .target=${target(func)}></func-card>`)}
  </div>`;
}

function summary(kind: string, name: string, count: number, unit: string) {
  return html`<div slot="summary" class="section-summary">
    <wa-tag size="s" variant="brand" appearance="outlined">${kind}</wa-tag>
    <code title=${name}>${name}</code>
    <wa-badge variant="neutral" appearance="filled" pill>${count} ${unit}${count === 1 ? '' : 's'}</wa-badge>
  </div>`;
}

// The resources an interface defines. Those it `use`s, under its own name or another, e.g.
// `pollable as body`, show only where they are defined.
function definedResources(iface: WIT.InterfaceClass): WIT.ResourceClass[] {
  return [...new Set(iface.get_resources().filter((r) => r._interface === iface._name))];
}

function renderResource(ctx: ExportsContext, iface: WIT.InterfaceClass, resource: WIT.ResourceClass, name = resource.witName) {
  const statics = resource.get_static_funcs();
  const methods = resource.get_method_funcs();
  // Collapsed by default; resource sections can be long.
  return html`<wa-details class="resource">
    ${summary('resource', name, statics.length + methods.length, 'function')}
    ${funcCards(ctx, statics, (func) => ({ type: func.callKind as 'constructor' | 'static', iface, resource }))}
    ${funcCards(ctx, methods, () => ({ type: 'method', resource }))}
  </wa-details>`;
}

// Resources defined elsewhere, i.e. by imports: those the exports `use`, and those returned by
// exports. They show once each, together in one card, named with the interface that defines them.
// Collapsed by default, ahead of the exports.
function renderHostResources(ctx: ExportsContext, interfaces: WIT.InterfaceClass[]) {
  const defined = new Set(interfaces.flatMap(definedResources));
  // Each with an interface that uses it, which calls to an imported resource don't need.
  const used = new Map<WIT.ResourceClass, WIT.InterfaceClass>();
  for (const iface of interfaces) {
    for (const resource of iface.get_resources()) {
      if (!defined.has(resource) && !used.has(resource)) {
        used.set(resource, iface);
      }
    }
  }
  const returned = ctx.registry.resources().filter((r) => !defined.has(r) && !used.has(r));
  if (used.size + returned.length === 0) {
    return [];
  }
  return [html`<wa-details class="interface">
    ${summary('interface', 'host resources', used.size + returned.length, 'resource')}
    ${[...used].map(([resource, iface]) => renderResource(ctx, iface, resource, qualifiedResource(resource)))}
    ${returned.map((resource) => {
      const methods = resource.get_method_funcs();
      return html`<wa-details class="resource">
        ${summary('resource', qualifiedResource(resource), methods.length, 'method')}
        ${funcCards(ctx, methods, () => ({ type: 'method', resource }))}
      </wa-details>`;
    })}
  </wa-details>`];
}

export function renderExports(ctx: ExportsContext, interfaces: WIT.InterfaceClass[]) {
  return renderHostResources(ctx, interfaces).concat(interfaces.map((iface) => {
    const funcs = Object.entries(iface._fields);
    return html`<wa-details open class="interface">
      ${summary('interface', iface.isRoot ? 'world exports' : iface._name, funcs.length, 'function')}
      ${definedResources(iface).map((resource) => renderResource(ctx, iface, resource))}
      ${funcCards(ctx, funcs, () => ({ type: 'func', iface }))}
    </wa-details>`;
  }));
}

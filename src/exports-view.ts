import { html, nothing } from 'lit';
import * as WIT from './wit';
import { CallTarget, ExportsContext } from './calls';
import { qualifiedResource } from './host-resources';
import './func-card';

// Whether a function shows for the search, given its name and those of the sections it is in.
// Those that don't are hidden rather than removed, so their cards keep their state; sections
// without any to show are hidden by the stylesheet.
export type Search = (...names: string[]) => boolean;

export function search(text: string): Search {
  const query = text.trim().toLowerCase();
  return (...names) => names.some((name) => name.toLowerCase().includes(query));
}

// The search within a section, which shows all its functions if its name matches.
function within(shown: Search, section: string): Search {
  return (...names) => shown(...names, section);
}

function funcCards(ctx: ExportsContext, funcs: Array<[string, WIT.FuncClass]>, target: (func: WIT.FuncClass) => CallTarget, shown: Search) {
  if (funcs.length === 0) {
    return nothing;
  }
  return html`<div class="func-grid">
    ${funcs.map(([name, func]) =>
      html`<func-card ?hidden=${!shown(func.displayName(name))} .ctx=${ctx} .name=${name} .func=${func} .target=${target(func)}></func-card>`)}
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

function renderResource(ctx: ExportsContext, iface: WIT.InterfaceClass, resource: WIT.ResourceClass, shown: Search, name = resource.witName) {
  const statics = resource.get_static_funcs();
  const methods = resource.get_method_funcs();
  shown = within(shown, name);
  // Collapsed by default; resource sections can be long.
  return html`<wa-details class="resource">
    ${summary('resource', name, statics.length + methods.length, 'function')}
    ${funcCards(ctx, statics, (func) => ({ type: func.callKind as 'constructor' | 'static', iface, resource }), shown)}
    ${funcCards(ctx, methods, () => ({ type: 'method', resource }), shown)}
  </wa-details>`;
}

// Resources defined elsewhere, i.e. by imports: those the exports `use`, and those returned by
// exports. They show once each, together in one card, named with the interface that defines them.
// Collapsed by default, ahead of the exports.
function renderHostResources(ctx: ExportsContext, interfaces: WIT.InterfaceClass[], shown: Search) {
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
  shown = within(shown, 'host resources');
  return [html`<wa-details class="interface">
    ${summary('interface', 'host resources', used.size + returned.length, 'resource')}
    ${[...used].map(([resource, iface]) => renderResource(ctx, iface, resource, shown, qualifiedResource(resource)))}
    ${returned.map((resource) => {
      const methods = resource.get_method_funcs();
      const name = qualifiedResource(resource);
      return html`<wa-details class="resource">
        ${summary('resource', name, methods.length, 'method')}
        ${funcCards(ctx, methods, () => ({ type: 'method', resource }), within(shown, name))}
      </wa-details>`;
    })}
  </wa-details>`];
}

export function renderExports(ctx: ExportsContext, interfaces: WIT.InterfaceClass[], shown: Search) {
  return renderHostResources(ctx, interfaces, shown).concat(interfaces.map((iface) => {
    const funcs = Object.entries(iface._fields);
    const name = iface.isRoot ? 'world exports' : iface._name;
    const inIface = within(shown, name);
    return html`<wa-details open class="interface">
      ${summary('interface', name, funcs.length, 'function')}
      ${definedResources(iface).map((resource) => renderResource(ctx, iface, resource, inIface))}
      ${funcCards(ctx, funcs, () => ({ type: 'func', iface }), inIface)}
    </wa-details>`;
  }));
}

import { html, nothing } from 'lit';
import * as WIT from './wit';
import { Callable, ExportCallables, exportCallables, heldResources, ResourceCallables } from './callables';
import { ExportsContext } from './calls';
import { qualifiedResource } from './call-record';
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

function funcCards(ctx: ExportsContext, callables: Callable[], shown: Search) {
  if (callables.length === 0) {
    return nothing;
  }
  return html`<div class="func-grid">
    ${callables.map(({ key, func, target }) =>
      html`<func-card ?hidden=${!shown(func.displayName(key))} .ctx=${ctx} .name=${key} .func=${func} .target=${target}></func-card>`)}
  </div>`;
}

function summary(kind: string, name: string, count: number, unit: string) {
  return html`<div slot="summary" class="section-summary">
    <wa-tag size="s" variant="brand" appearance="outlined">${kind}</wa-tag>
    <code title=${name}>${name}</code>
    <wa-badge variant="neutral" appearance="filled" pill>${count} ${unit}${count === 1 ? '' : 's'}</wa-badge>
  </div>`;
}

// A resource's constructor and statics, then its methods. Collapsed by default; resource
// sections can be long.
function renderResource(ctx: ExportsContext, { resource, callables }: ResourceCallables, shown: Search, name = resource.witName, unit = 'function') {
  const methods = callables.filter((c) => c.target.type === 'method');
  shown = within(shown, name);
  return html`<wa-details class="resource">
    ${summary('resource', name, callables.length, unit)}
    ${funcCards(ctx, callables.filter((c) => c.target.type !== 'method'), shown)}
    ${funcCards(ctx, methods, shown)}
  </wa-details>`;
}

// Resources defined elsewhere, i.e. by imports: those the exports `use`, and those returned by
// exports, of which only the methods can be called. They show once each, together in one card,
// named with the interface that defines them. Collapsed by default, ahead of the exports.
function renderHostResources(ctx: ExportsContext, exports: ExportCallables, shown: Search) {
  const held = heldResources(ctx.registry, exports);
  const count = exports.hostResources.length + held.length;
  if (count === 0) {
    return [];
  }
  shown = within(shown, 'host resources');
  return [html`<wa-details class="interface">
    ${summary('interface', 'host resources', count, 'resource')}
    ${exports.hostResources.map((resource) => renderResource(ctx, resource, shown, qualifiedResource(resource.resource)))}
    ${held.map((resource) => renderResource(ctx, resource, shown, qualifiedResource(resource.resource), 'method'))}
  </wa-details>`];
}

export function renderExports(ctx: ExportsContext, interfaces: WIT.InterfaceClass[], shown: Search) {
  const exports = exportCallables(interfaces);
  return renderHostResources(ctx, exports, shown).concat(exports.interfaces.map(({ iface, funcs, resources }) => {
    const name = iface.isRoot ? 'world exports' : iface._name;
    const inIface = within(shown, name);
    return html`<wa-details open class="interface">
      ${summary('interface', name, funcs.length, 'function')}
      ${resources.map((resource) => renderResource(ctx, resource, inIface))}
      ${funcCards(ctx, funcs, inIface)}
    </wa-details>`;
  }));
}

import { html, nothing } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import * as WIT from './wit';
import { CallTarget, drop, ExportsContext } from './calls';
import { Instance } from './resources';
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
    <code>${name}</code>
    <wa-badge variant="neutral" appearance="filled" pill>${count} ${unit}${count === 1 ? '' : 's'}</wa-badge>
  </div>`;
}

function renderInstance(ctx: ExportsContext, instance: Instance) {
  const { id, resource, state } = instance;
  const live = state === 'live';
  return html`<wa-card appearance="filled" class=${classMap({ 'instance-card': true, dead: !live })}>
    <div slot="header" class="instance-header">
      <div class="instance-title">
        <code>${id}</code>
        ${live ? nothing : html`<wa-tag size="s" variant="warning">${state}</wa-tag>`}
        <span class="muted instance-origin" title=${instance.origin}>from ${instance.origin}</span>
      </div>
      ${live
        ? html`<wa-button size="s" appearance="outlined" title="Run the resource's destructor" @click=${() => drop(ctx, id)}>
            Drop
          </wa-button>`
        : html`<wa-button size="s" appearance="plain" @click=${() => ctx.registry.dismiss(id)}>Dismiss</wa-button>`}
    </div>
    ${live
      ? funcCards(ctx, resource.get_method_funcs(), () => ({ type: 'method', resource, instance: id }))
      : html`<div class="muted">${id} was ${instance.fate}, so it can no longer be used.</div>`}
  </wa-card>`;
}

function renderInstances(ctx: ExportsContext, resource: WIT.ResourceClass, emptyMessage?: string) {
  const instances = ctx.registry.instances(resource);
  if (instances.length === 0 && !emptyMessage) {
    return nothing;
  }
  return html`<h4 class="subheading">Instances</h4>
    <div class="instances">
      ${instances.length === 0
        ? html`<div class="muted">${emptyMessage}</div>`
        : repeat(instances, (i) => i.id, (i) => renderInstance(ctx, i))}
    </div>`;
}

function renderResource(ctx: ExportsContext, iface: WIT.InterfaceClass, resource: WIT.ResourceClass) {
  const statics = resource.get_static_funcs();
  const hasConstructor = statics.some(([_, func]) => func.callKind === 'constructor');
  return html`<wa-details open class="resource">
    ${summary('resource', resource._name, statics.length, 'function')}
    ${funcCards(ctx, statics, (func) => ({ type: func.callKind as 'constructor' | 'static', iface, resource }))}
    ${renderInstances(ctx, resource,
      hasConstructor ? 'No instances yet. Call the constructor to create one.' : undefined)}
  </wa-details>`;
}

// Resources returned by exports but defined elsewhere, e.g. in an imported interface.
function renderOtherResources(ctx: ExportsContext, interfaces: WIT.InterfaceClass[]) {
  const exported = new Set(interfaces.flatMap((iface) => iface.get_resources()));
  return ctx.registry.resources().filter((r) => !exported.has(r)).map((resource) =>
    html`<wa-details open class="interface">
      ${summary('resource', resource._name, resource.get_method_funcs().length, 'method')}
      ${renderInstances(ctx, resource)}
    </wa-details>`);
}

export function renderExports(ctx: ExportsContext, interfaces: WIT.InterfaceClass[]) {
  return interfaces.map((iface) => {
    const funcs = Object.entries(iface._fields);
    return html`<wa-details open class="interface">
      ${summary('interface', iface.isRoot ? 'world exports' : iface._name, funcs.length, 'function')}
      ${iface.get_resources().map((resource) => renderResource(ctx, iface, resource))}
      ${funcCards(ctx, funcs, () => ({ type: 'func', iface }))}
    </wa-details>`;
  }).concat(renderOtherResources(ctx, interfaces));
}

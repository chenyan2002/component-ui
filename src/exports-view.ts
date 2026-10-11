import { html, nothing } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import * as WIT from './wit';
import { CallTarget, ExportsContext } from './calls';
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

function renderInstance(ctx: ExportsContext, resource: WIT.ResourceClass, instance: string) {
  return html`<wa-card appearance="filled" class="instance-card">
    <div slot="header" class="instance-title">
      <code>${instance}</code>
      <wa-copy-button .value=${instance} copy-label="Copy id to pass as an argument"></wa-copy-button>
    </div>
    ${funcCards(ctx, resource.get_method_funcs(), () => ({ type: 'method', resource, instance }))}
  </wa-card>`;
}

function renderResource(ctx: ExportsContext, iface: WIT.InterfaceClass, resource: WIT.ResourceClass) {
  const statics = resource.get_static_funcs();
  const instances = Object.keys(resource.instances);
  // Without a constructor, instances can only come from other calls, which are not tracked yet.
  const hasConstructor = statics.some(([_, func]) => func.callKind === 'constructor');
  return html`<wa-details open class="resource">
    ${summary('resource', resource._name, statics.length, 'function')}
    ${funcCards(ctx, statics, (func) => ({ type: func.callKind as 'constructor' | 'static', iface, resource }))}
    ${hasConstructor
      ? html`<h4 class="subheading">Instances</h4>
          <div class="instances">
            ${instances.length === 0
              ? html`<div class="muted">No instances yet. Call the constructor to create one.</div>`
              : repeat(instances, (id) => id, (id) => renderInstance(ctx, resource, id))}
          </div>`
      : nothing}
  </wa-details>`;
}

export function renderExports(ctx: ExportsContext, interfaces: WIT.InterfaceClass[]) {
  return interfaces.map((iface) => {
    const funcs = Object.entries(iface._fields);
    return html`<wa-details open class="interface">
      ${summary('interface', iface.isRoot ? 'world exports' : iface._name, funcs.length, 'function')}
      ${iface.get_resources().map((resource) => renderResource(ctx, iface, resource))}
      ${funcCards(ctx, funcs, () => ({ type: 'func', iface }))}
    </wa-details>`;
  });
}

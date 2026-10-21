import { html, nothing } from 'lit';
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

function renderResource(ctx: ExportsContext, iface: WIT.InterfaceClass, resource: WIT.ResourceClass) {
  const statics = resource.get_static_funcs();
  const methods = resource.get_method_funcs();
  return html`<wa-details open class="resource">
    ${summary('resource', resource._name, statics.length + methods.length, 'function')}
    ${funcCards(ctx, statics, (func) => ({ type: func.callKind as 'constructor' | 'static', iface, resource }))}
    ${funcCards(ctx, methods, () => ({ type: 'method', resource }))}
  </wa-details>`;
}

// Resources returned by exports but defined elsewhere, e.g. in an imported interface.
function renderOtherResources(ctx: ExportsContext, interfaces: WIT.InterfaceClass[]) {
  const exported = new Set(interfaces.flatMap((iface) => iface.get_resources()));
  return ctx.registry.resources().filter((r) => !exported.has(r)).map((resource) => {
    const methods = resource.get_method_funcs();
    return html`<wa-details open class="interface resource">
      ${summary('resource', resource._name, methods.length, 'method')}
      ${funcCards(ctx, methods, () => ({ type: 'method', resource }))}
    </wa-details>`;
  });
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

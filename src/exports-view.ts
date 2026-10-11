import * as WIT from './wit';
import { renderInput, InputBox } from './ui';
import { ConsolePanel, customStringify } from './console';
import { el, slotted } from './dom';

export interface ExportsContext {
  // Exports of the instantiated component, as returned by jco's `instantiate`.
  exports: any;
  console: ConsolePanel;
}

type CallTarget =
  | { type: 'func'; iface: WIT.InterfaceClass }
  | { type: 'constructor' | 'static'; iface: WIT.InterfaceClass; resource: WIT.ResourceClass; instances: HTMLElement }
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
        onResult: (obj) => renderInstance(ctx, target.resource, obj, target.instances),
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

async function call(ctx: ExportsContext, target: CallTarget, name: string, args: any[]) {
  let resolved: Call;
  try {
    resolved = resolveCall(ctx, target, name, args);
  } catch (err) {
    ctx.console.logCall(name).error(err);
    return;
  }
  const entry = ctx.console.logCall(resolved.label);
  try {
    const result = await resolved.invoke();
    entry.result(resolved.onResult?.(result) ?? result);
  } catch (err) {
    entry.error(err);
    console.error(err);
  }
}

const MAX_TYPE_LENGTH = 48;

// Long inline types (e.g. large variants) are truncated; the full type is shown on hover.
function typeName(type: WIT.Type): HTMLElement {
  const name = type.name;
  const short = name.length > MAX_TYPE_LENGTH ? `${name.slice(0, MAX_TYPE_LENGTH - 1)}…` : name;
  return el('span', { className: 'sig-type', title: name }, short);
}

function renderSignature(name: string, func: WIT.FuncClass): HTMLElement {
  const signature = el('code', { className: 'signature' }, el('span', { className: 'sig-name' }, name), '(');
  func._args.forEach(([arg, type], i) => {
    if (i > 0) {
      signature.append(', ');
    }
    signature.append(el('span', { className: 'sig-arg' }, arg), ': ', typeName(type));
  });
  signature.append(')');
  if (func._ret.length > 0) {
    signature.append(' → ');
    func._ret.forEach((type, i) => signature.append(...(i > 0 ? [', '] : []), typeName(type)));
  }
  return signature;
}

function renderFunc(ctx: ExportsContext, name: string, func: WIT.FuncClass, target: CallTarget): HTMLElement {
  const header = slotted('header', el('div', { className: 'func-header' }, renderSignature(name, func)));
  if (target.type !== 'func') {
    header.append(el('wa-tag', { size: 's', variant: 'neutral' }, target.type));
  }
  const card = el('wa-card', { className: 'func-card' }, header);

  const inputs: InputBox[] = [];
  const form = el('div', { className: 'func-args' });
  for (const [arg, type] of func._args) {
    const input = renderInput(type);
    input.label = arg;
    input.render(form);
    inputs.push(input);
  }
  if (inputs.length === 0) {
    form.append(el('span', { className: 'muted' }, 'No arguments'));
  }
  card.append(form);

  const actions = slotted('footer', el('div', { className: 'func-actions' }));
  const submit = async (button: HTMLElementTagNameMap['wa-button'], random: boolean) => {
    const args = inputs.map((input) => input.parse({ random }));
    if (inputs.some((input) => input.isRejected())) {
      return;
    }
    button.loading = true;
    try {
      await call(ctx, target, name, args);
    } finally {
      button.loading = false;
    }
  };
  const callButton = el('wa-button', { variant: 'brand', size: 's' }, 'Call');
  callButton.addEventListener('click', () => submit(callButton, false));
  actions.append(callButton);
  if (inputs.length > 0) {
    const randomButton = el('wa-button', { appearance: 'outlined', size: 's' }, 'Random');
    randomButton.title = 'Fill empty fields with random values and call';
    randomButton.addEventListener('click', () => submit(randomButton, true));
    actions.append(randomButton);
  }
  card.append(actions);
  return card;
}

function summary(kind: string, name: string, count: number, unit: string): HTMLElement {
  return slotted('summary', el('div', { className: 'section-summary' },
    el('wa-tag', { size: 's', variant: 'brand', appearance: 'outlined' }, kind),
    el('code', {}, name),
    el('wa-badge', { variant: 'neutral', appearance: 'filled', pill: true }, `${count} ${unit}${count === 1 ? '' : 's'}`),
  ));
}

function renderResource(ctx: ExportsContext, iface: WIT.InterfaceClass, resource: WIT.ResourceClass): HTMLElement {
  const statics = resource.get_static_funcs();
  const instances = el('div', { className: 'instances' },
    el('div', { className: 'muted instances-empty' }, 'No instances yet. Call the constructor to create one.'),
  );
  const details = el('wa-details', { open: true, className: 'resource' },
    summary('resource', resource._name, statics.length, 'function'),
    el('div', { className: 'func-grid' },
      ...statics.map(([name, func]) =>
        renderFunc(ctx, name, func, { type: func.callKind as 'constructor' | 'static', iface, resource, instances })),
    ),
  );
  // Without a constructor, instances can only come from other calls, which are not tracked yet.
  if (statics.some(([_, func]) => func.callKind === 'constructor')) {
    details.append(el('h4', { className: 'subheading' }, 'Instances'), instances);
  }
  return details;
}

// Returns the id of the new instance, which can be passed as a resource argument.
function renderInstance(ctx: ExportsContext, resource: WIT.ResourceClass, obj: any, container: HTMLElement): string {
  const instance = resource.add_instance(obj);
  container.querySelector('.instances-empty')?.remove();
  const copy = el('wa-copy-button', { value: instance, copyLabel: 'Copy id to pass as an argument' });
  const card = el('wa-card', { appearance: 'filled', className: 'instance-card' },
    slotted('header', el('div', { className: 'instance-title' }, el('code', {}, instance), copy)),
    el('div', { className: 'func-grid' },
      ...resource.get_method_funcs().map(([name, func]) =>
        renderFunc(ctx, name, func, { type: 'method', resource, instance })),
    ),
  );
  container.append(card);
  return instance;
}

export function renderExports(root: HTMLElement, ctx: ExportsContext, interfaces: WIT.InterfaceClass[]) {
  root.replaceChildren();
  for (const iface of interfaces) {
    const funcs = Object.entries(iface._fields);
    const name = iface.isRoot ? 'world exports' : iface._name;
    root.append(el('wa-details', { open: true, className: 'interface' },
      summary('interface', name, funcs.length, 'function'),
      ...iface.get_resources().map((resource) => renderResource(ctx, iface, resource)),
      el('div', { className: 'func-grid' },
        ...funcs.map(([name, func]) => renderFunc(ctx, name, func, { type: 'func', iface })),
      ),
    ));
  }
}

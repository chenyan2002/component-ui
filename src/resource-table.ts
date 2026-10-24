import { html, LitElement, nothing, PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import { drop, ExportsContext, watchContext } from './calls';
import { MOCK } from './dialog';
import { callable, Instance, InstanceState, Slot } from './resources';

const STATE_VARIANTS: Record<InstanceState, string> = { live: 'success', moved: 'warning', dropped: 'neutral' };

// Who holds a live host-implemented instance, e.g. `held by guest ×2`.
function renderHolders({ holders, state }: Instance) {
  if (!holders || state !== 'live') {
    return nothing;
  }
  const guest = holders.guest > 1 ? `guest ×${holders.guest}` : holders.guest === 1 ? 'guest' : undefined;
  const names = [holders.ui ? 'you' : undefined, guest].filter((name) => name !== undefined);
  return html`<div class="instance-holders">held by ${names.join(', ')}</div>`;
}

function renderHistory(instance: Instance) {
  return html`<code class="instance-origin" title=${instance.origin}>${instance.origin}</code>
    ${instance.fate ? html`<div class="instance-fate">→ ${instance.fate}</div>` : nothing}`;
}

// The earlier occupants of a reused handle index, oldest first.
function renderEarlier(slot: Slot) {
  if (slot.earlier.length === 0) {
    return nothing;
  }
  return html`<details class="earlier">
    <summary>${slot.earlier.length} earlier</summary>
    <ul>
      ${slot.earlier.map((i) => html`<li><code>${i.id}</code> · ${renderHistory(i)}</li>`)}
    </ul>
  </details>`;
}

// The resource instances of a component instance, one row per handle index.
@customElement('resource-table')
export class ResourceTable extends LitElement {
  @property({ attribute: false }) accessor ctx!: ExportsContext;
  // Clears the search of the exports, which may hide the card of a method, once it re-rendered.
  @property({ attribute: false }) accessor clearSearch: () => Promise<unknown> = async () => {};

  private readonly onContextChange = () => this.requestUpdate();

  protected createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    watchContext(this.ctx, this.onContextChange, true);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    watchContext(this.ctx, this.onContextChange, false);
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has('ctx')) {
      watchContext(changed.get('ctx'), this.onContextChange, false);
      watchContext(this.ctx, this.onContextChange, true);
    }
  }

  protected render() {
    const rows = this.ctx.registry.rows();
    const live = rows.filter((slot) => slot.current.state === 'live').length;
    const freed = rows.length - live;
    return html`
      <div class="panel-header">
        <span class="panel-title">
          <wa-icon name="cube"></wa-icon> Resources
          <span class="muted">${live} live${freed > 0 ? ` · ${freed} freed` : ''}</span>
        </span>
        <wa-button size="s" appearance="plain" ?disabled=${freed === 0} @click=${() => this.ctx.registry.dismissFreed()}>
          Clear freed
        </wa-button>
      </div>
      <div class="resource-scroll">
        ${rows.length === 0
          ? html`<div class="console-empty">No resource instances yet. Call a constructor or a function that returns a resource.</div>`
          : html`<table class="resource-table">
              <thead>
                <tr><th title="Handle index">#</th><th>Instance</th><th>State</th><th>History</th><th></th></tr>
              </thead>
              <tbody>
                ${repeat(rows, (slot) => `${slot.key}:${slot.version}`, (slot) => this.renderRow(slot))}
              </tbody>
            </table>`}
      </div>
    `;
  }

  // Rows are keyed by version, so a changed row is re-created and plays its highlight.
  private renderRow(slot: Slot) {
    const instance = slot.current;
    const { id, resource, state } = instance;
    const isLive = state === 'live';
    // The guest's handles on a host object are its own to drop.
    const canDrop = isLive && callable(instance);
    return html`<tr class=${classMap({ 'resource-row': true, dead: !isLive })} data-id=${id}>
      <td class="handle">${slot.handle ?? html`<span class="muted">host</span>`}</td>
      <td>
        ${this.renderId(instance)}
        <div class="instance-type">${resource.witName}${MOCK in instance.obj ? ' · mock' : ''}</div>
      </td>
      <td><wa-tag size="s" variant=${STATE_VARIANTS[state]}>${state}</wa-tag>${renderHolders(instance)}</td>
      <td class="history">${renderHistory(instance)}${renderEarlier(slot)}</td>
      <td class="row-actions">
        ${canDrop
          ? html`<wa-button
              size="s"
              appearance="outlined"
              title="Run the resource's destructor"
              ?disabled=${this.ctx.activity.pending > 0}
              @click=${() => drop(this.ctx, id)}
            >
              Drop
            </wa-button>`
          : isLive
            ? nothing
            : html`<wa-button size="s" appearance="plain" @click=${() => this.ctx.registry.dismiss(id)}>Dismiss</wa-button>`}
      </td>
    </tr>`;
  }

  // A live instance the UI holds opens a menu of its methods.
  private renderId(instance: Instance) {
    const methods = instance.resource.get_method_funcs();
    if (instance.state !== 'live' || !callable(instance) || methods.length === 0) {
      return html`<code class="instance-id">${instance.id}</code>`;
    }
    return html`<wa-dropdown @wa-select=${(e: CustomEvent<{ item: HTMLElement & { value: string } }>) =>
      this.useMethod(instance, e.detail.item.value)}>
      <button slot="trigger" class="instance-id" title="Call a method of ${instance.id}"><code>${instance.id}</code></button>
      ${methods.map(([name, func]) => html`<wa-dropdown-item value=${name}><code>${func.displayName(name)}</code></wa-dropdown-item>`)}
    </wa-dropdown>`;
  }

  // Scrolls to the method's card with the instance selected as `self`, expanding its sections.
  private async useMethod(instance: Instance, name: string) {
    const card = [...document.querySelectorAll('func-card')].find(({ target, name: n }) =>
      target.type === 'method' && target.resource === instance.resource && n === name);
    if (!card) {
      return;
    }
    if (card.hidden) {
      await this.clearSearch();
    }
    card.selectSelf(instance.id);
    for (let section = card.closest('wa-details'); section; section = section.parentElement?.closest('wa-details') ?? null) {
      if (!section.open) {
        // Scroll once the section has finished expanding, so the card has its final position.
        const collapsed = section;
        const shown = new Promise((resolve) => collapsed.addEventListener('wa-after-show', resolve, { once: true }));
        collapsed.open = true;
        await shown;
      }
    }
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('highlight');
    card.addEventListener('animationend', () => card.classList.remove('highlight'), { once: true });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'resource-table': ResourceTable;
  }
}

import { html, LitElement, nothing, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import * as WIT from './wit';
import { call, CallTarget, ExportsContext } from './calls';
import { Draft, initDraft, parseArgs, randomize } from './draft';
import { renderField } from './form';

const MAX_TYPE_LENGTH = 48;

// Long inline types (e.g. large variants) are truncated; the full type is shown on hover.
function typeName(type: WIT.Type) {
  const name = type.name;
  const short = name.length > MAX_TYPE_LENGTH ? `${name.slice(0, MAX_TYPE_LENGTH - 1)}…` : name;
  return html`<span class="sig-type" title=${name}>${short}</span>`;
}

function renderSignature(name: string, func: WIT.FuncClass) {
  const args = func._args.map(([arg, type], i) =>
    html`${i > 0 ? ', ' : ''}<span class="sig-arg">${arg}</span>: ${typeName(type)}`);
  const ret = func._ret.map((type, i) => html`${i > 0 ? ', ' : ''}${typeName(type)}`);
  return html`<code class="signature"><span class="sig-name">${name}</span>(${args})${ret.length > 0 ? html` → ${ret}` : nothing}</code>`;
}

// A card with the signature, argument form and call buttons of one exported function.
@customElement('func-card')
export class FuncCard extends LitElement {
  @property({ attribute: false }) accessor name = '';
  @property({ attribute: false }) accessor func!: WIT.FuncClass;
  @property({ attribute: false }) accessor target!: CallTarget;
  @property({ attribute: false }) accessor ctx!: ExportsContext;
  @state() accessor busy: 'call' | 'random' | undefined = undefined;

  // Drafts are mutated in place by the form, which then calls requestUpdate().
  private drafts: Draft[] = [];

  protected createRenderRoot() {
    return this;
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has('func')) {
      this.drafts = this.func._args.map(([_, type]) => initDraft(type));
    }
  }

  protected render() {
    const args = this.func._args;
    const update = () => this.requestUpdate();
    return html`<wa-card class="func-card">
      <div slot="header" class="func-header">
        ${renderSignature(this.name, this.func)}
        ${this.target.type === 'func' ? nothing : html`<wa-tag size="s" variant="neutral">${this.target.type}</wa-tag>`}
      </div>
      <div class="func-args">
        ${args.length === 0
          ? html`<span class="muted">No arguments</span>`
          : args.map(([arg, type], i) => renderField(type, this.drafts[i], update, arg))}
      </div>
      <div slot="footer" class="func-actions">
        <wa-button variant="brand" size="s" ?loading=${this.busy === 'call'} @click=${() => this.submit(false)}>
          Call
        </wa-button>
        ${args.length === 0
          ? nothing
          : html`<wa-button
              appearance="outlined"
              size="s"
              title="Fill empty fields with random values and call"
              ?loading=${this.busy === 'random'}
              @click=${() => this.submit(true)}
            >
              Random
            </wa-button>`}
      </div>
    </wa-card>`;
  }

  private async submit(random: boolean) {
    if (this.busy) {
      return;
    }
    const types = this.func._args.map(([_, type]) => type);
    if (random) {
      types.forEach((type, i) => randomize(type, this.drafts[i]));
    }
    const args = parseArgs(types, this.drafts);
    this.requestUpdate();
    if (!args) {
      return;
    }
    this.busy = random ? 'random' : 'call';
    try {
      await call(this.ctx, this.target, this.name, args);
    } finally {
      this.busy = undefined;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'func-card': FuncCard;
  }
}

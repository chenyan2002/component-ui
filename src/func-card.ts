import { html, LitElement, nothing, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import * as WIT from './wit';
import { call, CallTarget, ExportsContext, watchContext } from './calls';
import { Draft, initDraft, parseArgs, randomize, TextDraft } from './draft';
import { FormContext, renderField, typeName } from './form';


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
  // Resource pickers list live instances, and calls wait for others to finish, so re-render
  // when either changes.
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

  // Selects `id` as the `self` argument of a method.
  public selectSelf(id: string) {
    const self = this.drafts[0] as TextDraft;
    self.text = id;
    self.auto = false;
    self.error = undefined;
    this.requestUpdate();
  }

  // The arguments of the form; methods take the instance first.
  private get args(): Array<[string, WIT.Type]> {
    const args = this.func._args;
    return this.target.type === 'method' ? [['self', this.target.resource], ...args] : args;
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has('func')) {
      this.drafts = this.args.map(([_, type]) => initDraft(type));
    }
    if (changed.has('ctx')) {
      watchContext(changed.get('ctx'), this.onContextChange, false);
      watchContext(this.ctx, this.onContextChange, true);
    }
  }

  protected render() {
    const args = this.args;
    const form: FormContext = { update: () => this.requestUpdate(), registry: this.ctx.registry, mock: this.ctx.mocks };
    // Another call is still running, e.g. waiting for an import's answer in the console.
    const blocked = !this.busy && this.ctx.activity.pending > 0;
    const blockedTitle = blocked ? 'Another call is still running' : undefined;
    return html`<wa-card class="func-card">
      <div slot="header" class="func-header">
        ${renderSignature(this.name, this.func)}
        ${this.target.type === 'func' ? nothing : html`<wa-tag size="s" variant="neutral">${this.target.type}</wa-tag>`}
      </div>
      <div class="func-args flow">
        ${args.length === 0
          ? html`<span class="muted">No arguments</span>`
          : args.map(([arg, type], i) => renderField(type, this.drafts[i], form, arg))}
      </div>
      <div slot="footer" class="func-actions">
        <wa-button variant="brand" size="s" ?loading=${this.busy === 'call'} ?disabled=${blocked} title=${blockedTitle ?? nothing} @click=${() => this.submit(false)}>
          Call
        </wa-button>
        ${args.length === 0
          ? nothing
          : html`<wa-button
              appearance="outlined"
              size="s"
              title=${blockedTitle ?? 'Fill empty fields with random values and call'}
              ?loading=${this.busy === 'random'}
              ?disabled=${blocked}
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
    const types = this.args.map(([_, type]) => type);
    const { registry } = this.ctx;
    if (random) {
      types.forEach((type, i) => randomize(type, this.drafts[i], registry, this.ctx.mocks));
    }
    const args = parseArgs(types, this.drafts, registry, this.ctx.mocks);
    this.requestUpdate();
    if (!args) {
      return;
    }
    this.busy = random ? 'random' : 'call';
    try {
      await call(this.ctx, this.target, this.name, this.func, args);
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

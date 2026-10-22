import { html, nothing, TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { live } from 'lit/directives/live.js';
import * as IDL from './wit';
import {
  BoolDraft, CaseDraft, Draft, FieldsDraft, ListDraft, MockFactory, NEW_MOCK, OptDraft, TextDraft,
  parseDraft, resizeList, selectCase, selectedInstance, setSome,
} from './draft';
import { ResourceRegistry } from './resources';

type Rendered = TemplateResult | typeof nothing;

export interface FormContext {
  // Drafts are mutated in place; call this afterwards to re-render the form.
  update(): void;
  registry: ResourceRegistry;
  // For an import's result, resource pickers also offer a new mock instance.
  mock?: MockFactory;
}

interface RenderData {
  d: Draft;
  ctx: FormContext;
}

const inputValue = (e: Event) => (e.target as HTMLInputElement).value;

function controlClass(d: Draft) {
  return classMap({ reject: !!d.error, auto: !!d.auto });
}

function subform(content: Rendered[], nested = true): Rendered {
  const visible = content.filter((c) => c !== nothing);
  if (visible.length === 0) {
    return nothing;
  }
  return html`<div class=${classMap({ subform: true, nested })}>${visible}</div>`;
}

class Render extends IDL.Visitor<RenderData, Rendered> {
  // Strings and numbers.
  public visitType<T>(t: IDL.Type<T>, { d, ctx }: RenderData): Rendered {
    const text = d as TextDraft;
    return html`<input
      class=${controlClass(d)}
      placeholder=${t.name}
      .value=${live(text.text)}
      @input=${(e: Event) => {
        text.text = inputValue(e);
        text.auto = false;
        text.error = undefined;
        ctx.update();
      }}
      @blur=${() => {
        if (text.text !== '') {
          parseDraft(t, d, ctx.registry, ctx.mock);
          ctx.update();
        }
      }}
    />`;
  }
  public visitNull(_t: IDL.NullClass, _data: RenderData): Rendered {
    return nothing;
  }
  public visitBool(_t: IDL.BoolClass, { d, ctx }: RenderData): Rendered {
    const bool = d as BoolDraft;
    return html`<input
      type="checkbox"
      .checked=${live(bool.checked)}
      @change=${(e: Event) => {
        bool.checked = (e.target as HTMLInputElement).checked;
        ctx.update();
      }}
    />`;
  }
  // Picks one of the live instances of the resource.
  public visitResource(t: IDL.ResourceClass, { d, ctx }: RenderData): Rendered {
    const text = d as TextDraft;
    const instances = ctx.registry.live(t);
    const mock = !!ctx.mock?.canMock(t);
    const id = selectedInstance(t, text, ctx.registry, ctx.mock);
    const selected = instances.some((i) => i.id === id) || (mock && id === NEW_MOCK);
    return html`<select
      class=${controlClass(d)}
      ?disabled=${instances.length === 0 && !mock}
      @change=${(e: Event) => {
        text.text = (e.target as HTMLSelectElement).value;
        text.auto = false;
        text.error = undefined;
        ctx.update();
      }}
    >
      <option value="" disabled .selected=${live(!selected)}>
        ${instances.length > 0 || mock ? 'Select an instance…' : `No live ${t._name} instances`}
      </option>
      ${mock ? html`<option value=${NEW_MOCK} .selected=${live(id === NEW_MOCK)}>New mock ${t._name}</option>` : nothing}
      ${instances.map((i) => html`<option value=${i.id} .selected=${live(i.id === id)}>${i.id}</option>`)}
    </select>`;
  }
  public visitOpt(_t: IDL.OptClass, ty: IDL.Type, { d, ctx }: RenderData): Rendered {
    const opt = d as OptDraft;
    return html`
      <label class="checkbox-label">
        <input
          type="checkbox"
          .checked=${live(opt.some)}
          @change=${(e: Event) => {
            setSome(opt, ty, (e.target as HTMLInputElement).checked);
            ctx.update();
          }}
        />
        some
      </label>
      ${opt.some ? subform([renderField(ty, opt.inner!, ctx)]) : nothing}
    `;
  }
  public visitVec(_t: IDL.VecClass, ty: IDL.Type, { d, ctx }: RenderData): Rendered {
    const list = d as ListDraft;
    return html`
      <input
        type="number"
        min="0"
        max="100"
        placeholder="length"
        class="length ${list.auto ? 'auto' : ''}"
        .value=${live(list.length)}
        @change=${(e: Event) => {
          resizeList(list, ty, inputValue(e));
          list.auto = false;
          ctx.update();
        }}
      />
      ${subform(list.items.map((item, i) => renderField(ty, item, ctx, `[${i}]`)))}
    `;
  }
  public visitRecord(_t: IDL.RecordClass, fields: Record<string, IDL.Type>, { d, ctx }: RenderData): Rendered {
    const entries = Object.entries(fields);
    const record = d as FieldsDraft;
    return subform(entries.map(([key, ty], i) => renderField(ty, record.fields[i], ctx, key)), entries.length > 1);
  }
  public visitTuple(_t: IDL.TupleClass, components: IDL.Type[], { d, ctx }: RenderData): Rendered {
    const tuple = d as FieldsDraft;
    return subform(components.map((ty, i) => renderField(ty, tuple.fields[i], ctx, `${i}`)), components.length > 1);
  }
  public visitVariant(_t: IDL.VariantClass, fields: Record<string, IDL.Type>, { d, ctx }: RenderData): Rendered {
    const entries = Object.entries(fields);
    const variant = d as CaseDraft;
    return html`
      ${renderSelect(variant, entries.map(([tag]) => tag), (index) => {
        selectCase(variant, index, entries[index][1]);
        ctx.update();
      })}
      ${variant.payload ? subform([renderField(entries[variant.index][1], variant.payload, ctx)]) : nothing}
    `;
  }
  public visitEnum(_t: IDL.EnumClass, tags: Array<string>, { d, ctx }: RenderData): Rendered {
    const enumDraft = d as CaseDraft;
    return renderSelect(enumDraft, tags, (index) => {
      selectCase(enumDraft, index);
      ctx.update();
    });
  }
  public visitRec(_t: IDL.RecClass, ty: IDL.Type, data: RenderData): Rendered {
    return ty.accept(this, data);
  }
}

function renderSelect(d: CaseDraft, cases: string[], onSelect: (index: number) => void): Rendered {
  // `.selected` (not the attribute) so programmatic changes apply after user interaction.
  return html`<select
    class=${controlClass(d)}
    @change=${(e: Event) => {
      d.auto = false;
      // Index 0 is the placeholder.
      onSelect((e.target as HTMLSelectElement).selectedIndex - 1);
    }}
  >
    <option value="" disabled .selected=${live(d.index < 0)}>Select a case…</option>
    ${cases.map((tag, i) => html`<option .selected=${live(i === d.index)}>${tag}</option>`)}
  </select>`;
}

const render = new Render();

const MAX_TYPE_LENGTH = 48;

// Long inline types (e.g. large variants) are truncated; the full type is shown on hover.
export function typeName(type: IDL.Type) {
  const name = type.name;
  const short = name.length > MAX_TYPE_LENGTH ? `${name.slice(0, MAX_TYPE_LENGTH - 1)}…` : name;
  return html`<span class="sig-type" title=${name}>${short}</span>`;
}

// Renders a labeled input for a value of type `t`, backed by the draft `d`.
export function renderField(t: IDL.Type, d: Draft, ctx: FormContext, label?: string): Rendered {
  const control = t.accept(render, { d, ctx });
  if (!label && control === nothing && !d.error) {
    return nothing;
  }
  return html`<div class="field">
    ${label
      ? html`<label class="field-label">
          <span>${label}</span>
          <span class="field-type" title=${t.name}>${t.name}</span>
        </label>`
      : nothing}
    ${control}
    ${d.error ? html`<div class="field-error">${d.error}</div>` : nothing}
  </div>`;
}

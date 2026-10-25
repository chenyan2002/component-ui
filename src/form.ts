import { html, nothing, TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { guard } from 'lit/directives/guard.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { live } from 'lit/directives/live.js';
import * as IDL from './wit';
import {
  BoolDraft, ByteEncoding, BytesDraft, CaseDraft, Draft, FieldsDraft, Giver, ListDraft, MAX_LIST_LENGTH, MockFactory, NEW_MOCK, OptDraft, TextDraft,
  bytesOf, instanceChoices, parseDraft, removeItem, resizeList, selectCase, selectedInstance, setEncoding, setSome, setTextItems,
} from './draft';
import { describeInstance, ResourceRegistry } from './resources';

type Rendered = TemplateResult | typeof nothing;

export interface FormContext {
  // Drafts are mutated in place; call this afterwards to re-render the form.
  update(): void;
  registry: ResourceRegistry;
  // For an import's result, resource pickers also offer a new mock instance.
  mock?: MockFactory;
  // Who hands over the resource instances picked, `ui` by default.
  giver?: Giver;
}

interface RenderData {
  d: Draft;
  ctx: FormContext;
}

const inputValue = (e: Event) => (e.target as HTMLInputElement).value;

function controlClass(d: Draft, extra: Record<string, boolean> = {}) {
  return classMap({ reject: !!d.error, auto: !!d.auto, ...extra });
}

// With `flow`, short fields share a row, e.g. the fields of a record.
function subform(content: Rendered[], { nested = true, flow = false } = {}): Rendered {
  const visible = content.filter((c) => c !== nothing);
  if (visible.length === 0) {
    return nothing;
  }
  return html`<div class=${classMap({ subform: true, nested, flow })}>${visible}</div>`;
}

// Types with a short control, which can share a row with others; a string's input stretches to fill
// the rest of its row. Variants with a payload show it below their cases, so they take a row of their own.
function isShort(t: IDL.Type): boolean {
  return isNumber(t) || t instanceof IDL.BoolClass || t instanceof IDL.CharClass || t instanceof IDL.StringClass
    || t instanceof IDL.EnumClass || t instanceof IDL.ResourceClass || t instanceof IDL.OwnedClass || t instanceof IDL.BorrowClass
    || (t instanceof IDL.VariantClass && Object.values(t._fields).every((ty) => ty instanceof IDL.NullClass));
}

// Cases fit in a row of buttons up to these limits; more get a dropdown.
const SEGMENTED_MAX_CASES = 4;
const SEGMENTED_MAX_CHARS = 24;

// Picks one of `cases`; `index` is -1 while none is selected.
function renderCases(d: Draft, cases: string[], index: number, onSelect: (index: number) => void, result = false): Rendered {
  // `live` so programmatic changes, e.g. by Random, apply after user interaction.
  const value = live(index >= 0 ? cases[index] : '');
  const select = (e: Event) => {
    d.auto = false;
    onSelect(cases.indexOf(inputValue(e)));
  };
  if (cases.length <= SEGMENTED_MAX_CASES && cases.join('').length <= SEGMENTED_MAX_CHARS) {
    return html`<wa-radio-group
      size="s"
      orientation="horizontal"
      class=${controlClass(d, { cases: true, result })}
      .value=${value}
      @change=${select}
    >
      ${cases.map((tag) => html`<wa-radio appearance="button" value=${tag}>${tag}</wa-radio>`)}
    </wa-radio-group>`;
  }
  const placeholder = 'Select a case…';
  return html`<wa-select
    size="s"
    placeholder=${placeholder}
    class=${controlClass(d)}
    style=${selectWidth([placeholder, ...cases])}
    .value=${value}
    @change=${select}
  >
    ${cases.map((tag) => html`<wa-option value=${tag}>${tag}</wa-option>`)}
  </wa-select>`;
}

// A dropdown is as wide as its longest label, rather than the field.
function selectWidth(labels: string[]): string {
  return `--chars: ${Math.max(...labels.map((label) => label.length))}`;
}

function isNumber(t: IDL.Type): boolean {
  return t instanceof IDL.FixedNatClass || t instanceof IDL.FixedIntClass || t instanceof IDL.FixedFloatClass;
}

interface NumberBounds {
  min?: number;
  max?: number;
  float?: boolean;
  // The width of the widest value, which sizes the input.
  digits: number;
}

// Bounds as numbers, which are exact up to 32 bits; 64-bit integers are range-checked when parsed instead.
function integerBounds(bits: number, signed: boolean): NumberBounds {
  const largest = (1n << BigInt(signed ? bits - 1 : bits)) - 1n;
  const digits = `${largest}`.length + (signed ? 1 : 0);
  if (bits > 32) {
    return signed ? { digits } : { min: 0, digits };
  }
  return { min: signed ? -Number(largest) - 1 : 0, max: Number(largest), digits };
}

// Room for most floats as typed, e.g. `-1234.5678e-10`; longer ones scroll.
const FLOAT_DIGITS = 14;

class Render extends IDL.Visitor<RenderData, Rendered> {
  // Strings and chars.
  public visitType<T>(t: IDL.Type<T>, { d, ctx }: RenderData): Rendered {
    const text = d as TextDraft;
    return html`<wa-input
      size="s"
      class=${controlClass(d, { char: t instanceof IDL.CharClass })}
      placeholder=${t.name}
      .value=${live(text.text)}
      @input=${(e: Event) => editText(text, inputValue(e), ctx)}
      @blur=${() => commitText(t, text, ctx)}
    ></wa-input>`;
  }
  public visitFixedNat(t: IDL.FixedNatClass, data: RenderData): Rendered {
    return renderNumber(t, data, integerBounds(t._bits, false));
  }
  public visitFixedInt(t: IDL.FixedIntClass, data: RenderData): Rendered {
    return renderNumber(t, data, integerBounds(t._bits, true));
  }
  public visitFixedFloat(t: IDL.FixedFloatClass, data: RenderData): Rendered {
    return renderNumber(t, data, { float: true, digits: FLOAT_DIGITS });
  }
  public visitNull(_t: IDL.NullClass, _data: RenderData): Rendered {
    return nothing;
  }
  public visitBool(_t: IDL.BoolClass, { d, ctx }: RenderData): Rendered {
    const bool = d as BoolDraft;
    return html`<wa-switch
      size="s"
      class="bool"
      .checked=${live(bool.checked)}
      @change=${(e: Event) => {
        bool.checked = (e.target as HTMLInputElement).checked;
        ctx.update();
      }}
    >${bool.checked ? 'true' : 'false'}</wa-switch>`;
  }
  // Picks one of the instances of the resource the giver owns.
  public visitResource(t: IDL.ResourceClass, { d, ctx }: RenderData): Rendered {
    const text = d as TextDraft;
    const giver = ctx.giver ?? 'ui';
    const instances = instanceChoices(t, ctx.registry, giver);
    const mock = !!ctx.mock?.canMock(t);
    const id = selectedInstance(t, text, ctx.registry, ctx.mock, giver);
    const selected = instances.some((i) => i.id === id) || (mock && id === NEW_MOCK);
    const placeholder = instances.length > 0 || mock ? 'Select an instance…' : `No live ${t.witName} instances`;
    const mockLabel = `New mock ${t.witName}`;
    const labels = instances.map((i) => `#${i.id}`);
    return html`<wa-select
      size="s"
      class=${controlClass(d)}
      placeholder=${placeholder}
      style=${selectWidth([placeholder, ...(mock ? [mockLabel] : []), ...labels])}
      ?disabled=${instances.length === 0 && !mock}
      .value=${live(selected ? id : '')}
      @change=${(e: Event) => {
        text.text = inputValue(e);
        text.auto = false;
        text.error = undefined;
        ctx.update();
      }}
    >
      ${mock ? html`<wa-option value=${NEW_MOCK}>${mockLabel}</wa-option>` : nothing}
      ${instances.map((i, n) => html`<wa-option value=${i.id} title=${describeInstance(i)}>${labels[n]}</wa-option>`)}
    </wa-select>`;
  }
  // Checked for `some(T)`. A short value goes right of the checkbox; others go below it.
  public visitOpt(_t: IDL.OptClass, ty: IDL.Type, { d, ctx }: RenderData): Rendered {
    const opt = d as OptDraft;
    const short = isShort(ty);
    const checkbox = html`<wa-checkbox
      size="s"
      class=${controlClass(opt)}
      .checked=${live(opt.some)}
      @change=${(e: Event) => {
        opt.auto = false;
        setSome(opt, ty, (e.target as HTMLInputElement).checked);
        ctx.update();
      }}
    >${opt.some ? (short ? nothing : 'some') : 'none'}</wa-checkbox>`;
    if (short) {
      return html`<div class="opt">${checkbox}${opt.some ? renderField(ty, opt.inner!, ctx) : nothing}</div>`;
    }
    return html`${checkbox}${opt.some ? subform([renderField(ty, opt.inner!, ctx)]) : nothing}`;
  }
  public visitVec(t: IDL.VecClass, ty: IDL.Type, data: RenderData): Rendered {
    if (data.d.kind === 'bytes') {
      return renderBytes(t, data);
    }
    return isNumber(ty) ? renderTags(ty, data) : renderItems(ty, data);
  }
  public visitRecord(_t: IDL.RecordClass, fields: Record<string, IDL.Type>, { d, ctx }: RenderData): Rendered {
    const entries = Object.entries(fields);
    const record = d as FieldsDraft;
    return subform(entries.map(([key, ty], i) => renderField(ty, record.fields[i], ctx, key)), { nested: entries.length > 1, flow: true });
  }
  public visitFlags(t: IDL.FlagsClass, _fields: Record<string, IDL.Type>, { d, ctx }: RenderData): Rendered {
    const flags = (d as FieldsDraft).fields as BoolDraft[];
    return html`<wa-checkbox-group size="s" orientation="horizontal" class="flags">
      ${t._flags.map((flag, i) => html`<wa-checkbox
        .checked=${live(flags[i].checked)}
        @change=${(e: Event) => {
          flags[i].checked = (e.target as HTMLInputElement).checked;
          ctx.update();
        }}
      >${flag}</wa-checkbox>`)}
    </wa-checkbox-group>`;
  }
  public visitTuple(_t: IDL.TupleClass, components: IDL.Type[], { d, ctx }: RenderData): Rendered {
    const tuple = d as FieldsDraft;
    return subform(components.map((ty, i) => renderField(ty, tuple.fields[i], ctx, `${i}`)), { nested: components.length > 1, flow: true });
  }
  public visitVariant(t: IDL.VariantClass, fields: Record<string, IDL.Type>, { d, ctx }: RenderData): Rendered {
    const entries = Object.entries(fields);
    const variant = d as CaseDraft;
    return html`
      ${renderCases(variant, entries.map(([tag]) => tag), variant.index, (index) => {
        selectCase(variant, index, entries[index][1]);
        ctx.update();
      }, t instanceof IDL.ResultClass)}
      ${variant.payload ? subform([renderField(entries[variant.index][1], variant.payload, ctx)]) : nothing}
    `;
  }
  public visitEnum(_t: IDL.EnumClass, tags: Array<string>, { d, ctx }: RenderData): Rendered {
    const enumDraft = d as CaseDraft;
    return renderCases(enumDraft, tags, enumDraft.index, (index) => {
      selectCase(enumDraft, index);
      ctx.update();
    });
  }
  public visitRec(_t: IDL.RecClass, ty: IDL.Type, data: RenderData): Rendered {
    return ty.accept(this, data);
  }
}

function editText(d: TextDraft | BytesDraft, text: string, ctx: FormContext) {
  d.text = text;
  d.auto = false;
  d.error = undefined;
  ctx.update();
}

// Checks the value once the user is done editing it.
function commitText(t: IDL.Type, d: TextDraft | BytesDraft, ctx: FormContext) {
  if (d.text !== '') {
    parseDraft(t, d, ctx.registry, ctx.mock, ctx.giver);
    ctx.update();
  }
}

function renderNumber(t: IDL.Type, { d, ctx }: RenderData, { min, max, float, digits }: NumberBounds): Rendered {
  const text = d as TextDraft;
  // `change` also covers arrow keys, which step the value without emitting `input`.
  const edit = (e: Event) => {
    if (inputValue(e) !== text.text) {
      editText(text, inputValue(e), ctx);
    }
  };
  return html`<wa-number-input
    size="s"
    class=${controlClass(d)}
    style="--digits: ${digits}"
    placeholder=${t.name}
    min=${ifDefined(min)}
    max=${ifDefined(max)}
    step=${float ? 'any' : 1}
    inputmode=${float ? 'decimal' : 'numeric'}
    without-steppers
    .value=${live(text.text)}
    @input=${edit}
    @change=${edit}
    @blur=${() => commitText(t, text, ctx)}
  ></wa-number-input>`;
}

const BYTE_ENCODINGS: ByteEncoding[] = ['text', 'hex'];

// A `list<u8>` is typed as text, sent as its UTF-8 bytes, or as hex for other bytes.
function renderBytes(t: IDL.Type, { d, ctx }: RenderData): Rendered {
  const bytes = d as BytesDraft;
  let count = '';
  try {
    const n = bytesOf(bytes).length;
    count = `${n} byte${n === 1 ? '' : 's'}`;
  } catch {
    // Shown as the field's error once parsed.
  }
  return html`
    <div class="bytes-mode">
      ${renderCases(bytes, BYTE_ENCODINGS, BYTE_ENCODINGS.indexOf(bytes.encoding), (index) => {
        setEncoding(bytes, BYTE_ENCODINGS[index]);
        ctx.update();
      })}
      <span class="muted">${count}</span>
    </div>
    <wa-textarea
      size="s"
      rows="1"
      resize="auto"
      class=${controlClass(d, { bytes: true, hex: bytes.encoding === 'hex' })}
      placeholder=${bytes.encoding === 'text' ? 'UTF-8 text' : 'hex bytes, e.g. 48 69'}
      .spellcheck=${false}
      .value=${live(bytes.text)}
      @input=${(e: Event) => editText(bytes, inputValue(e), ctx)}
      @blur=${() => commitText(t, bytes, ctx)}
    ></wa-textarea>
  `;
}

// A list of numbers is typed, or pasted, as tags; each is checked as it is added.
function renderTags(ty: IDL.Type, { d, ctx }: RenderData): Rendered {
  const list = d as ListDraft;
  const invalid = list.items.findIndex((item) => item.error);
  const tags = list.items.map((item) => (item as TextDraft).text);
  return html`<wa-tag-input
    size="s"
    class=${controlClass(d)}
    delimiter=", "
    allow-duplicates
    max-tags=${MAX_LIST_LENGTH}
    placeholder=${`${ty.name}, …`}
    .value=${guard(tags, () => tags)}
    @wa-create=${(e: CustomEvent<{ inputValue: string }>) => {
      // A rejected tag stays in the text box, with its error, to be fixed.
      const probe: TextDraft = { kind: 'text', text: e.detail.inputValue };
      parseDraft(ty, probe, ctx.registry, ctx.mock, ctx.giver);
      if (probe.error) {
        e.preventDefault();
        list.error = probe.error;
        ctx.update();
      }
    }}
    @input=${(e: Event) => {
      if (list.error && (e.target as HTMLInputElement & { inputValue: string }).inputValue === '') {
        list.error = undefined;
        ctx.update();
      }
    }}
    @change=${(e: Event) => {
      setTextItems(list, (e.target as HTMLInputElement & { value: string[] }).value);
      list.auto = false;
      ctx.update();
    }}
  ></wa-tag-input>
  ${invalid >= 0 ? html`<div class="field-error">[${invalid}]: ${list.items[invalid].error}</div>` : nothing}`;
}

// Other lists are edited item by item.
function renderItems(ty: IDL.Type, { d, ctx }: RenderData): Rendered {
  const list = d as ListDraft;
  const edited = () => {
    list.auto = false;
    ctx.update();
  };
  return html`
    ${subform(list.items.map((item, i) => renderField(ty, item, ctx, `[${i}]`, html`<wa-button
      appearance="plain"
      size="s"
      class="remove-item"
      title="Remove [${i}]"
      @click=${() => {
        removeItem(list, i);
        edited();
      }}
    >
      <wa-icon name="xmark" label="Remove"></wa-icon>
    </wa-button>`)))}
    <wa-button
      appearance="outlined"
      size="s"
      class=${controlClass(d, { 'add-item': true })}
      ?disabled=${list.items.length >= MAX_LIST_LENGTH}
      @click=${() => {
        resizeList(list, ty, `${list.items.length + 1}`);
        edited();
      }}
    >
      <wa-icon slot="start" name="plus"></wa-icon>
      Add item
    </wa-button>
  `;
}

const render = new Render();

const MAX_TYPE_LENGTH = 48;

// Long types (e.g. inline tuples) are truncated; hovering shows how WIT declares the type.
export function typeName(type: IDL.Type) {
  const name = type.name;
  const short = name.length > MAX_TYPE_LENGTH ? `${name.slice(0, MAX_TYPE_LENGTH - 1)}…` : name;
  return html`<span class="sig-type" title=${type.definition}>${short}</span>`;
}

// Renders a labeled input for a value of type `t`, backed by the draft `d`. `action`, e.g. a button
// removing a list item, goes at the end of the label.
export function renderField(t: IDL.Type, d: Draft, ctx: FormContext, label?: string, action?: TemplateResult): Rendered {
  const control = t.accept(render, { d, ctx });
  if (!label && control === nothing && !d.error) {
    return nothing;
  }
  const heading = label
    ? html`<label class="field-label">
        <span>${label}</span>
        <span class="field-type" title=${t.definition}>${t.name}</span>
      </label>`
    : nothing;
  // Outside the label, which would otherwise pass its clicks on to the action.
  return html`<div class=${classMap({ field: true, short: isShort(t), stretch: t instanceof IDL.StringClass })}>
    ${action ? html`<div class="field-heading">${heading}${action}</div>` : heading}
    ${control}
    ${d.error ? html`<div class="field-error">${d.error}</div>` : nothing}
  </div>`;
}

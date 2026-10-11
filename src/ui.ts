import * as IDL from './wit';
import * as UI from './ui-core';

export type InputBox = UI.InputBox;

const InputConfig: UI.UIConfig = { parse: parsePrimitive };
const FormConfig: UI.FormConfig = { render: renderInput };

export const inputBox = (t: IDL.Type, config: Partial<UI.UIConfig>) => {
  return new UI.InputBox(t, { ...InputConfig, ...config });
};
export const recordForm = (fields: Array<[string, IDL.Type]>, config: Partial<UI.FormConfig>) => {
  return new UI.RecordForm(fields, { ...FormConfig, ...config });
};
export const tupleForm = (components: IDL.Type[], config: Partial<UI.FormConfig>) => {
  return new UI.TupleForm(components, { ...FormConfig, ...config });
};
export const variantForm = (fields: Array<[string, IDL.Type]>, config: Partial<UI.FormConfig>) => {
  return new UI.VariantForm(fields, { ...FormConfig, ...config });
};
export const enumForm = (tags: Array<string>, config: Partial<UI.FormConfig>) => {
  return new UI.EnumForm(tags, { ...FormConfig, ...config });
};
export const optForm = (ty: IDL.Type, config: Partial<UI.FormConfig>) => {
  return new UI.OptionForm(ty, { ...FormConfig, ...config });
};
export const vecForm = (ty: IDL.Type, config: Partial<UI.FormConfig>) => {
  return new UI.VecForm(ty, { ...FormConfig, ...config });
};

function selectOf(options: string[]): HTMLSelectElement {
  const select = document.createElement('select');
  for (const option of options) {
    select.add(new Option(option));
  }
  select.selectedIndex = -1;
  return select;
}

function checkboxWithText(text: string): [HTMLInputElement, HTMLLabelElement] {
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  const label = document.createElement('label');
  label.className = 'checkbox-label';
  label.append(checkbox, text);
  return [checkbox, label];
}

export class Render extends IDL.Visitor<null, InputBox> {
  public visitType<T>(t: IDL.Type<T>, _d: null): InputBox {
    const input = document.createElement('input');
    input.placeholder = t.name;
    return inputBox(t, { input });
  }
  public visitNull(t: IDL.NullClass, _d: null): InputBox {
    return inputBox(t, {});
  }
  public visitBool(t: IDL.BoolClass, _d: null): InputBox {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    return inputBox(t, { input: checkbox });
  }
  public visitVec(t: IDL.VecClass, ty: IDL.Type, _d: null): InputBox {
    const len = document.createElement('input');
    len.type = 'number';
    len.min = '0';
    len.max = '100';
    len.placeholder = 'length';
    len.classList.add('length');
    const form = vecForm(ty, { open: len, event: 'change', nested: true });
    return inputBox(t, { form });
  }
  public visitOpt(t: IDL.OptClass, ty: IDL.Type, _d: null): InputBox {
    const [checkbox, display] = checkboxWithText('some');
    const form = optForm(ty, { open: checkbox, display, event: 'change', nested: true });
    return inputBox(t, { form });
  }
  public visitRecord(t: IDL.RecordClass, fields: Record<string, IDL.Type>, _d: null): InputBox {
    const fs = Object.entries(fields);
    const form = recordForm(fs, { nested: fs.length > 1 });
    return inputBox(t, { form });
  }
  public visitTuple(t: IDL.TupleClass, components: IDL.Type[], _d: null): InputBox {
    const form = tupleForm(components, { nested: components.length > 1 });
    return inputBox(t, { form });
  }
  public visitVariant(t: IDL.VariantClass, fields: Record<string, IDL.Type>, _d: null): InputBox {
    const flist = Object.entries(fields);
    const select = selectOf(flist.map(([key]) => key));
    const form = variantForm(flist, { open: select, event: 'change', nested: true });
    return inputBox(t, { form });
  }
  public visitEnum(t: IDL.EnumClass, tags: Array<string>, _d: null): InputBox {
    const form = enumForm(tags, { open: selectOf(tags), event: 'change' });
    return inputBox(t, { form });
  }
  public visitRec(_t: IDL.RecClass, ty: IDL.Type, _d: null): InputBox {
    return renderInput(ty);
  }
}

// Converts to the JS representation jco expects: `number` up to 32 bits, `bigint` above.
function toInteger(bits: number, signed: boolean, value: bigint): number | bigint {
  const min = signed ? -(1n << BigInt(bits - 1)) : 0n;
  const max = signed ? (1n << BigInt(bits - 1)) - 1n : (1n << BigInt(bits)) - 1n;
  if (value < min || value > max) {
    throw new Error(`Out of range for ${signed ? 's' : 'u'}${bits}: [${min}, ${max}]`);
  }
  return bits <= 32 ? Number(value) : value;
}

function parseInteger(bits: number, signed: boolean, text: string): number | bigint {
  const trimmed = text.trim();
  if (!/^[-+]?\d+$/.test(trimmed)) {
    throw new Error(`Expected an integer, got "${text}"`);
  }
  return toInteger(bits, signed, BigInt(trimmed));
}

class Parse extends IDL.Visitor<HTMLInputElement, any> {
  public visitNull(_t: IDL.NullClass, _v: HTMLInputElement): null {
    return null;
  }
  public visitBool(_t: IDL.BoolClass, v: HTMLInputElement): boolean {
    return v.checked;
  }
  public visitString(_t: IDL.StringClass, v: HTMLInputElement): string {
    return v.value;
  }
  public visitFixedNat(t: IDL.FixedNatClass, v: HTMLInputElement): number | bigint {
    return parseInteger(t._bits, false, v.value);
  }
  public visitFixedInt(t: IDL.FixedIntClass, v: HTMLInputElement): number | bigint {
    return parseInteger(t._bits, true, v.value);
  }
  public visitFixedFloat(_t: IDL.FixedFloatClass, v: HTMLInputElement): number {
    const value = Number(v.value.trim());
    if (v.value.trim() === '' || Number.isNaN(value)) {
      throw new Error(`Expected a number, got "${v.value}"`);
    }
    return value;
  }
  public visitResource(t: IDL.ResourceClass, v: HTMLInputElement): any {
    const result = t.instances[v.value];
    if (result === undefined) {
      throw new Error(`Resource not found: ${v.value}`);
    }
    return result;
  }
}

class Random extends IDL.Visitor<HTMLInputElement, any> {
  public visitNull(_t: IDL.NullClass, _v: HTMLInputElement): null {
    return null;
  }
  public visitBool(_t: IDL.BoolClass, _v: HTMLInputElement): boolean {
    return Math.random() < 0.5;
  }
  public visitString(_t: IDL.StringClass, _v: HTMLInputElement): string {
    return Math.random().toString(36).substring(6);
  }
  public visitFixedNat(t: IDL.FixedNatClass, _v: HTMLInputElement): number | bigint {
    return toInteger(t._bits, false, BigInt(this.generateNumber(false)));
  }
  public visitFixedInt(t: IDL.FixedIntClass, _v: HTMLInputElement): number | bigint {
    return toInteger(t._bits, true, BigInt(this.generateNumber(true)));
  }
  public visitFixedFloat(_t: IDL.FixedFloatClass, _v: HTMLInputElement): number {
    return Math.random() * 100;
  }
  public visitResource(t: IDL.ResourceClass, _v: HTMLInputElement): any {
    const keys = Object.keys(t.instances);
    if (keys.length === 0) {
      throw new Error(`No resource ${t._name} available`);
    }
    return t.instances[keys[Math.floor(Math.random() * keys.length)]];
  }
  private generateNumber(signed: boolean): number {
    const num = Math.floor(Math.random() * 100);
    return signed && Math.random() < 0.5 ? -num : num;
  }
}

function parsePrimitive(t: IDL.Type, config: UI.ParseConfig, d: HTMLInputElement) {
  if (config.random && (t instanceof IDL.BoolClass || t instanceof IDL.ResourceClass || d.value === '')) {
    return t.accept(new Random(), d);
  }
  return t.accept(new Parse(), d);
}

export function renderInput(t: IDL.Type): InputBox {
  return t.accept(new Render(), null);
}

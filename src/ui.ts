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

export class Render extends IDL.Visitor<null, InputBox> {
    public visitType<T>(t: IDL.Type<T>, d: null): InputBox {
      const input = document.createElement('input');
      input.classList.add('argument');
      input.placeholder = t.name;
      return inputBox(t, { input });
    }
    public visitNull(t: IDL.NullClass, d: null): InputBox {
        return inputBox(t, {});
    }
    public visitBool(t: IDL.BoolClass, d: null): UI.InputBox {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.classList.add('open');
        checkbox.value = 'true';
        return inputBox(t, { input: checkbox });
    }
    public visitVec(t: IDL.VecClass, ty: IDL.Type, d: null): InputBox {
        const len = document.createElement('input');
        len.type = 'number';
        len.min = '0';
        len.max = '100';
        //len.style.width = '8rem';
        len.placeholder = 'len';
        len.classList.add('open');
        const container = document.createElement('div');
        container.classList.add('popup-form');
        const form = vecForm(ty, { open: len, event: 'change', container });
        return inputBox(t, { form });
    }
    public visitOpt(t: IDL.OptClass, ty: IDL.Type, d: null): InputBox {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.classList.add('open');
        const form = optForm(ty, { open: checkbox, event: 'change' });
        return inputBox(t, { form });
    }
    public visitRecord(t: IDL.RecordClass, fields: Record<string, IDL.Type>, d: null): InputBox {
        let config = {};
        const fs = Object.entries(fields);
        if (fs.length > 1) {
          const container = document.createElement('div');
          container.classList.add('popup-form');
          config = { container };
        }
        const form = recordForm(fs, config);
        return inputBox(t, { form });
      }
      public visitTuple(
        t: IDL.TupleClass,
        components: IDL.Type[],
        d: null,
      ): InputBox {
        let config = {};
        if (components.length > 1) {
          const container = document.createElement('div');
          container.classList.add('popup-form');
          config = { container };
        }
        const form = tupleForm(components, config);
        return inputBox(t, { form });
    }    
    public visitVariant(t: IDL.VariantClass, fields: Record<string, IDL.Type>, d: null): InputBox {
        const flist = Object.entries(fields);
        const select = document.createElement('select');
        for (const [key, type] of flist) {
          const option = new Option(key);
          select.add(option);
        }
        select.selectedIndex = -1;
        select.classList.add('open');
        const config: Partial<UI.FormConfig> = { open: select, event: 'change' };
        const form = variantForm(flist, config);
        return inputBox(t, { form });
    }
    public visitEnum(t: IDL.EnumClass, tags: Array<string>, d: null): InputBox {
        const select = document.createElement('select');
        for (const tag of tags) {
          const option = new Option(tag);
          select.add(option);
        }
        select.selectedIndex = -1;
        select.classList.add('open');
        const config: Partial<UI.FormConfig> = { open: select, event: 'change' };
        const form = enumForm(tags, config);
        return inputBox(t, { form });
    }
}
class Parse extends IDL.Visitor<HTMLInputElement, any> {
    public visitNull(t: IDL.NullClass, v: HTMLInputElement): null {
      return null;
    }
    public visitBool(t: IDL.BoolClass, v: HTMLInputElement): boolean {
        return v.checked;
    }
    public visitString(t: IDL.StringClass, v: HTMLInputElement): string {
        return v.value;
    }
    public visitFixedNat(t: IDL.FixedNatClass, v: HTMLInputElement): number | bigint {
        if (t._bits <= 32) {
          return parseInt(v.value, 10);
        } else {
          return BigInt(v.value);
        }
    }
    public visitIntNat(t: IDL.FixedIntClass, v: HTMLInputElement): number | bigint {
        if (t._bits <= 32) {
          return parseInt(v.value, 10);
        } else {
          return BigInt(v.value);
        }
    }
    public visitFixedFloat(t: IDL.FixedFloatClass, v: HTMLInputElement): number {
        return parseFloat(v.value);
    }
    public visitNumber(t: IDL.Type, v: HTMLInputElement): bigint {
        return BigInt(v.value);
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
    public visitNull(t: IDL.NullClass, v: HTMLInputElement): null {
      return null;
    }
    public visitBool(t: IDL.BoolClass, v: HTMLInputElement): boolean {
        return Math.random() < 0.5;
    }
    public visitString(t: IDL.StringClass, v: HTMLInputElement): string {
        return Math.random().toString(36).substring(6);
    }
    public visitFixedNat(t: IDL.FixedNatClass, v: HTMLInputElement): number | bigint {
        const x = this.generateNumber(false);
        if (t._bits <= 32) {
          return x;
        } else {
          return BigInt(x);
        }
    }
    public visitFixedInt(t: IDL.FixedIntClass, v: HTMLInputElement): number | bigint {
        const x = this.generateNumber(true);
        if (t._bits <= 32) {
          return x;
        } else {
          return BigInt(x);
        }
    }
    public visitFixedFloat(t: IDL.FixedFloatClass, v: HTMLInputElement): number {
        return Math.random() * 100;
    }
    public visitResource(t: IDL.ResourceClass, v: HTMLInputElement): any {
        const keys = Object.keys(t.instances);
        if (keys.length === 0) {
          throw new Error(`No resource ${t._name} available`);
        }
        return t.instances[keys[Math.floor(Math.random() * keys.length)]];
    }
    private generateNumber(signed: boolean): number {
        const num = Math.floor(Math.random() * 100);
        if (signed && Math.random() < 0.5) {
          return -num;
        } else {
          return num;
        }
    }    
}
function parsePrimitive(t: IDL.Type, config: UI.ParseConfig, d: HTMLInputElement) {
    if (config.random && (t instanceof IDL.BoolClass || t instanceof IDL.ResourceClass || d.value === '')) {
      return t.accept(new Random(), d);
    } else {
      return t.accept(new Parse(), d);
    }
}
export function renderInput(t: IDL.Type): InputBox {
    return t.accept(new Render(), null);
}

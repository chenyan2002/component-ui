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
class Parse extends IDL.Visitor<string, any> {
    public visitNull(t: IDL.NullClass, v: string): null {
      return null;
    }
    public visitFixedNat(t: IDL.FixedNatClass, v: string): number | bigint {
        if (t._bits <= 32) {
          return parseInt(v, 10);
        } else {
          return BigInt(v);
        }
    }
    public visitNumber(t: IDL.Type, v: string): bigint {
        return BigInt(v);
    }
}
class Random extends IDL.Visitor<string, any> {
    public visitNull(t: IDL.NullClass, v: string): null {
      return null;
    }
    public visitFixedNat(t: IDL.FixedNatClass, v: string): number | bigint {
        const x = this.generateNumber(false);
        if (t._bits <= 32) {
          return x;
        } else {
          return BigInt(x);
        }
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
function parsePrimitive(t: IDL.Type, config: UI.ParseConfig, d: string) {
    if (config.random && d === '') {
      return t.accept(new Random(), d);
    } else {
      return t.accept(new Parse(), d);
    }
}
export function renderInput(t: IDL.Type): InputBox {
    return t.accept(new Render(), null);
}

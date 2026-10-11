import * as IDL from './wit';

export type Option<T> = { tag: 'none' } | { tag: 'some', val: T };
export interface ParseConfig {
  random?: boolean;
}

export interface UIConfig {
  input?: HTMLElement;
  form?: InputForm;
  parse(t: IDL.Type, config: ParseConfig, v: HTMLInputElement): any;
}

export interface FormConfig {
  // Control that (re)generates the subform when `event` fires on it.
  open?: HTMLElement;
  event?: string;
  // Element shown in place of `open`, e.g. a <label> wrapping a checkbox.
  display?: HTMLElement;
  // Indent the subform to show it is a nested value.
  nested?: boolean;
  labelMap?: Record<string, string>;
  render(t: IDL.Type): InputBox;
}

export class InputBox {
  public readonly status: HTMLElement;
  public label: string | null = null;
  public value: any = undefined;

  constructor(public idl: IDL.Type, public ui: UIConfig) {
    this.status = document.createElement('div');
    this.status.className = 'field-error';
    this.status.hidden = true;

    if (ui.input) {
      const input = ui.input as HTMLInputElement;
      input.addEventListener('blur', () => {
        if (input.value !== '') {
          this.parse();
        }
      });
      input.addEventListener('input', () => {
        this.clearError();
      });
    }
  }

  public isRejected(): boolean {
    return this.value === undefined;
  }

  public parse(config: ParseConfig = {}): any {
    try {
      if (this.ui.form) {
        this.value = this.ui.form.parse(config);
      } else if (this.ui.input) {
        this.value = this.ui.parse(this.idl, config, this.ui.input as HTMLInputElement);
      } else {
        this.value = null;
      }
      this.clearError();
    } catch (err) {
      this.showError((err as Error).message);
      this.value = undefined;
    }
    return this.value;
  }

  public render(dom: HTMLElement): void {
    if (!this.ui.input && !this.ui.form && !this.label) {
      return;
    }
    const field = document.createElement('div');
    field.className = 'field';
    if (this.label) {
      const label = document.createElement('label');
      label.className = 'field-label';
      const name = document.createElement('span');
      name.textContent = this.label;
      const type = document.createElement('span');
      type.className = 'field-type';
      type.textContent = this.idl.name;
      type.title = this.idl.name;
      label.append(name, type);
      field.appendChild(label);
    }
    if (this.ui.input) {
      field.appendChild(this.ui.input);
    }
    if (this.ui.form) {
      this.ui.form.render(field);
    }
    field.appendChild(this.status);
    dom.appendChild(field);
  }

  private showError(message: string) {
    this.ui.input?.classList.add('reject');
    this.status.textContent = message;
    this.status.hidden = false;
  }

  private clearError() {
    this.ui.input?.classList.remove('reject');
    this.status.hidden = true;
  }
}

export abstract class InputForm {
  public form: InputBox[] = [];
  public readonly container: HTMLElement;

  constructor(public ui: FormConfig) {
    this.container = document.createElement('div');
    this.container.className = ui.nested ? 'subform nested' : 'subform';
  }

  public abstract parse(config: ParseConfig): any;
  public abstract generateForm(): void;

  public render(dom: HTMLElement): void {
    const { open, event } = this.ui;
    if (open && event) {
      dom.appendChild(this.ui.display ?? open);
      open.addEventListener(event, () => this.refresh());
    } else {
      this.generateForm();
    }
    this.renderForm();
    dom.appendChild(this.container);
  }

  // Programmatically change the `open` control, e.g. when picking a random value.
  protected setOpen(update: () => void) {
    update();
    this.ui.open!.dispatchEvent(new Event(this.ui.event!));
  }

  protected parseAll(config: ParseConfig): any[] | undefined {
    const values = this.form.map(input => input.parse(config));
    if (this.form.some(input => input.isRejected())) {
      return undefined;
    }
    return values;
  }

  private refresh() {
    this.generateForm();
    this.renderForm();
  }

  private renderForm() {
    this.container.replaceChildren();
    this.form.forEach(e => e.render(this.container));
    this.container.hidden = this.container.childElementCount === 0;
  }
}

export class RecordForm extends InputForm {
  constructor(public fields: Array<[string, IDL.Type]>, ui: FormConfig) {
    super(ui);
  }
  public generateForm(): void {
    this.form = this.fields.map(([key, type]) => {
      const input = this.ui.render(type);
      input.label = this.ui.labelMap?.[key] ?? key;
      return input;
    });
  }
  public parse(config: ParseConfig): Record<string, any> | undefined {
    const values = this.parseAll(config);
    if (values === undefined) {
      return undefined;
    }
    return Object.fromEntries(this.fields.map(([key], i) => [key, values[i]]));
  }
}

export class TupleForm extends InputForm {
  constructor(public components: IDL.Type[], ui: FormConfig) {
    super(ui);
  }
  public generateForm(): void {
    this.form = this.components.map((type, i) => {
      const input = this.ui.render(type);
      input.label = `${i}`;
      return input;
    });
  }
  public parse(config: ParseConfig): any[] | undefined {
    return this.parseAll(config);
  }
}

abstract class SelectForm extends InputForm {
  protected get select(): HTMLSelectElement {
    return this.ui.open as HTMLSelectElement;
  }
  // Returns the selected index, picking a random one if needed and requested.
  protected selectedIndex(config: ParseConfig): number {
    if (this.select.selectedIndex === -1) {
      if (!config.random) {
        throw new Error('Select a case');
      }
      const index = Math.floor(Math.random() * this.select.options.length);
      this.setOpen(() => this.select.selectedIndex = index);
    }
    return this.select.selectedIndex;
  }
}

export class VariantForm extends SelectForm {
  constructor(public fields: Array<[string, IDL.Type]>, ui: FormConfig) {
    super(ui);
  }
  public generateForm(): void {
    const [_, type] = this.fields[this.select.selectedIndex];
    this.form = [this.ui.render(type)];
  }
  public parse(config: ParseConfig): { tag: string, val?: any } | undefined {
    const [tag] = this.fields[this.selectedIndex(config)];
    const val = this.form[0].parse(config);
    if (val === undefined) {
      return undefined;
    }
    return { tag, val };
  }
}

export class EnumForm extends SelectForm {
  constructor(public fields: Array<string>, ui: FormConfig) {
    super(ui);
  }
  public generateForm(): void {
    this.form = [];
  }
  public parse(config: ParseConfig): string {
    return this.fields[this.selectedIndex(config)];
  }
}

export class OptionForm extends InputForm {
  // Only `option<option<T>>` needs the tagged representation to tell the layers apart.
  private readonly tagged: boolean;

  constructor(public ty: IDL.Type, ui: FormConfig) {
    super(ui);
    this.tagged = IDL.Opt(ty).maybe_null();
  }
  public generateForm(): void {
    this.form = (this.ui.open as HTMLInputElement).checked ? [this.ui.render(this.ty)] : [];
  }
  public parse(config: ParseConfig): any {
    if (this.form.length === 0) {
      return this.tagged ? { tag: 'none' } : null;
    }
    const val = this.form[0].parse(config);
    if (val === undefined) {
      return undefined;
    }
    return this.tagged ? { tag: 'some', val } : val;
  }
}

export class VecForm extends InputForm {
  constructor(public ty: IDL.Type, ui: FormConfig) {
    super(ui);
  }
  public generateForm(): void {
    const len = +(this.ui.open as HTMLInputElement).value;
    this.form = Array.from({ length: len }, (_, i) => {
      const input = this.ui.render(this.ty);
      input.label = `[${i}]`;
      return input;
    });
  }
  public parse<T>(config: ParseConfig): T[] | undefined {
    const len = this.ui.open as HTMLInputElement;
    if (config.random && len.value === '') {
      this.setOpen(() => len.value = `${Math.floor(Math.random() * 4)}`);
    }
    return this.parseAll(config);
  }
}

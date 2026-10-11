import { el } from './dom';

export function customStringify(obj: any): string {
  if (obj === undefined) {
    return 'undefined';
  }
  const json = JSON.stringify(obj, (_key, value) => {
    if (typeof value === 'function' || typeof value === 'bigint' || typeof value === 'symbol') {
      return value.toString();
    }
    if (value instanceof Uint8Array) {
      return Array.from(value);
    }
    return value;
  }, 2);
  if (json === '{}' && obj?.constructor?.name) {
    return `[object ${obj.constructor.name}]`;
  }
  return json;
}

function errorText(err: unknown): string {
  // jco throws a `ComponentError` carrying the payload of a WIT `result` error.
  if (err instanceof Error && 'payload' in err) {
    return `err(${customStringify(err.payload)})`;
  }
  return err instanceof Error ? err.message : String(err);
}

export interface LogEntry {
  result(value: any): void;
  error(err: unknown): void;
}

export class ConsolePanel {
  constructor(private readonly list: HTMLElement) {
    this.clear();
  }

  public clear() {
    this.list.replaceChildren(el('div', { className: 'console-empty' }, 'Call a function to see results here.'));
  }

  public logCall(call: string): LogEntry {
    this.list.querySelector('.console-empty')?.remove();
    const started = performance.now();
    const time = el('span', { className: 'log-meta' }, new Date().toLocaleTimeString());
    const entry = el('div', { className: 'log-entry pending' },
      el('div', { className: 'log-call' },
        el('span', { className: 'log-prompt' }, '›'),
        el('code', {}, call),
        time,
      ),
    );
    this.list.appendChild(entry);
    this.scrollToEnd();

    const finish = (text: string, className: string) => {
      const elapsed = Math.round(performance.now() - started);
      time.textContent += ` · ${elapsed} ms`;
      const copy = el('wa-copy-button', { className: 'log-copy' });
      copy.setAttribute('value', text);
      entry.classList.replace('pending', className);
      entry.appendChild(el('div', { className: 'log-output' }, el('pre', {}, text), copy));
      this.scrollToEnd();
    };
    return {
      result: (value) => finish(customStringify(value), 'ok'),
      error: (err) => finish(errorText(err), 'error'),
    };
  }

  private scrollToEnd() {
    this.list.scrollTop = this.list.scrollHeight;
  }
}

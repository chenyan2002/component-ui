type Child = Node | string;

// Creates an element, assigns its properties and appends its children.
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Partial<HTMLElementTagNameMap[K]>,
  ...children: Child[]
): HTMLElementTagNameMap[K];
export function el(tag: string, props?: Record<string, unknown>, ...children: Child[]): HTMLElement;
export function el(tag: string, props: Record<string, unknown> = {}, ...children: Child[]): HTMLElement {
  const element = document.createElement(tag);
  Object.assign(element, props);
  element.append(...children);
  return element;
}

// Assigns an element to a named slot of its parent web component.
export function slotted<T extends HTMLElement>(slot: string, element: T): T {
  element.slot = slot;
  return element;
}

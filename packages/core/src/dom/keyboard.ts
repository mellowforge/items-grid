const NON_TEXT_INPUTS = [
  'button',
  'checkbox',
  'radio',
  'range',
  'color',
  'file',
  'image',
  'reset',
  'submit',
];
const EDITABLE_VALUES = ['', 'true', 'plaintext-only'];

/**
 * Whether a key event's target takes keys of its own — text inputs, textareas, selects and
 * contenteditable regions (including their children) — so PageUp / PageDown there must not
 * page the grid. Works across realms (iframes) by checking the tag, not the class.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || (target as Node).nodeType !== Node.ELEMENT_NODE) return false;
  const element = target as HTMLElement;
  if (element.isContentEditable) return true;
  const region = element.closest('[contenteditable]');
  if (region && EDITABLE_VALUES.includes(region.getAttribute('contenteditable') ?? 'false')) {
    return true;
  }
  const tag = element.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return tag === 'INPUT' && !NON_TEXT_INPUTS.includes((element as HTMLInputElement).type);
}

/**
 * Whether a keydown inside the grid may page it: not when something (e.g. a widget in a card)
 * already handled it, and not when it comes from an editable element — looked up through
 * shadow roots via `composedPath()`, since the event's `target` is retargeted to the host.
 */
export function shouldPageGrid(event: Event): boolean {
  if (event.defaultPrevented) return false;
  const origin = event.composedPath?.()[0] ?? event.target;
  return !isEditableTarget(origin);
}

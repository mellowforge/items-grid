/**
 * Whether a key event's target edits text, so its own keys (PageUp / PageDown move the
 * caret or scroll a textarea) must not page the grid.
 */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target.getAttribute('contenteditable') === 'true') return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) {
    return ![
      'button',
      'checkbox',
      'radio',
      'range',
      'color',
      'file',
      'image',
      'reset',
      'submit',
    ].includes(target.type);
  }
  return false;
}

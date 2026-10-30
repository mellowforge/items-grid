import { describe, expect, it } from 'vitest';

import { isEditableTarget } from './keyboard';

describe('isEditableTarget', () => {
  it.each([
    ['input', '<input />'],
    ['textarea', '<textarea></textarea>'],
    ['select', '<select></select>'],
    ['contenteditable', '<div contenteditable="true"></div>'],
  ])('is true for %s, whose own keys must not page the grid', (_, html) => {
    const host = document.createElement('div');
    host.innerHTML = html;
    expect(isEditableTarget(host.firstElementChild)).toBe(true);
  });

  it.each([
    ['a button', '<button></button>'],
    ['a checkbox', '<input type="checkbox" />'],
    ['plain content', '<span></span>'],
  ])('is false for %s', (_, html) => {
    const host = document.createElement('div');
    host.innerHTML = html;
    expect(isEditableTarget(host.firstElementChild)).toBe(false);
  });
});

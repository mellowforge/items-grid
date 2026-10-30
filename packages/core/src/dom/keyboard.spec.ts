import { describe, expect, it } from 'vitest';

import { isEditableTarget, shouldPageGrid } from './keyboard';

describe('isEditableTarget', () => {
  it.each([
    ['input', '<input />'],
    ['textarea', '<textarea></textarea>'],
    ['select', '<select></select>'],
    ['contenteditable', '<div contenteditable="true"></div>'],
    ['empty contenteditable', '<div contenteditable=""></div>'],
    ['plaintext-only', '<div contenteditable="plaintext-only"></div>'],
    ['upper-case TRUE', '<div contenteditable="TRUE"></div>'],
    ['a search field', '<input type="search" />'],
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

describe('isEditableTarget — nesting', () => {
  it('treats a child of an editable region as editable', () => {
    const host = document.createElement('div');
    host.innerHTML = '<div contenteditable="true"><span id="inner"></span></div>';
    expect(isEditableTarget(host.querySelector('#inner'))).toBe(true);
  });

  it('respects contenteditable="false" inside an editable region', () => {
    const host = document.createElement('div');
    host.innerHTML = '<div contenteditable="true"><b contenteditable="false"><i></i></b></div>';
    expect(isEditableTarget(host.querySelector('i'))).toBe(false);
  });
});

describe('shouldPageGrid', () => {
  const press = (target: Element): boolean => {
    let pages = false;
    target.getRootNode().addEventListener('keydown', event => (pages = shouldPageGrid(event)), {
      once: true,
    });
    target.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, cancelable: true })
    );
    return pages;
  };

  it('pages for plain targets', () => {
    const card = document.createElement('div');
    document.body.append(card);
    expect(press(card)).toBe(true);
    card.remove();
  });

  it('does not page when the card already handled the key', () => {
    const card = document.createElement('div');
    document.body.append(card);
    card.addEventListener('keydown', event => event.preventDefault());
    expect(press(card)).toBe(false);
    card.remove();
  });

  it('sees an input inside a shadow root', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const input = document.createElement('input');
    host.attachShadow({ mode: 'open' }).append(input);
    // composedPath() only exists during dispatch, so decide inside the listener like adapters.
    let target: EventTarget | null = null;
    let pages: boolean | null = null;
    document.addEventListener(
      'keydown',
      event => {
        target = event.target;
        pages = shouldPageGrid(event);
      },
      { once: true }
    );
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, composed: true })
    );
    expect(target).toBe(host);
    expect(pages).toBe(false);
    host.remove();
  });
});

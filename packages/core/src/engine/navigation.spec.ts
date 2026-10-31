import { describe, expect, it } from 'vitest';

import { type CardGrid, getCardMove } from './navigation';

/** A full 4 × 3 page in the middle of the data: both neighbours exist. */
const full: CardGrid = { offset: 5, count: 12, cols: 4, rows: 3, canPrev: true, canNext: true };
const at = (offset: number, grid: Partial<CardGrid> = {}): CardGrid => ({
  ...full,
  ...grid,
  offset,
});
const card = (offset: number) => ({ kind: 'card', offset });
const page = (direction: 'next' | 'prev', offset: number) => ({ kind: 'page', direction, offset });

describe('getCardMove', () => {
  it('ignores keys that are not card navigation', () => {
    for (const key of ['Enter', ' ', 'Tab', 'PageDown', 'a']) {
      expect(getCardMove(key, full)).toBeNull();
    }
  });

  it('ignores every key while the page has no cards', () => {
    expect(getCardMove('ArrowRight', at(0, { count: 0 }))).toBeNull();
  });

  it('moves left and right in reading order, across rows', () => {
    expect(getCardMove('ArrowRight', at(5))).toEqual(card(6));
    expect(getCardMove('ArrowLeft', at(5))).toEqual(card(4));
    expect(getCardMove('ArrowRight', at(3))).toEqual(card(4));
    expect(getCardMove('ArrowLeft', at(4))).toEqual(card(3));
  });

  it('moves up and down within the column', () => {
    expect(getCardMove('ArrowDown', at(5))).toEqual(card(9));
    expect(getCardMove('ArrowUp', at(5))).toEqual(card(1));
  });

  it('goes to the first and last card of the page with Home and End', () => {
    expect(getCardMove('Home', at(5))).toEqual(card(0));
    expect(getCardMove('End', at(5))).toEqual(card(11));
    expect(getCardMove('End', at(1, { count: 7 }))).toEqual(card(6));
  });

  it('swaps left and right in a right-to-left layout', () => {
    expect(getCardMove('ArrowLeft', at(5, { rtl: true }))).toEqual(card(6));
    expect(getCardMove('ArrowRight', at(5, { rtl: true }))).toEqual(card(4));
  });

  it('crosses to the next page from the last card and the bottom row', () => {
    expect(getCardMove('ArrowRight', at(11))).toEqual(page('next', 0));
    expect(getCardMove('ArrowDown', at(9))).toEqual(page('next', 1));
  });

  it('crosses to the previous page from the first card and the top row', () => {
    // The previous page is always full: cols × rows cards.
    expect(getCardMove('ArrowLeft', at(0))).toEqual(page('prev', 11));
    expect(getCardMove('ArrowUp', at(2))).toEqual(page('prev', 10));
  });

  it('stays put at the edges of the first and last page (the key is still handled)', () => {
    const only = { canPrev: false, canNext: false };
    expect(getCardMove('ArrowRight', at(11, only))).toEqual(card(11));
    expect(getCardMove('ArrowDown', at(9, only))).toEqual(card(9));
    expect(getCardMove('ArrowLeft', at(0, only))).toEqual(card(0));
    expect(getCardMove('ArrowUp', at(2, only))).toEqual(card(2));
  });

  it('drops to the last card when the row below is too short for the column', () => {
    // Last page with 6 cards: row 1 holds offsets 4–5.
    const last = { count: 6, canNext: false };
    expect(getCardMove('ArrowDown', at(3, last))).toEqual(card(5));
    expect(getCardMove('ArrowDown', at(5, last))).toEqual(card(5));
  });
});

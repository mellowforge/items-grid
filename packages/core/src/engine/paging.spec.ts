import { describe, expect, it } from 'vitest';

import {
  clampPageIndex,
  getPageCount,
  getPageRange,
  getPagerItems,
  getSkeletonCount,
  reanchor,
} from './paging';

describe('getPageCount', () => {
  it.each([
    [0, 12, 1],
    [1, 12, 1],
    [12, 12, 1],
    [24, 12, 2],
    [25, 12, 3],
  ])('%i items at %i per page → %i pages', (total, pageSize, expected) => {
    expect(getPageCount(total, pageSize)).toBe(expected);
  });
});

describe('clampPageIndex', () => {
  it('clamps below zero and past the last page', () => {
    expect(clampPageIndex(-3, 5)).toBe(0);
    expect(clampPageIndex(9, 5)).toBe(4);
    expect(clampPageIndex(2, 5)).toBe(2);
  });

  it('treats a non-integer index as its floor', () => {
    expect(clampPageIndex(2.7, 5)).toBe(2);
  });
});

describe('getPageRange', () => {
  it('returns the half-open item range of a full page', () => {
    expect(getPageRange(2, 12, 120)).toEqual({ start: 24, end: 36 });
  });

  it('ends at the total on a partial last page', () => {
    expect(getPageRange(9, 12, 117)).toEqual({ start: 108, end: 117 });
  });

  it('is empty when there are no items', () => {
    expect(getPageRange(0, 12, 0)).toEqual({ start: 0, end: 0 });
  });
});

describe('reanchor', () => {
  it('keeps the anchor item on screen when the page shrinks', () => {
    // item #25 (index 24): 12 per page → page 2; 9 per page → page 2 (items 18–26)
    expect(reanchor(24, 9, 120)).toBe(2);
  });

  it('keeps the anchor item on screen when the page grows', () => {
    expect(reanchor(24, 30, 120)).toBe(0);
    expect(reanchor(70, 30, 120)).toBe(2);
  });

  it('clamps to the last page when the anchor is past the end', () => {
    expect(reanchor(110, 12, 50)).toBe(4);
  });

  it('returns page 0 when there are no items', () => {
    expect(reanchor(40, 12, 0)).toBe(0);
  });
});

describe('getSkeletonCount', () => {
  it('fills a whole page when the total is unknown', () => {
    expect(getSkeletonCount(0, 12, undefined)).toBe(12);
  });

  it('fills only the remaining slots of a known partial last page', () => {
    expect(getSkeletonCount(9, 12, 117)).toBe(9);
  });

  it('fills a whole page in the middle of a known total', () => {
    expect(getSkeletonCount(2, 12, 120)).toBe(12);
  });

  it('is zero for a known empty result', () => {
    expect(getSkeletonCount(0, 12, 0)).toBe(0);
  });
});

describe('getPagerItems', () => {
  it('lists every page when they all fit', () => {
    expect(getPagerItems(2, 5)).toEqual([0, 1, 2, 3, 4]);
  });

  it('collapses the tail near the start', () => {
    expect(getPagerItems(0, 10)).toEqual([0, 1, 2, 3, 4, 'gap', 9]);
  });

  it('collapses the head near the end', () => {
    expect(getPagerItems(9, 10)).toEqual([0, 'gap', 5, 6, 7, 8, 9]);
  });

  it('collapses both sides in the middle', () => {
    expect(getPagerItems(4, 10)).toEqual([0, 'gap', 3, 4, 5, 'gap', 9]);
  });

  it('always returns seven slots once there are more than seven pages', () => {
    for (let current = 0; current < 20; current++) {
      expect(getPagerItems(current, 20)).toHaveLength(7);
    }
  });
});

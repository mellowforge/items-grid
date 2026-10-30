import { describe, expect, it } from 'vitest';

import { computeGeometry } from './layout';
import type { SizePreset } from './types';

const compact: SizePreset = { minCardWidth: 200, gap: 8, rowHeight: 96 };

describe('computeGeometry', () => {
  it('fits exactly N columns when the width is exactly N cards plus N-1 gaps', () => {
    expect(computeGeometry({ width: 616, height: 400 }, compact)?.cols).toBe(3);
  });

  it('drops a column when the width is one pixel short', () => {
    expect(computeGeometry({ width: 615, height: 400 }, compact)?.cols).toBe(2);
  });

  it('fits exactly N rows when the height is exactly N rows plus N-1 gaps', () => {
    expect(computeGeometry({ width: 616, height: 304 }, compact)?.rows).toBe(3);
  });

  it('drops a row when the height is one pixel short, never showing a partial row', () => {
    expect(computeGeometry({ width: 616, height: 303 }, compact)?.rows).toBe(2);
  });

  it('multiplies columns by rows into the page size', () => {
    const geometry = computeGeometry({ width: 1318, height: 552 }, compact);
    expect(geometry).toMatchObject({ cols: 6, rows: 5, pageSize: 30 });
  });

  it.each([
    ['zero width', { width: 0, height: 500 }],
    ['zero height', { width: 500, height: 0 }],
    ['negative size', { width: -1, height: -1 }],
    ['NaN size', { width: Number.NaN, height: 500 }],
  ])('returns null for an unmeasured viewport (%s) instead of a page size of 0', (_, size) => {
    expect(computeGeometry(size, compact)).toBeNull();
  });

  it('keeps one row when the viewport is shorter than a single row', () => {
    expect(computeGeometry({ width: 616, height: 40 }, compact)?.rows).toBe(1);
  });

  it('keeps one column when the viewport is narrower than a card', () => {
    expect(computeGeometry({ width: 150, height: 400 }, compact)?.cols).toBe(1);
  });

  it('uses a row height override (the measured height) instead of the preset', () => {
    const geometry = computeGeometry({ width: 616, height: 304 }, compact, { rowHeight: 148 });
    expect(geometry).toMatchObject({ rows: 2, rowHeight: 148 });
  });

  it('clamps the column count to the preset maxColumns', () => {
    const geometry = computeGeometry({ width: 2512, height: 400 }, { ...compact, maxColumns: 8 });
    expect(geometry?.cols).toBe(8);
  });

  it('lets the maxColumns option override the preset', () => {
    const geometry = computeGeometry(
      { width: 2512, height: 400 },
      { ...compact, maxColumns: 8 },
      { maxColumns: 4 }
    );
    expect(geometry?.cols).toBe(4);
  });

  it('reduces rows first to stay within maxPageSize', () => {
    // 6 × 5 = 30 fit; at most 20 → 6 × 3 = 18
    const geometry = computeGeometry({ width: 1318, height: 552 }, compact, { maxPageSize: 20 });
    expect(geometry).toMatchObject({ cols: 6, rows: 3, pageSize: 18 });
  });

  it('reduces columns too when a single row exceeds maxPageSize', () => {
    // 12 columns fit; at most 10 → 10 × 1
    const geometry = computeGeometry(
      { width: 2512, height: 1224 },
      { ...compact, maxPageSize: 10 }
    );
    expect(geometry).toMatchObject({ cols: 10, rows: 1, pageSize: 10 });
  });

  it('ignores a maxPageSize that the viewport does not reach', () => {
    const geometry = computeGeometry({ width: 1318, height: 552 }, compact, { maxPageSize: 100 });
    expect(geometry?.pageSize).toBe(30);
  });

  it('echoes the gap and row height used, for the view to apply', () => {
    expect(computeGeometry({ width: 616, height: 304 }, compact)).toMatchObject({
      gap: 8,
      rowHeight: 96,
    });
  });
});

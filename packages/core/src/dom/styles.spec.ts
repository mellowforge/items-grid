import { describe, expect, it } from 'vitest';

import type { ItemsGridState } from '../controller';
import { getProbeStyle, getViewportStyle, ITEMS_GRID_CLASSES } from './styles';

const state = (overrides: Partial<ItemsGridState<unknown>>): ItemsGridState<unknown> =>
  ({
    geometry: { cols: 4, rows: 3, pageSize: 12, rowHeight: 160, gap: 12 },
    align: 'start',
    ...overrides,
  }) as ItemsGridState<unknown>;

describe('getViewportStyle', () => {
  it('lays the page out as CSS grid tracks from the geometry', () => {
    expect(getViewportStyle(state({}))).toMatchObject({
      display: 'grid',
      'grid-template-columns': 'repeat(4, minmax(0, 1fr))',
      'grid-auto-rows': '160px',
      gap: '12px',
      'align-content': 'start',
    });
  });

  it('takes the remaining height without ever growing from its content', () => {
    expect(getViewportStyle(state({}))).toMatchObject({
      flex: '1 1 0%',
      'min-height': '0',
      overflow: 'hidden',
    });
  });

  it('centres the rows vertically when align is center', () => {
    expect(getViewportStyle(state({ align: 'center' }))['align-content']).toBe('center');
  });

  it('defines no tracks before the viewport is measured', () => {
    const style = getViewportStyle(state({ geometry: null }));
    expect(style['grid-template-columns']).toBeUndefined();
    expect(style.display).toBe('grid');
  });
});

describe('getProbeStyle', () => {
  it('is exactly one column wide and invisible', () => {
    expect(getProbeStyle(state({}))).toMatchObject({
      position: 'absolute',
      visibility: 'hidden',
      width: 'calc((100% - 36px) / 4)',
    });
  });

  it('is full width before the viewport is measured', () => {
    expect(getProbeStyle(state({ geometry: null })).width).toBe('100%');
  });
});

describe('ITEMS_GRID_CLASSES', () => {
  it('holds single class names, usable with classList and selectors', () => {
    for (const value of Object.values(ITEMS_GRID_CLASSES)) {
      expect(value).not.toContain(' ');
    }
  });
});

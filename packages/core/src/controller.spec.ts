import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ItemsGridController, type ItemsGridOptions, type PageRequest } from './controller';

interface Entity {
  id: number;
  status: string;
}

const entities = (count: number, from = 0): Entity[] =>
  Array.from({ length: count }, (_, index) => ({ id: from + index, status: 'ok' }));
const ids = (items: readonly Entity[]): number[] => items.map(item => item.id);

// Normal preset (280 / 12 / 160): 1318×552 → 4 × 3 = 12; 976×552 → 3 × 3 = 9.
const WIDE = { width: 1318, height: 552 };
const NARROW = { width: 976, height: 552 };

const created: ItemsGridController<Entity>[] = [];
function setup(options: Partial<ItemsGridOptions<Entity>> = {}): ItemsGridController<Entity> {
  const controller = new ItemsGridController<Entity>({
    getKey: item => item.id,
    items: entities(120),
    ...options,
  });
  created.push(controller);
  controller.setViewportSize(WIDE);
  return controller;
}

afterEach(() => {
  created.splice(0).forEach(controller => controller.destroy());
  vi.useRealTimers();
});

describe('ItemsGridController — layout', () => {
  it('has no geometry and renders nothing before the viewport is measured', () => {
    const controller = new ItemsGridController<Entity>({
      getKey: item => item.id,
      items: entities(10),
      loading: true,
    });
    created.push(controller);
    expect(controller.getState()).toMatchObject({
      geometry: null,
      pageSize: 0,
      items: [],
      skeletonCount: 0,
    });
  });

  it('shows exactly one page of items once measured', () => {
    const state = setup().getState();
    expect(state.geometry).toMatchObject({ cols: 4, rows: 3, pageSize: 12 });
    expect(ids(state.items)).toEqual(ids(entities(12)));
    expect(state).toMatchObject({ pageIndex: 0, pageCount: 10, total: 120 });
  });

  it('applies maxPageSize from the options', () => {
    expect(setup({ maxPageSize: 8 }).getState().pageSize).toBe(8);
  });

  it('switches density when the preset changes', () => {
    const controller = setup();
    controller.setOptions({ preset: 'compact' });
    expect(controller.getState().geometry).toMatchObject({ cols: 6, rows: 5 });
  });

  it('throws for an unknown preset', () => {
    expect(() => setup({ preset: 'huge' })).toThrow('unknown preset "huge"');
  });
});

describe('ItemsGridController — navigation', () => {
  it('moves between pages and clamps at both ends', () => {
    const controller = setup();
    controller.next();
    expect(controller.getState().pageIndex).toBe(1);
    controller.prev();
    controller.prev();
    expect(controller.getState().pageIndex).toBe(0);
    controller.goTo(99);
    expect(controller.getState()).toMatchObject({ pageIndex: 9, canNext: false, canPrev: true });
    controller.first();
    expect(controller.getState()).toMatchObject({ pageIndex: 0, canPrev: false });
    controller.last();
    expect(controller.getState().pageIndex).toBe(9);
  });

  it('pages with PageDown and PageUp and reports whether the key was handled', () => {
    const controller = setup();
    expect(controller.handleKeydown('PageDown')).toBe(true);
    expect(controller.getState().pageIndex).toBe(1);
    expect(controller.handleKeydown('PageUp')).toBe(true);
    expect(controller.getState().pageIndex).toBe(0);
    expect(controller.handleKeydown('ArrowDown')).toBe(false);
  });

  it('honours the initial pageIndex option', () => {
    expect(setup({ pageIndex: 3 }).getState().pageIndex).toBe(3);
  });

  it('calls onPageChange when the page index changes', () => {
    const onPageChange = vi.fn();
    const controller = setup({ onPageChange });
    controller.next();
    expect(onPageChange).toHaveBeenLastCalledWith(1);
  });
});

describe('ItemsGridController — resize keeps the anchor', () => {
  it('keeps the first card of the page on screen when the page shrinks', () => {
    const controller = setup();
    controller.goTo(2); // items 24–35
    controller.setViewportSize(NARROW); // 9 per page
    const state = controller.getState();
    expect(state.pageIndex).toBe(2);
    expect(state.range).toEqual({ start: 18, end: 27 });
    expect(ids(state.items)).toContain(24);
  });

  it('returns to the same page after resizing back and forth', () => {
    const controller = setup();
    controller.goTo(2);
    controller.setViewportSize(NARROW);
    controller.setViewportSize(WIDE);
    expect(controller.getState().range).toEqual({ start: 24, end: 36 });
  });

  it('keeps the anchor when the viewport is hidden and shown again at another size', () => {
    const controller = setup();
    controller.goTo(5); // anchor = item 60
    controller.setViewportSize({ width: 0, height: 0 }); // e.g. an inactive tab
    expect(controller.getState().geometry).toBeNull();
    controller.setViewportSize(NARROW); // 9 per page: item 60 is on page 6, not page 5
    expect(controller.getState()).toMatchObject({ pageIndex: 6, range: { start: 54, end: 63 } });
  });

  it('honours navigation that happened while the viewport was hidden', () => {
    const controller = setup();
    controller.goTo(5);
    controller.setViewportSize({ width: 0, height: 0 });
    controller.goTo(1);
    controller.setViewportSize(NARROW);
    expect(controller.getState().pageIndex).toBe(1);
  });

  it('reanchors on a preset change too', () => {
    const controller = setup();
    controller.goTo(5); // anchor = item 60
    controller.setOptions({ preset: 'large' }); // 3 × 2 = 6 per page
    expect(controller.getState().pageIndex).toBe(10);
  });

  it('reports the reanchored page through onPageChange', () => {
    const onPageChange = vi.fn();
    const controller = setup({ onPageChange });
    controller.goTo(5);
    controller.setOptions({ preset: 'large' });
    expect(onPageChange).toHaveBeenLastCalledWith(10);
  });
});

describe('ItemsGridController — live reflow (client)', () => {
  it('keeps the page number and shifts cards when items are inserted before the page', () => {
    const controller = setup();
    controller.goTo(1);
    controller.setOptions({ items: [...entities(3, 1000), ...entities(120)] });
    const state = controller.getState();
    expect(state.pageIndex).toBe(1);
    expect(state.items[0]?.id).toBe(9);
  });

  it('clamps to the last page when the current page disappears', () => {
    const controller = setup();
    controller.goTo(9);
    controller.setOptions({ items: entities(30) });
    expect(controller.getState()).toMatchObject({ pageIndex: 2, pageCount: 3 });
    expect(ids(controller.getState().items)).toEqual([24, 25, 26, 27, 28, 29]);
  });

  it('is empty, not loading, when there are no items', () => {
    const state = setup({ items: [] }).getState();
    expect(state).toMatchObject({ isEmpty: true, items: [], pageCount: 1 });
  });
});

describe('ItemsGridController — stable reflow (client)', () => {
  const stable = (): ItemsGridController<Entity> => {
    const controller = setup({ reflow: 'stable' });
    controller.goTo(1); // items 12–23
    return controller;
  };

  it('keeps the frozen cards when items are inserted before the page', () => {
    const controller = stable();
    controller.setOptions({ items: [...entities(5, 1000), ...entities(120)] });
    expect(ids(controller.getState().items)).toEqual(ids(entities(12, 12)));
    expect(controller.getState()).toMatchObject({ frozen: true, pendingCount: 5 });
  });

  it('still delivers status updates to frozen cards', () => {
    const controller = stable();
    const updated = entities(120).map(item =>
      item.id === 15 ? { ...item, status: 'error' } : item
    );
    controller.setOptions({ items: updated });
    expect(controller.getState().items.find(item => item.id === 15)?.status).toBe('error');
  });

  it('leaves the page short when a frozen card is removed', () => {
    const controller = stable();
    controller.setOptions({ items: entities(120).filter(item => item.id !== 13) });
    expect(controller.getState().items).toHaveLength(11);
  });

  it('re-freezes on navigation and clears pendingCount', () => {
    const controller = stable();
    const grown = [...entities(5, 1000), ...entities(120)];
    controller.setOptions({ items: grown });
    controller.goTo(1);
    expect(controller.getState().pendingCount).toBe(0);
    expect(controller.getState().items[0]?.id).toBe(7);
  });

  it('re-freezes on refresh()', () => {
    const controller = stable();
    controller.setOptions({ items: [...entities(5, 1000), ...entities(120)] });
    controller.refresh();
    expect(controller.getState()).toMatchObject({ pendingCount: 0 });
    expect(controller.getState().items[0]?.id).toBe(7);
  });

  it('re-freezes on resize', () => {
    const controller = stable();
    controller.setOptions({ items: [...entities(5, 1000), ...entities(120)] });
    controller.setViewportSize(NARROW);
    expect(controller.getState().pendingCount).toBe(0);
  });

  it('re-freezes when every frozen card was removed', () => {
    const controller = stable();
    controller.setOptions({ items: entities(120).filter(item => item.id < 12 || item.id > 23) });
    expect(controller.getState().items).toHaveLength(12);
    expect(controller.getState().items[0]?.id).toBe(24);
  });

  it('freezes the current page when switching from live to stable', () => {
    const controller = setup();
    controller.goTo(2);
    controller.setOptions({ reflow: 'stable' });
    controller.setOptions({ items: [...entities(2, 1000), ...entities(120)] });
    expect(controller.getState().items[0]?.id).toBe(24);
    expect(controller.getState().pendingCount).toBe(2);
  });
});

describe('ItemsGridController — server mode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  const server = (
    options: Partial<ItemsGridOptions<Entity>> = {}
  ): { controller: ItemsGridController<Entity>; requests: PageRequest[] } => {
    const requests: PageRequest[] = [];
    const controller = setup({
      mode: 'server',
      items: [],
      total: undefined,
      onPageRequest: request => requests.push(request),
      ...options,
    });
    return { controller, requests };
  };

  it('requests the first page immediately once the page size is known', () => {
    const { requests } = server();
    expect(requests).toEqual([{ pageIndex: 0, pageSize: 12 }]);
  });

  it('keeps the page while the total is unknown, e.g. right after switching to server mode', () => {
    const controller = setup();
    controller.goTo(2);
    const requests: PageRequest[] = [];
    controller.setOptions({
      mode: 'server',
      items: [],
      total: undefined,
      onPageRequest: request => requests.push(request),
    });
    vi.advanceTimersByTime(500);
    expect(controller.getState().pageIndex).toBe(2);
    expect(requests).toEqual([{ pageIndex: 2, pageSize: 12 }]);
  });

  it('is not empty while the total is still unknown', () => {
    const { controller } = server();
    expect(controller.getState().isEmpty).toBe(false);
    controller.setOptions({ total: 0 });
    expect(controller.getState().isEmpty).toBe(true);
  });

  it('renders the supplied page items, cut to the page size', () => {
    const { controller } = server();
    controller.setOptions({ items: entities(15), total: 120 });
    expect(controller.getState().items).toHaveLength(12);
    expect(controller.getState().pageCount).toBe(10);
  });

  it('debounces requests caused by resizing into one', () => {
    const { controller, requests } = server({ total: 120 });
    controller.setViewportSize({ width: 1200, height: 552 });
    controller.setViewportSize({ width: 1100, height: 552 });
    controller.setViewportSize(NARROW);
    expect(requests).toHaveLength(1);
    vi.advanceTimersByTime(150);
    expect(requests).toEqual([
      { pageIndex: 0, pageSize: 12 },
      { pageIndex: 0, pageSize: 9 },
    ]);
  });

  it('requests immediately on navigation and drops a pending resize request', () => {
    const { controller, requests } = server({ total: 120 });
    controller.setViewportSize(NARROW);
    controller.next();
    vi.advanceTimersByTime(500);
    expect(requests).toEqual([
      { pageIndex: 0, pageSize: 12 },
      { pageIndex: 1, pageSize: 9 },
    ]);
  });

  it('does not request the same page twice', () => {
    const { controller, requests } = server({ total: 120 });
    controller.setViewportSize({ width: 1310, height: 550 }); // still 4 × 3
    vi.advanceTimersByTime(500);
    controller.goTo(0);
    expect(requests).toHaveLength(1);
  });

  it('re-requests the current page on refresh()', () => {
    const { controller, requests } = server({ total: 120 });
    controller.refresh();
    expect(requests).toEqual([
      { pageIndex: 0, pageSize: 12 },
      { pageIndex: 0, pageSize: 12 },
    ]);
  });

  it('live: clamps and requests when the total shrinks below the current page', () => {
    const { controller, requests } = server({ total: 120 });
    controller.goTo(9);
    controller.setOptions({ total: 30 });
    expect(controller.getState().pageIndex).toBe(2);
    expect(requests.at(-1)).toEqual({ pageIndex: 2, pageSize: 12 });
  });

  it('live: does not request when the total changes but the page still exists', () => {
    const { controller, requests } = server({ total: 120 });
    controller.setOptions({ total: 125 });
    vi.advanceTimersByTime(500);
    expect(requests).toHaveLength(1);
  });

  it('stable: does not request on total change and reports the growth as pending', () => {
    const { controller, requests } = server({ total: 120, reflow: 'stable' });
    controller.setOptions({ total: 125 });
    vi.advanceTimersByTime(500);
    expect(requests).toHaveLength(1);
    expect(controller.getState()).toMatchObject({ frozen: true, pendingCount: 5 });
    controller.refresh();
    expect(controller.getState().pendingCount).toBe(0);
  });

  it('cancels a pending request on destroy()', () => {
    const { controller, requests } = server({ total: 120 });
    controller.setViewportSize(NARROW);
    controller.destroy();
    vi.advanceTimersByTime(500);
    expect(requests).toHaveLength(1);
  });
});

describe('ItemsGridController — loading', () => {
  it('asks for a whole page of skeletons while the total is unknown', () => {
    const controller = setup({ mode: 'server', items: [], total: undefined, loading: true });
    expect(controller.getState()).toMatchObject({ skeletonCount: 12, isEmpty: false });
  });

  it('asks only for the remaining slots on a known partial last page', () => {
    const controller = setup({ mode: 'server', items: [], total: 117, loading: true });
    controller.goTo(9);
    expect(controller.getState().skeletonCount).toBe(9);
  });

  it('asks for no skeletons once loading ends', () => {
    expect(setup().getState().skeletonCount).toBe(0);
  });
});

describe('ItemsGridController — measured row height', () => {
  it('uses the preset row height until a measurement arrives', () => {
    const controller = setup({ measureRowHeight: true });
    expect(controller.getState().geometry?.rowHeight).toBe(160);
    controller.setMeasuredRowHeight(120);
    expect(controller.getState().geometry).toMatchObject({ rowHeight: 120, rows: 4 });
  });

  it('ignores measurements when measuring is off', () => {
    const controller = setup();
    controller.setMeasuredRowHeight(120);
    expect(controller.getState().geometry?.rowHeight).toBe(160);
  });

  it('measures the sample item, falling back to the first item', () => {
    expect(setup({ measureRowHeight: true }).getState().probeItem?.id).toBe(0);
    expect(
      setup({ measureRowHeight: true, sampleItem: { id: 7, status: 'x' } }).getState().probeItem?.id
    ).toBe(7);
    expect(setup().getState().probeItem).toBeUndefined();
  });
});

describe('ItemsGridController — announcements', () => {
  it('does not announce the initial layout', () => {
    expect(setup().getState().announcement).toBe('');
  });

  it('announces the page and item range after navigation', () => {
    const controller = setup();
    controller.goTo(2);
    expect(controller.getState().announcement).toBe('Page 3 of 10, items 25–36 of 120');
  });

  it('announces new items in stable mode', () => {
    const controller = setup({ reflow: 'stable' });
    controller.setOptions({ items: [...entities(120), ...entities(5, 1000)] });
    expect(controller.getState().announcement).toBe('5 new items');
  });

  it('uses custom messages', () => {
    const controller = setup({
      messages: { page: ({ pageIndex, pageCount }) => `Seite ${pageIndex + 1} von ${pageCount}` },
    });
    controller.next();
    expect(controller.getState().announcement).toBe('Seite 2 von 10');
  });
});

describe('ItemsGridController — subscription', () => {
  it('notifies on change and stops after unsubscribe', () => {
    const controller = setup();
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);
    controller.next();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    controller.next();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not report the initial state from the constructor', () => {
    const onStateChange = vi.fn();
    created.push(
      new ItemsGridController<Entity>({
        getKey: item => item.id,
        items: entities(3),
        onStateChange,
      })
    );
    expect(onStateChange).not.toHaveBeenCalled();
  });

  it('reports every new state through onStateChange', () => {
    const onStateChange = vi.fn();
    const controller = setup({ onStateChange });
    onStateChange.mockClear();
    controller.next();
    expect(onStateChange).toHaveBeenCalledTimes(1);
    expect(onStateChange).toHaveBeenCalledWith(controller.getState());
  });

  it('exposes subscribe and getState as bound functions for useSyncExternalStore', () => {
    const controller = setup();
    const { subscribe, getState } = controller;
    const listener = vi.fn();
    subscribe(listener);
    controller.next();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getState().pageIndex).toBe(1);
  });

  it('works again after destroy(), as React StrictMode mounts twice', () => {
    const controller = setup();
    controller.destroy();
    const listener = vi.fn();
    controller.subscribe(listener);
    controller.next();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(controller.getState().pageIndex).toBe(1);
  });

  it('does not notify when a resize leaves the layout unchanged', () => {
    const controller = setup();
    const listener = vi.fn();
    controller.subscribe(listener);
    controller.setViewportSize({ width: 1310, height: 550 });
    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps the same state object while nothing changes', () => {
    const controller = setup();
    const before = controller.getState();
    controller.setOptions({ preset: 'normal' });
    expect(controller.getState()).toBe(before);
  });

  it('exposes align for the view', () => {
    expect(setup({ align: 'center' }).getState().align).toBe('center');
    expect(setup().getState().align).toBe('start');
  });
});

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

describe('ItemsGridController — mode switches', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('requests the page again after server → client → server', () => {
    const requests: PageRequest[] = [];
    const controller = setup({
      mode: 'server',
      items: [],
      onPageRequest: request => requests.push(request),
    });
    controller.setOptions({ mode: 'client', items: entities(120) });
    controller.setOptions({ mode: 'server', items: [], total: undefined });
    expect(requests).toEqual([
      { pageIndex: 0, pageSize: 12 },
      { pageIndex: 0, pageSize: 12 },
    ]);
  });

  it('requests immediately when switching into server mode', () => {
    const requests: PageRequest[] = [];
    const controller = setup({ onPageRequest: request => requests.push(request) });
    controller.goTo(2);
    controller.setOptions({ mode: 'server', items: [] });
    expect(requests).toEqual([{ pageIndex: 2, pageSize: 12 }]);
  });

  it('drops a pending resize request when leaving server mode', () => {
    const requests: PageRequest[] = [];
    const controller = setup({
      mode: 'server',
      items: [],
      total: 120,
      onPageRequest: request => requests.push(request),
    });
    controller.setViewportSize(NARROW);
    controller.setOptions({ mode: 'client', items: entities(120) });
    vi.advanceTimersByTime(500);
    expect(requests).toHaveLength(1);
  });

  it('drops a pending resize request when the viewport is hidden', () => {
    const requests: PageRequest[] = [];
    const controller = setup({
      mode: 'server',
      items: [],
      total: 120,
      onPageRequest: request => requests.push(request),
    });
    controller.setViewportSize(NARROW);
    controller.setViewportSize({ width: 0, height: 0 });
    vi.advanceTimersByTime(500);
    expect(requests).toHaveLength(1);
  });

  it('requests again after destroy() and a remount', () => {
    const requests: PageRequest[] = [];
    const controller = setup({
      mode: 'server',
      items: [],
      total: 120,
      onPageRequest: request => requests.push(request),
    });
    controller.destroy();
    controller.setViewportSize({ width: 0, height: 0 });
    controller.setViewportSize(WIDE);
    expect(requests).toHaveLength(2);
  });
});

describe('ItemsGridController — stable server baseline', () => {
  it('does not count the dataset as new when the first total arrives', () => {
    const controller = setup({ mode: 'server', items: [], reflow: 'stable' });
    controller.setOptions({ items: entities(12), total: 500 });
    expect(controller.getState().pendingCount).toBe(0);
    controller.setOptions({ total: 503 });
    expect(controller.getState().pendingCount).toBe(3);
  });

  it('does not count the dataset as new after switching from client to server', () => {
    const controller = setup({ reflow: 'stable' });
    controller.setOptions({ mode: 'server', items: [], total: undefined });
    controller.setOptions({ items: entities(12), total: 120 });
    expect(controller.getState().pendingCount).toBe(0);
  });
});

describe('ItemsGridController — page index reporting', () => {
  it('reports clamping on the first layout', () => {
    const onPageChange = vi.fn();
    const controller = setup({ pageIndex: 99, items: entities(30), onPageChange });
    expect(controller.getState().pageIndex).toBe(2);
    expect(onPageChange).toHaveBeenLastCalledWith(2);
  });

  it('reports reanchoring when a hidden grid is shown again', () => {
    const onPageChange = vi.fn();
    const controller = setup({ onPageChange });
    controller.goTo(5);
    controller.setViewportSize({ width: 0, height: 0 });
    controller.setViewportSize(NARROW);
    expect(onPageChange).toHaveBeenLastCalledWith(6);
  });

  it('reflects navigation while hidden in the state', () => {
    const controller = setup();
    controller.setViewportSize({ width: 0, height: 0 });
    controller.goTo(3);
    expect(controller.getState().pageIndex).toBe(3);
  });

  it('keeps a consistent state while hidden', () => {
    const controller = setup();
    controller.goTo(2);
    controller.setViewportSize({ width: 0, height: 0 });
    expect(controller.getState()).toMatchObject({
      items: [],
      range: { start: 0, end: 0 },
      canNext: false,
      canPrev: false,
    });
  });

  it('navigates when the pageIndex option changes', () => {
    const controller = setup();
    controller.setOptions({ pageIndex: 3 });
    expect(controller.getState().pageIndex).toBe(3);
    controller.next();
    controller.setOptions({ pageIndex: 3 }); // unchanged option: no navigation
    expect(controller.getState().pageIndex).toBe(4);
  });
});

describe('ItemsGridController — unknown server total', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  const unknown = (): { controller: ItemsGridController<Entity>; requests: PageRequest[] } => {
    const requests: PageRequest[] = [];
    const controller = setup({
      mode: 'server',
      items: entities(12),
      total: undefined,
      onPageRequest: request => requests.push(request),
    });
    return { controller, requests };
  };

  it('allows the next page while pages come back full', () => {
    const { controller, requests } = unknown();
    expect(controller.getState()).toMatchObject({ totalKnown: false, canNext: true });
    controller.next();
    expect(controller.getState().pageIndex).toBe(1);
    expect(requests.at(-1)).toEqual({ pageIndex: 1, pageSize: 12 });
  });

  it('stops at a short page', () => {
    const { controller } = unknown();
    controller.setOptions({ items: entities(5) });
    expect(controller.getState().canNext).toBe(false);
  });

  it('does not clamp goTo forward', () => {
    const { controller } = unknown();
    controller.goTo(3);
    expect(controller.getState().pageIndex).toBe(3);
  });

  it('announces without a total', () => {
    const { controller } = unknown();
    controller.next();
    expect(controller.getState().announcement).toBe('Page 2, items 13–24');
  });

  it('treats a null total as unknown', () => {
    const { controller } = unknown();
    controller.setOptions({ total: null });
    expect(controller.getState()).toMatchObject({ totalKnown: false, canNext: true });
  });
});

describe('ItemsGridController — validation', () => {
  it('throws for an invalid preset value and keeps the previous options', () => {
    const controller = setup();
    expect(() =>
      controller.setOptions({ presets: { normal: { minCardWidth: 0, gap: 8, rowHeight: 96 } } })
    ).toThrow('items-grid: preset "normal" has an invalid minCardWidth (0)');
    controller.setViewportSize(NARROW);
    expect(controller.getState().pageSize).toBe(9);
  });

  it('rejects inherited object keys as preset names', () => {
    expect(() => setup({ preset: 'toString' })).toThrow('unknown preset "toString"');
  });

  it.each([
    ['pageIndex', { pageIndex: Number.NaN }],
    ['total', { mode: 'server' as const, total: Number.NaN }],
    ['maxColumns', { maxColumns: 0 }],
    ['maxPageSize', { maxPageSize: -1 }],
    ['requestDebounceMs', { requestDebounceMs: -5 }],
    ['mode', { mode: 'Server' as unknown as 'server' }],
  ])('throws for an invalid %s', (name, options) => {
    expect(() => setup(options)).toThrow(`items-grid: invalid ${name}`);
  });

  it('throws for a non-finite goTo target', () => {
    expect(() => setup().goTo(Number.NaN)).toThrow('items-grid: invalid pageIndex');
  });

  it('ignores explicit undefined for getKey and message overrides', () => {
    const controller = setup();
    controller.setOptions({ getKey: undefined as unknown as (item: Entity) => number });
    controller.setOptions({ messages: { page: undefined } });
    controller.next();
    expect(controller.getState().announcement).toBe('Page 2 of 10, items 13–24 of 120');
  });
});

describe('ItemsGridController — robustness', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('still requests and reports the page when a subscriber throws', () => {
    const requests: PageRequest[] = [];
    const onPageChange = vi.fn();
    const controller = setup({
      mode: 'server',
      items: [],
      total: 120,
      onPageRequest: request => requests.push(request),
      onPageChange,
    });
    controller.subscribe(() => {
      throw new Error('render failed');
    });
    expect(() => controller.next()).toThrow('render failed');
    expect(requests.at(-1)).toEqual({ pageIndex: 1, pageSize: 12 });
    expect(onPageChange).toHaveBeenLastCalledWith(1);
  });

  it('warns once about duplicate keys on the page', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const controller = setup({ items: [...entities(3), { id: 1, status: 'dup' }] });
    controller.setOptions({ items: [...entities(3), { id: 1, status: 'dup2' }] });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('duplicate key "1"');
    warn.mockRestore();
  });

  it('freezes the state it hands out', () => {
    const state = setup().getState();
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.items)).toBe(true);
  });

  it('binds the navigation methods', () => {
    const controller = setup();
    const { next, goTo } = controller;
    next();
    expect(controller.getState().pageIndex).toBe(1);
    goTo(0);
    expect(controller.getState().pageIndex).toBe(0);
  });
});

describe('ItemsGridController — round 2', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('keeps pageCount consistent with pageIndex while hidden', () => {
    const controller = setup();
    controller.goTo(3);
    controller.setViewportSize({ width: 0, height: 0 });
    expect(controller.getState()).toMatchObject({ pageIndex: 3, pageCount: 4 });
    controller.last();
    controller.setViewportSize(WIDE);
    expect(controller.getState().pageIndex).toBe(3);
  });

  it.each([
    ['a string pageIndex', { pageIndex: '3' as unknown as number }],
    ['a null pageIndex', { pageIndex: null as unknown as number }],
    ['a string total', { mode: 'server' as const, total: '10' as unknown as number }],
    ['items that are not an array', { items: { length: 3 } as unknown as Entity[] }],
    ['a non-function message', { messages: { page: 'x' as unknown as () => string } }],
  ])('rejects %s without storing anything', (_, patch) => {
    const controller = setup();
    const before = controller.getState();
    expect(() => controller.setOptions({ ...patch, align: 'center' })).toThrow(
      'items-grid: invalid'
    );
    expect(controller.getState()).toBe(before);
    controller.setOptions({ align: 'center' });
    expect(controller.getState().align).toBe('center');
  });

  it('prints rejected values unambiguously', () => {
    expect(() => setup({ pageIndex: '3' as unknown as number })).toThrow('invalid pageIndex ("3")');
  });

  it('restores the previous options when the sync itself throws', () => {
    const controller = setup();
    const throwing = (): never => {
      throw new Error('bad key');
    };
    expect(() => controller.setOptions({ getKey: throwing, items: entities(5) })).toThrow(
      'bad key'
    );
    controller.setViewportSize(NARROW);
    expect(controller.getState().items).toHaveLength(9);
  });

  it('applies a pageIndex change in the same sync, even when a subscriber throws', () => {
    const controller = setup();
    let fail = true;
    controller.subscribe(() => {
      if (fail) {
        fail = false;
        throw new Error('render failed');
      }
    });
    expect(() => controller.setOptions({ items: entities(119), pageIndex: 5 })).toThrow(
      'render failed'
    );
    expect(controller.getState().pageIndex).toBe(5);
  });

  it('sends one request when mode and pageIndex change together', () => {
    const requests: PageRequest[] = [];
    const controller = setup({ onPageRequest: request => requests.push(request) });
    controller.goTo(3);
    controller.setOptions({ mode: 'server', items: [], pageIndex: 0 });
    expect(requests).toEqual([{ pageIndex: 0, pageSize: 12 }]);
  });

  it('does not navigate again when pageIndex echoes the current page', () => {
    const controller = setup({ reflow: 'stable' });
    controller.next();
    controller.setOptions({ items: [...entities(2, 1000), ...entities(120)] });
    const listener = vi.fn();
    controller.subscribe(listener);
    controller.setOptions({ pageIndex: 1 });
    expect(listener).not.toHaveBeenCalled();
    expect(controller.getState().pendingCount).toBe(2);
  });

  it('runs only the newest effects when a callback navigates during a notification', () => {
    const requests: number[] = [];
    const pages: number[] = [];
    let redirected = false;
    const controller = setup({
      mode: 'server',
      items: [],
      total: 120,
      onPageRequest: request => requests.push(request.pageIndex),
      onPageChange: page => pages.push(page),
    });
    controller.setOptions({
      onStateChange: state => {
        if (state.pageIndex === 3 && !redirected) {
          redirected = true;
          controller.goTo(7);
        }
      },
    });
    controller.goTo(3);
    expect(controller.getState().pageIndex).toBe(7);
    expect(requests.at(-1)).toBe(7);
    expect(pages.at(-1)).toBe(7);
  });

  it('reports the page change even when onPageRequest throws, and keeps every subscriber running', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onPageChange = vi.fn();
    const second = vi.fn();
    const controller = setup({
      mode: 'server',
      items: [],
      total: 120,
      onPageRequest: request => {
        if (request.pageIndex === 2) throw new Error('request failed');
      },
      onPageChange,
    });
    controller.subscribe(() => {
      throw new Error('first subscriber');
    });
    controller.subscribe(second);
    expect(() => controller.goTo(2)).toThrow('first subscriber');
    expect(second).toHaveBeenCalled();
    expect(onPageChange).toHaveBeenLastCalledWith(2);
    expect(errors).toHaveBeenCalledWith(
      expect.stringContaining('onPageRequest'),
      expect.objectContaining({ message: 'request failed' })
    );
    errors.mockRestore();
  });

  it('clamps a stable server page whose total shrank below it', () => {
    const requests: PageRequest[] = [];
    const controller = setup({
      mode: 'server',
      items: entities(12),
      total: 100,
      reflow: 'stable',
      onPageRequest: request => requests.push(request),
    });
    controller.goTo(5);
    controller.setOptions({ total: 30 });
    expect(controller.getState()).toMatchObject({ pageIndex: 2, range: { start: 24, end: 30 } });
    expect(requests.at(-1)).toEqual({ pageIndex: 2, pageSize: 12 });
  });

  it('keeps the stable baseline across a brief unknown total, but is not frozen meanwhile', () => {
    const controller = setup({ mode: 'server', items: [], total: 100, reflow: 'stable' });
    controller.setOptions({ total: 105 });
    controller.setOptions({ total: null });
    expect(controller.getState()).toMatchObject({ frozen: false, pendingCount: 0 });
    controller.setOptions({ total: 107 });
    expect(controller.getState()).toMatchObject({ frozen: true, pendingCount: 7 });
  });

  it('warns about keys that collide as strings', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setup({
      items: [
        { id: 1, status: 'a' },
        { id: '1' as unknown as number, status: 'b' },
      ],
    });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('duplicate key "1"'));
    warn.mockRestore();
  });

  it('freezes the geometry too', () => {
    expect(Object.isFrozen(setup().getState().geometry)).toBe(true);
  });
});

describe('ItemsGridController — round 3 (re-entrancy)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('anchors on the new page when mode and pageIndex change together', () => {
    const controller = setup();
    controller.goTo(5);
    controller.setOptions({ mode: 'server', items: entities(12), total: 300, pageIndex: 0 });
    controller.setViewportSize(NARROW);
    expect(controller.getState().pageIndex).toBe(0);
  });

  it('keeps the page report and the immediate request when a subscriber syncs without navigating', () => {
    const requests: PageRequest[] = [];
    const onPageChange = vi.fn();
    const controller = setup({
      mode: 'server',
      items: [],
      total: 120,
      onPageRequest: request => requests.push(request),
      onPageChange,
    });
    controller.subscribe(() => controller.setOptions({ items: [] }));
    controller.goTo(3);
    expect(onPageChange).toHaveBeenLastCalledWith(3);
    expect(requests.at(-1)).toEqual({ pageIndex: 3, pageSize: 12 });
  });

  it('keeps the page report when a subscriber changes a visual option', () => {
    const onPageChange = vi.fn();
    const controller = setup({ onPageChange });
    controller.subscribe(() => controller.setOptions({ align: 'center' }));
    controller.goTo(2);
    expect(onPageChange).toHaveBeenLastCalledWith(2);
  });

  it('keeps a pending resize request when a mode switch is rolled back', () => {
    const requests: PageRequest[] = [];
    const controller = setup({
      mode: 'server',
      items: [],
      total: 120,
      onPageRequest: request => requests.push(request),
    });
    controller.setViewportSize(NARROW);
    expect(() =>
      controller.setOptions({ mode: 'client', items: [null as unknown as Entity] })
    ).toThrow();
    vi.advanceTimersByTime(500);
    expect(requests.at(-1)).toEqual({ pageIndex: 0, pageSize: 9 });
  });

  it('keeps the page report when a subscriber starts loading during navigation', () => {
    const onPageChange = vi.fn();
    const requests: PageRequest[] = [];
    const controller = setup({
      mode: 'server',
      items: [],
      total: 120,
      onPageChange,
      onPageRequest: request => requests.push(request),
    });
    controller.subscribe(() => controller.setOptions({ loading: true }));
    controller.goTo(2);
    expect(onPageChange).toHaveBeenLastCalledWith(2);
    expect(requests.at(-1)).toEqual({ pageIndex: 2, pageSize: 12 });
  });

  it('runs no effects for a sync that a subscriber destroyed', () => {
    const requests: PageRequest[] = [];
    const onPageChange = vi.fn();
    const controller = setup({
      mode: 'server',
      items: [],
      total: 120,
      onPageRequest: request => requests.push(request),
      onPageChange,
    });
    controller.subscribe(() => controller.destroy());
    controller.goTo(3);
    vi.advanceTimersByTime(500);
    expect(requests).toHaveLength(1);
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('takes a new stable baseline when a server page clamps', () => {
    const controller = setup({
      mode: 'server',
      items: entities(12),
      total: 100,
      reflow: 'stable',
    });
    controller.goTo(5);
    controller.setOptions({ total: 30 });
    controller.setOptions({ total: 50 });
    expect(controller.getState().pendingCount).toBe(20);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { flushFrames, installLayoutStubs, ResizeObserverStub } from '../test-utils/resize-observer';
import { type ItemsGridMount, mountItemsGrid, type MountItemsGridOptions } from './vanilla';

interface Entity {
  id: number;
  name: string;
}

const entities = (count: number): Entity[] =>
  Array.from({ length: count }, (_, id) => ({ id, name: `Entity ${id}` }));

let container: HTMLElement;
let mounted: ItemsGridMount<Entity> | null = null;

function mount(options: Partial<MountItemsGridOptions<Entity>> = {}): ItemsGridMount<Entity> {
  mounted = mountItemsGrid<Entity>(container, {
    getKey: item => item.id,
    items: entities(30),
    renderItem: item => {
      const card = document.createElement('article');
      card.textContent = item.name;
      return card;
    },
    ...options,
  });
  return mounted;
}

const viewport = (): HTMLElement => container.querySelector('.mf-items-grid__viewport')!;
const cells = (): HTMLElement[] =>
  Array.from(viewport().querySelectorAll<HTMLElement>(':scope > .mf-items-grid__cell'));
const texts = (): string[] => cells().map(cell => cell.textContent ?? '');
const button = (name: string): HTMLButtonElement =>
  Array.from(container.querySelectorAll('button')).find(
    candidate => candidate.getAttribute('aria-label') === name
  )!;

/** Normal preset: 1318×552 → 4 × 3 = 12 per page. */
function layout(width = 1318, height = 552): void {
  ResizeObserverStub.for(viewport()).fire(width, height);
  flushFrames();
}

beforeEach(() => {
  installLayoutStubs();
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(() => {
  mounted?.destroy();
  mounted = null;
  container.remove();
  vi.unstubAllGlobals();
});

describe('mountItemsGrid', () => {
  it('renders exactly one page of cards once the viewport is measured', () => {
    mount();
    expect(cells()).toHaveLength(0);
    layout();
    expect(cells()).toHaveLength(12);
    expect(texts()[0]).toBe('Entity 0');
  });

  it('marks the grid as a labelled list of list items', () => {
    mount({ ariaLabel: 'Devices' });
    layout();
    expect(viewport().getAttribute('role')).toBe('list');
    expect(viewport().getAttribute('aria-label')).toBe('Devices');
    expect(cells()[0]!.getAttribute('role')).toBe('listitem');
  });

  it('applies the geometry as inline grid styles', () => {
    mount();
    layout();
    expect(viewport().style.gridTemplateColumns).toBe('repeat(4, minmax(0, 1fr))');
    expect(viewport().style.gridAutoRows).toBe('160px');
    expect(container.classList.contains('mf-items-grid')).toBe(true);
  });

  it('pages with the pager buttons', () => {
    mount();
    layout();
    expect(button('Previous page').disabled).toBe(true);
    expect(button('Page 1').getAttribute('aria-current')).toBe('page');
    button('Next page').click();
    expect(texts()[0]).toBe('Entity 12');
    expect(button('Page 2').getAttribute('aria-current')).toBe('page');
    button('Page 3').click();
    expect(texts()).toEqual([
      'Entity 24',
      'Entity 25',
      'Entity 26',
      'Entity 27',
      'Entity 28',
      'Entity 29',
    ]);
    expect(button('Next page').disabled).toBe(true);
  });

  it('shows the visible range in the pager status', () => {
    mount();
    layout();
    expect(container.querySelector('.mf-items-grid-pager__status')!.textContent).toBe(
      'Items 1–12 of 30'
    );
  });

  it('pages with PageDown and PageUp while focus is inside the grid', () => {
    mount();
    layout();
    const event = new KeyboardEvent('keydown', {
      key: 'PageDown',
      bubbles: true,
      cancelable: true,
    });
    cells()[0]!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(texts()[0]).toBe('Entity 12');
  });

  it('announces page changes in a polite live region', () => {
    mount();
    layout();
    button('Next page').click();
    const live = container.querySelector('[aria-live="polite"]')!;
    expect(live.textContent).toBe('Page 2 of 3, items 13–24 of 30');
  });

  it('keeps a card element across updates and hands it the new item', () => {
    const updateItem = vi.fn((element: HTMLElement, item: Entity) => {
      element.textContent = item.name;
    });
    const grid = mount({ updateItem });
    layout();
    const first = cells()[0]!.firstElementChild;
    grid.update({ items: entities(30).map(item => ({ ...item, name: `${item.name}!` })) });
    expect(cells()[0]!.firstElementChild).toBe(first);
    expect(texts()[0]).toBe('Entity 0!');
    expect(updateItem).toHaveBeenCalled();
  });

  it('re-renders a card whose item changed when there is no updateItem', () => {
    const grid = mount();
    layout();
    const first = cells()[0]!.firstElementChild;
    grid.update({ items: entities(30).map(item => ({ ...item, name: `${item.name}!` })) });
    expect(cells()[0]!.firstElementChild).not.toBe(first);
    expect(texts()[0]).toBe('Entity 0!');
  });

  it('re-renders every card when renderItem changes', () => {
    const grid = mount();
    layout();
    grid.update({
      renderItem: item => {
        const card = document.createElement('article');
        card.textContent = `New ${item.name}`;
        return card;
      },
    });
    expect(texts()[0]).toBe('New Entity 0');
  });

  it('keeps the cell of an unchanged item in place', () => {
    const grid = mount();
    layout();
    const cell = cells()[3];
    grid.update({ items: [...entities(30)] });
    expect(cells()[3]).toBe(cell);
  });

  it('renders one skeleton per slot while loading', () => {
    mount({
      mode: 'server',
      items: [],
      loading: true,
      renderSkeleton: () => document.createElement('div'),
    });
    layout();
    const skeletons = viewport().querySelectorAll('.mf-items-grid__cell--skeleton');
    expect(skeletons).toHaveLength(12);
    expect(skeletons[0]!.getAttribute('aria-hidden')).toBe('true');
    expect(viewport().getAttribute('aria-busy')).toBe('true');
  });

  it('renders the empty template when there are no items', () => {
    mount({
      items: [],
      renderEmpty: () => {
        const message = document.createElement('p');
        message.textContent = 'No entities yet';
        return message;
      },
    });
    layout();
    expect(container.querySelector('.mf-items-grid__empty')!.textContent).toBe('No entities yet');
  });

  it('measures the row height from a hidden probe card', () => {
    mount({ measureRowHeight: true });
    layout();
    const probe = container.querySelector<HTMLElement>('.mf-items-grid__probe')!;
    expect(probe.getAttribute('aria-hidden')).toBe('true');
    expect(probe.textContent).toBe('Entity 0');
    ResizeObserverStub.for(probe).fire(280, 118, { inlineSize: 280, blockSize: 118 });
    flushFrames();
    expect(viewport().style.gridAutoRows).toBe('118px');
  });

  it('omits the pager when asked', () => {
    mount({ pager: false });
    layout();
    expect(container.querySelector('nav')).toBeNull();
  });

  it('applies option updates, e.g. a preset change', () => {
    const grid = mount();
    layout();
    grid.update({ preset: 'compact' });
    expect(cells()).toHaveLength(30); // 6 × 5 fit, 30 items exist
  });

  it('navigates when update() changes pageIndex', () => {
    const grid = mount();
    layout();
    grid.update({ pageIndex: 2 });
    expect(texts()[0]).toBe('Entity 24');
  });

  it('renders a duplicate key once instead of corrupting the grid', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mount({ items: [...entities(3), { id: 1, name: 'Duplicate' }] });
    layout();
    expect(texts()).toEqual(['Entity 0', 'Entity 1', 'Entity 2']);
    warn.mockRestore();
  });

  it('ignores PageDown typed into a field inside a card', () => {
    mount({
      renderItem: item => {
        const card = document.createElement('article');
        card.append(item.name, document.createElement('input'));
        return card;
      },
    });
    layout();
    const event = new KeyboardEvent('keydown', {
      key: 'PageDown',
      bubbles: true,
      cancelable: true,
    });
    cells()[0]!.querySelector('input')!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(texts()[0]).toBe('Entity 0');
  });

  it('does not prevent keys other than PageUp and PageDown', () => {
    mount();
    layout();
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    });
    cells()[0]!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('pages back with PageUp', () => {
    mount();
    layout();
    button('Next page').click();
    cells()[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true }));
    expect(texts()[0]).toBe('Entity 0');
  });

  it('swaps skeletons for cards when loading ends', () => {
    const grid = mount({
      mode: 'server',
      items: [],
      loading: true,
      renderSkeleton: () => document.createElement('div'),
    });
    layout();
    grid.update({ items: entities(12), total: 30, loading: false });
    expect(viewport().querySelectorAll('.mf-items-grid__cell--skeleton')).toHaveLength(0);
    expect(cells()).toHaveLength(12);
    expect(viewport().hasAttribute('aria-busy')).toBe(false);
  });

  it('is not a list while it shows the empty state', () => {
    const grid = mount({ items: [], renderEmpty: () => document.createElement('p') });
    layout();
    expect(viewport().hasAttribute('role')).toBe(false);
    grid.update({ items: entities(3) });
    expect(viewport().getAttribute('role')).toBe('list');
    expect(container.querySelector('.mf-items-grid__empty')).toBeNull();
  });

  it('rejects an invalid update without changing anything', () => {
    const grid = mount({ ariaLabel: 'Entities' });
    layout();
    const renamed = (item: Entity): HTMLElement => {
      const card = document.createElement('article');
      card.textContent = `New ${item.name}`;
      return card;
    };
    expect(() =>
      grid.update({ renderItem: renamed, preset: 'bogus', ariaLabel: 'Changed' })
    ).toThrow('unknown preset "bogus"');
    expect(cells()).toHaveLength(12);
    button('Next page').click();
    expect(texts()[0]).toBe('Entity 12');
    expect(viewport().getAttribute('aria-label')).toBe('Entities');
  });

  it('renders a new item shape with the new renderer in a single update', () => {
    interface Order {
      orderId: string;
      label: string;
    }
    const grid = mount();
    layout();
    const orders: Order[] = Array.from({ length: 20 }, (_, n) => ({
      orderId: `o${n}`,
      label: `Order ${n}`,
    }));
    (grid as unknown as ItemsGridMount<Order>).update({
      items: orders,
      getKey: order => order.orderId,
      renderItem: order => {
        const card = document.createElement('article');
        card.textContent = order.label;
        return card;
      },
    } as Partial<MountItemsGridOptions<Order>>);
    expect(texts()[0]).toBe('Order 0');
    grid.update({ align: 'center' });
    expect(texts()[0]).toBe('Order 0');
  });

  it('keeps a valid update applied when a callback throws afterwards', () => {
    let fail = false;
    const grid = mount({
      onStateChange: () => {
        if (fail) throw new Error('chrome failed');
      },
    });
    layout();
    fail = true;
    const renamed = (item: Entity): HTMLElement => {
      const card = document.createElement('article');
      card.textContent = `New ${item.name}`;
      return card;
    };
    expect(() => grid.update({ renderItem: renamed, items: entities(29) })).toThrow(
      'chrome failed'
    );
    fail = false;
    expect(texts()[0]).toBe('New Entity 0');
    grid.update({ ariaLabel: 'Later' });
    expect(texts()[0]).toBe('New Entity 0');
  });

  it('keeps an applied update whose state is unchanged when an effect throws', () => {
    const grid = mount({ items: entities(12) });
    layout();
    const renamed = (item: Entity): HTMLElement => {
      const card = document.createElement('article');
      card.textContent = `New ${item.name}`;
      return card;
    };
    expect(() =>
      grid.update({
        mode: 'server',
        total: 12,
        renderItem: renamed,
        onPageRequest: () => {
          throw new Error('offline');
        },
      })
    ).toThrow('offline');
    expect(texts()[0]).toBe('New Entity 0');
  });

  it('rethrows the first error when re-rendering after it fails again', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const grid = mount();
    layout();
    expect(() =>
      grid.update({
        items: entities(29),
        renderItem: () => {
          throw new Error('render failed');
        },
      })
    ).toThrow('render failed');
    expect(errors).toHaveBeenCalledWith(
      expect.stringContaining('re-rendering after a failed update'),
      expect.objectContaining({ message: 'render failed' })
    );
    errors.mockRestore();
  });

  it('starts no observers when a callback destroys the grid during an update', () => {
    const grid: ItemsGridMount<Entity> = mount({
      onPageChange: () => {
        grid.destroy();
        mounted = null;
      },
    });
    layout();
    grid.update({ pageIndex: 2, measureRowHeight: true });
    expect(ResizeObserverStub.instances.filter(observer => !observer.disconnected)).toHaveLength(0);
  });

  it('warns once when the handle is used after destroy', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const grid = mount();
    grid.destroy();
    mounted = null;
    grid.controller.next();
    grid.controller.goTo(2);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('after destroy()');
    warn.mockRestore();
  });

  it('ignores explicit undefined for getKey and renderItem', () => {
    const grid = mount();
    layout();
    grid.update({ getKey: undefined, renderItem: undefined, items: entities(20) } as Partial<
      MountItemsGridOptions<Entity>
    >);
    expect(texts()[0]).toBe('Entity 0');
  });

  it('keeps the pager status blank until the grid is measured', () => {
    mount();
    expect(container.querySelector('.mf-items-grid-pager__status')!.textContent).toBe('');
  });

  it('does not page when a card already handled the key', () => {
    mount({
      renderItem: item => {
        const card = document.createElement('article');
        card.textContent = item.name;
        card.addEventListener('keydown', event => event.preventDefault());
        return card;
      },
    });
    layout();
    cells()[0]!.firstElementChild!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, cancelable: true })
    );
    expect(texts()[0]).toBe('Entity 0');
  });

  it('turns the handle inert after destroy', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onPageChange = vi.fn();
    const grid = mount({ onPageChange });
    layout();
    grid.destroy();
    mounted = null;
    grid.controller.goTo(2);
    expect(onPageChange).not.toHaveBeenCalled();
    expect(() => grid.destroy()).not.toThrow();
  });

  it('sends no page request after destroy', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const requests: unknown[] = [];
    const grid = mount({
      mode: 'server',
      items: [],
      onPageRequest: request => requests.push(request),
    });
    layout();
    ResizeObserverStub.for(viewport()).fire(976, 552);
    flushFrames();
    grid.destroy();
    mounted = null;
    vi.advanceTimersByTime(500);
    vi.useRealTimers();
    expect(requests).toHaveLength(1);
  });

  it('refuses updates after destroy', () => {
    const grid = mount();
    grid.destroy();
    mounted = null;
    expect(() => grid.update({ items: [] })).toThrow('items-grid: update() after destroy()');
  });

  it('removes everything it created and stops observing on destroy', () => {
    const grid = mount();
    layout();
    const observer = ResizeObserverStub.for(viewport());
    grid.destroy();
    mounted = null;
    expect(container.childElementCount).toBe(0);
    expect(container.classList.contains('mf-items-grid')).toBe(false);
    expect(observer.disconnected).toBe(true);
  });
});

describe('mountItemsGrid — update() when app code throws mid-update', () => {
  it('keeps the previous renderer and page', () => {
    let fail = false;
    const grid = mount({
      messages: {
        page: info => {
          if (fail) throw new Error('bad message');
          return `Page ${info.pageIndex + 1}`;
        },
      },
    });
    layout();
    const renamed = (item: Entity): HTMLElement => {
      const card = document.createElement('article');
      card.textContent = `New ${item.name}`;
      return card;
    };
    fail = true;
    expect(() => grid.update({ renderItem: renamed, pageIndex: 1 })).toThrow('bad message');
    fail = false;
    grid.update({ align: 'center' });
    expect(texts()[0]).toBe('Entity 0');
    expect(grid.controller.getState().pageIndex).toBe(0);
  });
});

describe('mountItemsGrid — arrowKeys', () => {
  /** MutationObserver callbacks run as microtasks after the DOM changes. */
  const settle = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));
  const press = (target: Element, key: string): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
  };
  const focused = (): string => (document.activeElement as HTMLElement | null)?.textContent ?? '';
  const tabStops = (): string[] =>
    cells()
      .filter(cell => cell.getAttribute('tabindex') === '0')
      .map(cell => cell.textContent ?? '');
  const withButton = (item: Entity): HTMLElement => {
    const card = document.createElement('article');
    card.append(item.name);
    const action = document.createElement('button');
    action.type = 'button';
    action.textContent = '';
    action.setAttribute('aria-label', `Open ${item.name}`);
    card.append(action);
    return card;
  };

  it('is off by default: cards are not tab stops and arrows do nothing', async () => {
    mount();
    layout();
    await settle();
    expect(cells().some(cell => cell.hasAttribute('tabindex'))).toBe(false);
    expect(press(cells()[0]!, 'ArrowRight').defaultPrevented).toBe(false);
  });

  it('makes one card the tab stop and moves focus with the arrow keys, Home and End', async () => {
    mount({ arrowKeys: true });
    layout();
    await settle();
    expect(tabStops()).toEqual(['Entity 0']);
    expect(cells().filter(cell => cell.getAttribute('tabindex') === '-1')).toHaveLength(11);
    cells()[0]!.focus();
    expect(press(cells()[0]!, 'ArrowRight').defaultPrevented).toBe(true);
    expect(focused()).toBe('Entity 1');
    expect(tabStops()).toEqual(['Entity 1']);
    press(document.activeElement!, 'ArrowDown');
    expect(focused()).toBe('Entity 5');
    press(document.activeElement!, 'End');
    expect(focused()).toBe('Entity 11');
    press(document.activeElement!, 'Home');
    expect(focused()).toBe('Entity 0');
  });

  it('crosses pages with the arrows and focuses the matching card', async () => {
    mount({ arrowKeys: true });
    layout();
    await settle();
    cells()[11]!.focus();
    press(cells()[11]!, 'ArrowRight');
    await settle();
    expect(texts()[0]).toBe('Entity 12');
    expect(focused()).toBe('Entity 12');
    press(document.activeElement!, 'ArrowRight');
    press(document.activeElement!, 'ArrowUp');
    await settle();
    // Column 1 of the bottom row of page 1.
    expect(focused()).toBe('Entity 9');
    expect(tabStops()).toEqual(['Entity 9']);
  });

  it('keeps focus on the card at the same position when PageDown pages', async () => {
    mount({ arrowKeys: true });
    layout();
    await settle();
    cells()[5]!.focus();
    press(cells()[5]!, 'PageDown');
    await settle();
    expect(focused()).toBe('Entity 17');
    // The last page has 6 cards: focus clamps to the last one.
    press(document.activeElement!, 'PageDown');
    await settle();
    expect(focused()).toBe('Entity 29');
  });

  it("leaves keys inside a card's controls alone; Escape returns to the card", async () => {
    mount({ arrowKeys: true, renderItem: withButton });
    layout();
    await settle();
    const action = button('Open Entity 3');
    action.focus();
    // Reaching a card's control with Tab makes that card the arrow start.
    expect(tabStops()).toEqual(['Entity 3']);
    expect(press(action, 'ArrowRight').defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(action);
    press(action, 'Escape');
    expect(document.activeElement).toBe(cells()[3]!);
  });

  it('waits for server cards before focusing, and not if focus moved elsewhere meanwhile', async () => {
    const grid = mount({
      arrowKeys: true,
      mode: 'server',
      items: entities(12),
      total: 60,
      renderSkeleton: () => document.createElement('div'),
    });
    layout();
    await settle();
    cells()[2]!.focus();
    press(cells()[2]!, 'PageDown');
    grid.update({ loading: true });
    await settle();
    grid.update({ loading: false, items: entities(24).slice(12) });
    await settle();
    expect(focused()).toBe('Entity 14');

    press(document.activeElement!, 'PageDown');
    grid.update({ loading: true });
    await settle();
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    grid.update({ loading: false, items: entities(36).slice(24) });
    await settle();
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });

  it('swaps left and right in a right-to-left layout', async () => {
    mount({ arrowKeys: true });
    viewport().style.direction = 'rtl';
    layout();
    await settle();
    cells()[0]!.focus();
    press(cells()[0]!, 'ArrowLeft');
    expect(focused()).toBe('Entity 1');
  });

  it('turns off with update(): no tab stops left, arrows do nothing', async () => {
    const grid = mount({ arrowKeys: true });
    layout();
    await settle();
    grid.update({ arrowKeys: false });
    await settle();
    expect(cells().some(cell => cell.hasAttribute('tabindex'))).toBe(false);
    expect(press(cells()[0]!, 'ArrowRight').defaultPrevented).toBe(false);
  });
});

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

const viewport = (): HTMLElement => container.querySelector('.qf-items-grid__viewport')!;
const cells = (): HTMLElement[] =>
  Array.from(viewport().querySelectorAll<HTMLElement>(':scope > .qf-items-grid__cell'));
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
    expect(container.classList.contains('qf-items-grid')).toBe(true);
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
    expect(container.querySelector('.qf-items-grid-pager__status')!.textContent).toBe(
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
    const skeletons = viewport().querySelectorAll('.qf-items-grid__cell--skeleton');
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
    expect(container.querySelector('.qf-items-grid__empty')!.textContent).toBe('No entities yet');
  });

  it('measures the row height from a hidden probe card', () => {
    mount({ measureRowHeight: true });
    layout();
    const probe = container.querySelector<HTMLElement>('.qf-items-grid__probe')!;
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

  it('removes everything it created and stops observing on destroy', () => {
    const grid = mount();
    layout();
    const observer = ResizeObserverStub.for(viewport());
    grid.destroy();
    mounted = null;
    expect(container.childElementCount).toBe(0);
    expect(container.classList.contains('qf-items-grid')).toBe(false);
    expect(observer.disconnected).toBe(true);
  });
});

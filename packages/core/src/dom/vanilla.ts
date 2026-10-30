import {
  ItemsGridController,
  type ItemsGridHandle,
  type ItemsGridOptions,
  type ItemsGridState,
} from '../controller';
import { getPagerItems, type PagerItem } from '../engine/paging';
import type { ItemKey } from '../engine/types';
import { DEFAULT_PAGER_LABELS, type PagerLabels } from '../pager';
import { isEditableTarget } from './keyboard';
import { observeSize } from './observe';
import {
  getCellStyle,
  getEmptyStyle,
  getHostStyle,
  getProbeStyle,
  getViewportStyle,
  getVisuallyHiddenStyle,
  ITEMS_GRID_CLASSES as CLASSES,
  type StyleDeclarations,
} from './styles';

/** Options for {@link mountItemsGrid}: the controller options plus how to render. */
export interface MountItemsGridOptions<T> extends ItemsGridOptions<T> {
  /**
   * Creates the card element for an item: once per key while it stays visible, again after
   * a skeleton phase, and for the measuring probe (with index `0`). `index` is
   * `range.start` + the card's offset on the page, captured when the card is created.
   */
  readonly renderItem: (item: T, index: number) => HTMLElement;
  /**
   * Updates a card in place when its key's item object changes (e.g. a status update).
   * Without it the card is re-rendered with `renderItem`, which drops its DOM state.
   */
  readonly updateItem?: (element: HTMLElement, item: T, index: number) => void;
  /** Creates one skeleton card; rendered once per slot while `loading`. */
  readonly renderSkeleton?: (slot: number) => HTMLElement;
  /** Creates the empty state; rendered over the whole viewport when there are no items. */
  readonly renderEmpty?: () => HTMLElement;
  /** Render the built-in pager below the grid. Default `true`. */
  readonly pager?: boolean;
  /** Accessible name of the card list. */
  readonly ariaLabel?: string;
  /** Pager texts, merged over {@link DEFAULT_PAGER_LABELS}. */
  readonly pagerLabels?: Partial<PagerLabels>;
}

/** A mounted grid. */
export interface ItemsGridMount<T> {
  /** Navigation (`next()`, `goTo()`, `refresh()`…) and state. */
  readonly controller: ItemsGridHandle<T>;
  /**
   * Merges new options and re-renders. A new `renderItem` rebuilds every card; a changed
   * `pageIndex` navigates there.
   *
   * @throws an `items-grid:` error for invalid options, or after `destroy()`.
   */
  readonly update: (options: Partial<MountItemsGridOptions<T>>) => void;
  /** Removes everything the grid added to the container and stops observing. */
  readonly destroy: () => void;
}

interface CardEntry<T> {
  readonly cell: HTMLElement;
  content: HTMLElement;
  item: T;
}

const MOUNT_ONLY_KEYS = [
  'renderItem',
  'updateItem',
  'renderSkeleton',
  'renderEmpty',
  'pager',
  'ariaLabel',
  'pagerLabels',
] as const;

function controllerOptions<T>(
  options: Partial<MountItemsGridOptions<T>>
): Partial<ItemsGridOptions<T>> {
  const result: Record<string, unknown> = { ...options };
  for (const key of MOUNT_ONLY_KEYS) {
    delete result[key];
  }
  return result as Partial<ItemsGridOptions<T>>;
}

/** Applies declarations and removes the ones the previous call set but this one doesn't. */
function applyStyle(
  element: HTMLElement,
  next: StyleDeclarations,
  previous: StyleDeclarations = {}
): StyleDeclarations {
  for (const property of Object.keys(previous)) {
    if (!(property in next)) element.style.removeProperty(property);
  }
  for (const [property, value] of Object.entries(next)) {
    element.style.setProperty(property, value);
  }
  return next;
}

function create(tag: string, className: string, style?: StyleDeclarations): HTMLElement {
  const element = document.createElement(tag);
  element.className = className;
  if (style) applyStyle(element, style);
  return element;
}

/**
 * Mounts a grid into `container` without a framework. The container must get a definite
 * height from its layout (e.g. `flex: 1` or `height: 100%`); the grid fills it exactly.
 */
export function mountItemsGrid<T>(
  container: HTMLElement,
  initialOptions: MountItemsGridOptions<T>
): ItemsGridMount<T> {
  let options = initialOptions;
  const controller = new ItemsGridController<T>(controllerOptions(options) as ItemsGridOptions<T>);
  const originalStyle = container.getAttribute('style');

  // MARK: - Static structure

  container.classList.add(CLASSES.host);
  applyStyle(container, getHostStyle());

  const viewport = create('div', CLASSES.viewport);
  const live = create('div', CLASSES.live, getVisuallyHiddenStyle());
  live.setAttribute('aria-live', 'polite');
  container.append(viewport, live);

  const onKeydown = (event: KeyboardEvent): void => {
    if (!isEditableTarget(event.target) && controller.handleKeydown(event.key)) {
      event.preventDefault();
    }
  };
  viewport.addEventListener('keydown', onKeydown);

  let viewportStyle: StyleDeclarations = {};
  const cards = new Map<ItemKey, CardEntry<T>>();
  const skeletons: HTMLElement[] = [];
  let empty: HTMLElement | null = null;
  let probe: { element: HTMLElement; item: T; stop: () => void } | null = null;
  let pager: {
    nav: HTMLElement;
    status: HTMLElement;
    list: HTMLElement;
    prev: HTMLButtonElement;
    next: HTMLButtonElement;
    slots: { item: PagerItem; element: HTMLElement }[];
  } | null = null;

  const stopViewport = observeSize(viewport, size => controller.setViewportSize(size));

  // MARK: - Rendering

  function renderCells(state: ItemsGridState<T>): HTMLElement[] {
    if (state.loading && options.renderSkeleton) {
      for (const entry of cards.values()) entry.cell.remove();
      cards.clear();
      while (skeletons.length < state.skeletonCount) {
        const cell = create('div', `${CLASSES.cell} ${CLASSES.skeleton}`, getCellStyle());
        cell.setAttribute('aria-hidden', 'true');
        cell.append(options.renderSkeleton(skeletons.length));
        skeletons.push(cell);
      }
      skeletons.splice(state.skeletonCount).forEach(cell => cell.remove());
      return skeletons;
    }
    skeletons.splice(0).forEach(cell => cell.remove());

    const desired: HTMLElement[] = [];
    const seen = new Set<ItemKey>();
    state.items.forEach((item, offset) => {
      const index = state.range.start + offset;
      const key = options.getKey(item);
      // A duplicate key would steal the first card's element; the controller warns about it.
      if (seen.has(key)) return;
      seen.add(key);
      let entry = cards.get(key);
      if (!entry) {
        const cell = create('div', CLASSES.cell, getCellStyle());
        cell.setAttribute('role', 'listitem');
        const content = options.renderItem(item, index);
        cell.append(content);
        entry = { cell, content, item };
        cards.set(key, entry);
      } else if (entry.item !== item) {
        if (options.updateItem) {
          options.updateItem(entry.content, item, index);
        } else {
          const content = options.renderItem(item, index);
          entry.content.replaceWith(content);
          entry.content = content;
        }
        entry.item = item;
      }
      desired.push(entry.cell);
    });
    for (const [key, entry] of cards) {
      if (!seen.has(key)) {
        entry.cell.remove();
        cards.delete(key);
      }
    }
    return desired;
  }

  function renderProbe(state: ItemsGridState<T>): void {
    const item = state.probeItem;
    if (item === undefined) {
      if (probe) {
        probe.stop();
        probe.element.remove();
        probe = null;
      }
      return;
    }
    if (!probe) {
      const element = create('div', `${CLASSES.cell} ${CLASSES.probe}`);
      element.setAttribute('aria-hidden', 'true');
      element.append(options.renderItem(item, 0));
      viewport.append(element);
      const stop = observeSize(element, size => controller.setMeasuredRowHeight(size.height), {
        box: 'border',
      });
      probe = { element, item, stop };
    } else if (probe.item !== item) {
      probe.element.replaceChildren(options.renderItem(item, 0));
      probe.item = item;
    }
    applyStyle(probe.element, getProbeStyle(state));
  }

  function renderPager(state: ItemsGridState<T>): void {
    if (options.pager === false) {
      pager?.nav.remove();
      pager = null;
      return;
    }
    const labels = { ...DEFAULT_PAGER_LABELS, ...options.pagerLabels };
    if (!pager) {
      const nav = create('nav', CLASSES.pager);
      const status = create('span', CLASSES.pagerStatus);
      const list = create('div', CLASSES.pagerList);
      const button = (text: string, onClick: () => void): HTMLButtonElement => {
        const element = create('button', CLASSES.pagerButton) as HTMLButtonElement;
        element.type = 'button';
        element.textContent = text;
        element.addEventListener('click', onClick);
        return element;
      };
      const prev = button('‹', () => controller.prev());
      const next = button('›', () => controller.next());
      list.append(prev, next);
      nav.append(status, list);
      container.insertBefore(nav, live);
      pager = { nav, status, list, prev, next, slots: [] };
    }
    pager.nav.setAttribute('aria-label', labels.navigation);
    pager.status.textContent = state.loading
      ? ''
      : labels.status(state.range, state.total, state.totalKnown);
    pager.prev.setAttribute('aria-label', labels.previous);
    pager.next.setAttribute('aria-label', labels.next);
    pager.prev.disabled = !state.canPrev;
    pager.next.disabled = !state.canNext;

    // Reuse slots by position, so a clicked page button keeps focus after re-render.
    const items = getPagerItems(state.pageIndex, state.pageCount);
    items.forEach((item, slot) => {
      let entry = pager!.slots[slot];
      const isGap = item === 'gap';
      if (!entry || (entry.item === 'gap') !== isGap) {
        const element = isGap
          ? create('span', CLASSES.pagerGap)
          : (create('button', CLASSES.pagerButton) as HTMLButtonElement);
        if (isGap) {
          element.textContent = '…';
          element.setAttribute('aria-hidden', 'true');
        } else {
          (element as HTMLButtonElement).type = 'button';
          element.addEventListener('click', () => {
            const target = pager?.slots.find(candidate => candidate.element === element)?.item;
            if (typeof target === 'number') controller.goTo(target);
          });
        }
        if (entry) entry.element.replaceWith(element);
        else pager!.list.insertBefore(element, pager!.next);
        entry = { item, element };
        pager!.slots[slot] = entry;
      }
      entry.item = item;
      if (typeof item === 'number') {
        entry.element.textContent = String(item + 1);
        entry.element.setAttribute('aria-label', labels.page(item));
        if (item === state.pageIndex) entry.element.setAttribute('aria-current', 'page');
        else entry.element.removeAttribute('aria-current');
      }
    });
    pager.slots.splice(items.length).forEach(entry => entry.element.remove());
  }

  function render(): void {
    const state = controller.getState();
    viewportStyle = applyStyle(viewport, getViewportStyle(state), viewportStyle);
    // The empty state is not a list item, so the viewport is only a list while it has cards.
    if (state.isEmpty) viewport.removeAttribute('role');
    else viewport.setAttribute('role', 'list');
    if (options.ariaLabel) viewport.setAttribute('aria-label', options.ariaLabel);
    else viewport.removeAttribute('aria-label');
    if (state.loading) viewport.setAttribute('aria-busy', 'true');
    else viewport.removeAttribute('aria-busy');

    const desired = renderCells(state);
    desired.forEach((cell, index) => {
      const current = viewport.children[index];
      if (current !== cell) viewport.insertBefore(cell, current ?? null);
    });

    if (state.isEmpty && options.renderEmpty) {
      if (!empty) {
        empty = create('div', CLASSES.empty, getEmptyStyle());
        empty.append(options.renderEmpty());
        viewport.append(empty);
      }
    } else if (empty) {
      empty.remove();
      empty = null;
    }

    renderProbe(state);
    renderPager(state);
    if (live.textContent !== state.announcement) live.textContent = state.announcement;
  }

  let destroyed = false;
  const unsubscribe = controller.subscribe(render);
  render();

  return {
    controller,
    update(next) {
      if (destroyed) throw new Error('items-grid: update() after destroy().');
      if (next.renderItem && next.renderItem !== options.renderItem) {
        // A new renderer means new markup: rebuild every card (and the probe).
        for (const entry of cards.values()) entry.cell.remove();
        cards.clear();
        if (probe) {
          probe.stop();
          probe.element.remove();
          probe = null;
        }
      }
      if (next.renderSkeleton && next.renderSkeleton !== options.renderSkeleton) {
        skeletons.splice(0).forEach(cell => cell.remove());
      }
      options = { ...options, ...next };
      controller.setOptions(controllerOptions(next));
      render();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe();
      stopViewport();
      probe?.stop();
      controller.destroy();
      viewport.removeEventListener('keydown', onKeydown);
      viewport.remove();
      live.remove();
      pager?.nav.remove();
      container.classList.remove(CLASSES.host);
      if (originalStyle === null) container.removeAttribute('style');
      else container.setAttribute('style', originalStyle);
    },
  };
}

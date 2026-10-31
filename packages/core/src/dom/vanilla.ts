import {
  getOptionsRevision,
  ItemsGridController,
  type ItemsGridHandle,
  type ItemsGridOptions,
  type ItemsGridState,
} from '../controller';
import { getPagerItems, type PagerItem } from '../engine/paging';
import type { ItemKey } from '../engine/types';
import { type PagerLabels, resolvePagerLabels } from '../pager';
import { attachCardNavigation } from './card-navigation';
import { shouldPageGrid } from './keyboard';
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
  /** Creates the empty state; rendered over the whole viewport while `state.isEmpty`. */
  readonly renderEmpty?: () => HTMLElement;
  /** Render the built-in pager below the grid. Default `true`. */
  readonly pager?: boolean;
  /**
   * Arrow keys move focus between cards (one card is the tab stop; Home / End, page
   * crossing at the edges, Escape from a card's control back to the card). Default `false`.
   */
  readonly arrowKeys?: boolean;
  /** Accessible name of the card list. */
  readonly ariaLabel?: string;
  /** Pager texts, merged over the defaults (`DEFAULT_PAGER_LABELS`). */
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
  'arrowKeys',
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

function createPagerButton(onClick: () => void): HTMLButtonElement {
  const button = create('button', CLASSES.pagerButton) as HTMLButtonElement;
  button.type = 'button';
  button.addEventListener('click', onClick);
  return button;
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
    if (shouldPageGrid(event) && controller.handleKeydown(event.key)) {
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
  let detachNavigation: (() => void) | null = null;
  let destroyed = false;
  let rebuildCards = false;
  let rebuildSkeletons = false;
  let warnedDestroyed = false;

  const stopViewport = observeSize(viewport, size => controller.setViewportSize(size));

  // MARK: - Rendering

  function clearCards(): void {
    for (const entry of cards.values()) entry.cell.remove();
    cards.clear();
  }

  function clearSkeletons(): void {
    skeletons.splice(0).forEach(cell => cell.remove());
  }

  function removeProbe(): void {
    if (probe) {
      probe.stop();
      probe.element.remove();
      probe = null;
    }
  }

  function renderCells(state: ItemsGridState<T>): HTMLElement[] {
    if (state.loading && options.renderSkeleton) {
      clearCards();
      while (skeletons.length < state.skeletonCount) {
        const cell = create('div', `${CLASSES.cell} ${CLASSES.skeleton}`, getCellStyle());
        cell.setAttribute('aria-hidden', 'true');
        cell.append(options.renderSkeleton(skeletons.length));
        skeletons.push(cell);
      }
      skeletons.splice(state.skeletonCount).forEach(cell => cell.remove());
      return skeletons;
    }
    clearSkeletons();

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
      removeProbe();
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
    const labels = resolvePagerLabels(options.pagerLabels);
    if (!pager) {
      const nav = create('nav', CLASSES.pager);
      const status = create('span', CLASSES.pagerStatus);
      const list = create('div', CLASSES.pagerList);
      const prev = createPagerButton(() => controller.prev());
      prev.textContent = '‹';
      const next = createPagerButton(() => controller.next());
      next.textContent = '›';
      list.append(prev, next);
      nav.append(status, list);
      container.insertBefore(nav, live);
      pager = { nav, status, list, prev, next, slots: [] };
    }
    pager.nav.setAttribute('aria-label', labels.navigation);
    pager.status.textContent =
      state.loading || !state.geometry
        ? ''
        : labels.status(state.range, state.total, state.totalKnown);
    pager.prev.setAttribute('aria-label', labels.previous);
    pager.next.setAttribute('aria-label', labels.next);
    pager.prev.disabled = !state.canPrev;
    pager.next.disabled = !state.canNext;

    // Reuse slots by position, so a clicked page button keeps focus after re-render.
    const items = getPagerItems(state.pageIndex, state.pageCount);
    for (const [slot, item] of items.entries()) {
      let entry = pager.slots[slot];
      const isGap = item === 'gap';
      if (!entry || (entry.item === 'gap') !== isGap) {
        const element = createPagerSlot(isGap);
        if (entry) entry.element.replaceWith(element);
        else pager.list.insertBefore(element, pager.next);
        entry = { item, element };
        pager.slots[slot] = entry;
      }
      entry.item = item;
      if (typeof item === 'number') {
        entry.element.textContent = String(item + 1);
        entry.element.setAttribute('aria-label', labels.page(item));
        if (item === state.pageIndex) entry.element.setAttribute('aria-current', 'page');
        else entry.element.removeAttribute('aria-current');
      }
    }
    pager.slots.splice(items.length).forEach(entry => entry.element.remove());
  }

  /** A gap marker, or a page button that navigates to whatever page its slot shows. */
  function createPagerSlot(isGap: boolean): HTMLElement {
    if (isGap) {
      const gap = create('span', CLASSES.pagerGap);
      gap.textContent = '…';
      gap.setAttribute('aria-hidden', 'true');
      return gap;
    }
    const button = createPagerButton(() => {
      const target = pager?.slots.find(candidate => candidate.element === button)?.item;
      if (typeof target === 'number') controller.goTo(target);
    });
    return button;
  }

  function render(): void {
    if (rebuildCards) {
      // A new renderer means new markup: rebuild every card (and the probe).
      rebuildCards = false;
      clearCards();
      removeProbe();
    }
    if (rebuildSkeletons) {
      rebuildSkeletons = false;
      clearSkeletons();
    }
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
    if (options.arrowKeys && !detachNavigation) {
      detachNavigation = attachCardNavigation(viewport, controller).detach;
    } else if (!options.arrowKeys && detachNavigation) {
      detachNavigation();
      detachNavigation = null;
    }
    if (live.textContent !== state.announcement) live.textContent = state.announcement;
  }

  /** Whether the grid was destroyed; warns once, since the app still holds a dead handle. */
  const isDestroyed = (): boolean => {
    if (destroyed && !warnedDestroyed) {
      warnedDestroyed = true;
      console.warn('items-grid: the grid was used after destroy(); the call is ignored.');
    }
    return destroyed;
  };
  const unsubscribe = controller.subscribe(render);
  render();

  /** Wraps a controller action so it does nothing (but warn) after destroy(). */
  const whileMounted =
    <A extends unknown[]>(action: (...args: A) => void) =>
    (...args: A): void => {
      if (!isDestroyed()) action(...args);
    };

  // The handle goes inert after destroy(), so late calls can't reach app callbacks.
  const handle: ItemsGridHandle<T> = {
    goTo: whileMounted(controller.goTo),
    next: whileMounted(controller.next),
    prev: whileMounted(controller.prev),
    first: whileMounted(controller.first),
    last: whileMounted(controller.last),
    refresh: whileMounted(controller.refresh),
    handleKeydown: key => !isDestroyed() && controller.handleKeydown(key),
    getState: controller.getState,
    subscribe: listener => (isDestroyed() ? () => {} : controller.subscribe(listener)),
  };

  return {
    controller: handle,
    update(patch) {
      if (destroyed) throw new Error('items-grid: update() after destroy().');
      // Explicit undefined for a required callback means "keep the current one".
      const next: Partial<MountItemsGridOptions<T>> = { ...patch };
      for (const key of ['getKey', 'renderItem'] as const) {
        if (key in next && next[key] === undefined) delete next[key];
      }
      // Commit the mount's options first, so a render triggered by the controller below
      // already uses the new renderers (the card rebuild happens inside that render).
      const previous = { options, rebuildCards, rebuildSkeletons };
      rebuildCards ||= !!next.renderItem && next.renderItem !== options.renderItem;
      rebuildSkeletons ||= !!next.renderSkeleton && next.renderSkeleton !== options.renderSkeleton;
      options = { ...options, ...next };
      const revision = getOptionsRevision(controller);
      try {
        controller.setOptions(controllerOptions(next));
      } catch (error) {
        // Rejected (the controller kept its options): undo the mount's side as well.
        if (getOptionsRevision(controller) === revision) {
          ({ options, rebuildCards, rebuildSkeletons } = previous);
          throw error;
        }
        // Applied, but app code threw afterwards: keep the update and show it, without
        // letting a failing re-render replace the error the controller chose to surface.
        try {
          if (!destroyed) render();
        } catch (renderError) {
          console.error('items-grid: re-rendering after a failed update threw too.', renderError);
        }
        throw error;
      }
      // A callback triggered by this update may have destroyed the grid.
      if (!destroyed) render();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      unsubscribe();
      stopViewport();
      probe?.stop();
      controller.destroy();
      detachNavigation?.();
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

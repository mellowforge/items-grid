import {
  countPending,
  createSnapshot,
  type FreezeSnapshot,
  resolveFrozenPage,
} from './engine/freeze';
import { computeGeometry } from './engine/layout';
import {
  clampPageIndex,
  getPageCount,
  getPageRange,
  getSkeletonCount,
  reanchor,
} from './engine/paging';
import { DEFAULT_PRESET_NAME, DEFAULT_PRESETS, resolvePreset } from './engine/presets';
import type { GridGeometry, ItemKey, ItemRange, SizePreset, ViewportSize } from './engine/types';

/**
 * Where items come from. `client`: `items` is the whole dataset and the grid slices it.
 * `server`: `items` is the current page and `total` the dataset size; the grid asks for
 * pages through `onPageRequest`.
 */
export type PagingMode = 'client' | 'server';

/**
 * How the current page reacts to data changes. `live`: it always shows the current slice,
 * so cards shift across page boundaries. `stable`: the page keeps its cards until the
 * user navigates, resizes or calls `refresh()`; new items are counted in `pendingCount`.
 */
export type ReflowMode = 'live' | 'stable';

/**
 * Vertical placement of the rows inside the viewport when they don't fill it.
 * Purely visual: it never changes the page size.
 */
export type GridAlign = 'start' | 'center';

/** A page the grid wants in server mode. */
export interface PageRequest {
  /** Zero-based page index. */
  readonly pageIndex: number;
  /** Cards per page; the server should return at most this many items. */
  readonly pageSize: number;
}

/** Facts about the visible page, passed to {@link ItemsGridMessages.page}. */
export interface PageMessageInfo {
  /** Zero-based page index. */
  readonly pageIndex: number;
  readonly pageCount: number;
  /** Zero-based index of the first item on the page. */
  readonly start: number;
  /** Zero-based index one past the last item on the page. */
  readonly end: number;
  readonly total: number;
}

/** Screen-reader announcements. Override them to localize. */
export interface ItemsGridMessages {
  /** Announced after the visible page changes. Default: "Page 2 of 5, items 13–24 of 57". */
  page(info: PageMessageInfo): string;
  /** Announced when stable mode counts new items. Default: "5 new items". */
  newItems(count: number): string;
}

/** Default English announcements. */
export const DEFAULT_MESSAGES: ItemsGridMessages = {
  page: ({ pageIndex, pageCount, start, end, total }) =>
    `Page ${pageIndex + 1} of ${pageCount}, items ${start + 1}–${end} of ${total}`,
  newItems: count => `${count} new ${count === 1 ? 'item' : 'items'}`,
};

/** Options for {@link ItemsGridController}. All but `getKey` are optional. */
export interface ItemsGridOptions<T> {
  /**
   * Stable identity of an item. Keeps card DOM and state across updates, so it must not
   * depend on the item's position.
   */
  getKey: (item: T) => ItemKey;
  /** Client mode: the whole dataset. Server mode: the current page. Default `[]`. */
  items?: readonly T[];
  /** Default `'client'`. */
  mode?: PagingMode;
  /** Server mode: size of the whole dataset. Unknown while `undefined`. */
  total?: number;
  /** Name of the active preset in `presets`. Default `'normal'`. */
  preset?: string;
  /** Available presets. Default {@link DEFAULT_PRESETS}. */
  presets?: Readonly<Record<string, SizePreset>>;
  /**
   * Measure the row height from a rendered sample card instead of using the preset's.
   * The adapter renders a hidden probe of `sampleItem` (or the first item). Default `false`.
   */
  measureRowHeight?: boolean;
  /** The item rendered in the measuring probe; defaults to the first item. */
  sampleItem?: T;
  /** Overrides the preset's `maxColumns`. */
  maxColumns?: number;
  /** Overrides the preset's `maxPageSize`. */
  maxPageSize?: number;
  /** Default `'live'`. */
  reflow?: ReflowMode;
  /** Default `'start'` (leftover height below the last row). */
  align?: GridAlign;
  /** The app is fetching data; adapters render skeletons. Default `false`. */
  loading?: boolean;
  /** Zero-based page shown first. Default `0`. */
  pageIndex?: number;
  /** Server mode: delay before requesting a page after a resize, in ms. Default `150`. */
  requestDebounceMs?: number;
  /** Server mode: called when the grid needs a page the app has not supplied yet. */
  onPageRequest?: (request: PageRequest) => void;
  /** Called whenever the page index changes: navigation, reanchoring or clamping. */
  onPageChange?: (pageIndex: number) => void;
  /**
   * Called with every new state, after subscribers. Lets app chrome outside the grid
   * react to it, e.g. a "5 new items" banner from `pendingCount`.
   */
  onStateChange?: (state: ItemsGridState<T>) => void;
  /** Screen-reader announcements, merged over {@link DEFAULT_MESSAGES}. */
  messages?: Partial<ItemsGridMessages>;
}

/** Everything a view needs to render the current page. Immutable; replaced on change. */
export interface ItemsGridState<T> {
  /** `null` until the viewport has been measured. */
  readonly geometry: GridGeometry | null;
  /** Cards per page; `0` until measured. */
  readonly pageSize: number;
  /** Zero-based current page. */
  readonly pageIndex: number;
  readonly pageCount: number;
  /** Dataset size (server mode: `total`, or the page length while unknown). */
  readonly total: number;
  /** Indexes of the visible items within the dataset. */
  readonly range: ItemRange;
  /** The cards to render on this page, in order. */
  readonly items: readonly T[];
  readonly loading: boolean;
  /** Skeleton cards to render while loading; `0` when not loading or not measured. */
  readonly skeletonCount: number;
  /** No items and not loading: render the empty state. */
  readonly isEmpty: boolean;
  /** `true` in stable mode while the page is frozen. */
  readonly frozen: boolean;
  /** Stable mode: items that arrived since the page was frozen. */
  readonly pendingCount: number;
  readonly canPrev: boolean;
  readonly canNext: boolean;
  readonly align: GridAlign;
  /** The item to render in the hidden measuring probe, when measuring is on. */
  readonly probeItem: T | undefined;
  /** Latest message for an `aria-live="polite"` region; `''` until something changes. */
  readonly announcement: string;
}

type SyncCause = 'options' | 'viewport' | 'measure' | 'navigate' | 'refresh';

const DEFAULT_DEBOUNCE_MS = 150;
const EMPTY: readonly never[] = Object.freeze([]);

const sameGeometry = (a: GridGeometry | null, b: GridGeometry | null): boolean =>
  a === b ||
  (!!a &&
    !!b &&
    a.cols === b.cols &&
    a.rows === b.rows &&
    a.pageSize === b.pageSize &&
    a.rowHeight === b.rowHeight &&
    a.gap === b.gap);

const sameItems = <T>(a: readonly T[], b: readonly T[]): boolean =>
  a === b || (a.length === b.length && a.every((item, index) => item === b[index]));

function sameState<T>(a: ItemsGridState<T>, b: ItemsGridState<T>): boolean {
  for (const key of Object.keys(a) as (keyof ItemsGridState<T>)[]) {
    const left = a[key];
    const right = b[key];
    if (key === 'geometry') {
      if (!sameGeometry(a.geometry, b.geometry)) return false;
    } else if (key === 'items') {
      if (!sameItems(a.items, b.items)) return false;
    } else if (key === 'range') {
      if (a.range.start !== b.range.start || a.range.end !== b.range.end) return false;
    } else if (left !== right) {
      return false;
    }
  }
  return true;
}

/**
 * The framework-agnostic grid model: turns the viewport size, preset and data into the
 * page to render, and owns paging, reanchoring, stable-mode freezing and server page
 * requests. It is plain and non-reactive: adapters push inputs in (`setOptions`,
 * `setViewportSize`, `setMeasuredRowHeight`), `subscribe` to changes and read `getState()`.
 *
 * It touches no DOM, so it is safe to create during server-side rendering.
 */
export class ItemsGridController<T> {
  private _options: ItemsGridOptions<T>;
  private _viewport: ViewportSize | null = null;
  private _measuredRowHeight: number | null = null;
  private _pageIndex: number;
  /** Index of the first item on the page at the last navigation; survives resizes. */
  private _anchorIndex: number | null = null;
  private _snapshot: FreezeSnapshot | null = null;
  private _totalAtSnapshot = 0;
  private _lastRequest: PageRequest | null = null;
  private _requestTimer: ReturnType<typeof setTimeout> | null = null;
  private _announcement = '';
  private _state: ItemsGridState<T>;
  private readonly _listeners = new Set<() => void>();
  /** `false` while the constructor derives the first state, which is never reported. */
  private _ready = false;

  constructor(options: ItemsGridOptions<T>) {
    this._options = { ...options };
    this._pageIndex = Math.max(0, Math.floor(options.pageIndex ?? 0));
    this._state = this._buildInitialState();
    this._sync('options');
    this._ready = true;
  }

  // MARK: - Inputs

  /** Merges new options. A call that changes nothing does not notify. */
  setOptions(options: Partial<ItemsGridOptions<T>>): void {
    const previous = this._options;
    const keys = Object.keys(options) as (keyof ItemsGridOptions<T>)[];
    if (keys.every(key => previous[key] === options[key])) {
      return;
    }
    this._options = { ...previous, ...options };
    if (previous.reflow !== this._options.reflow) {
      this._snapshot = null;
    }
    this._sync('options');
  }

  /** Reports the viewport's content-box size. Adapters wire this to a ResizeObserver. */
  setViewportSize(size: ViewportSize): void {
    this._viewport = { width: size.width, height: size.height };
    this._sync('viewport');
  }

  /** Reports the measured card height, or `null` to fall back to the preset's. */
  setMeasuredRowHeight(height: number | null): void {
    const next = height !== null && Number.isFinite(height) && height > 0 ? height : null;
    if (next === this._measuredRowHeight) {
      return;
    }
    this._measuredRowHeight = next;
    this._sync('measure');
  }

  // MARK: - Navigation

  /** Shows `pageIndex`, clamped to the available pages. Re-freezes a stable page. */
  goTo(pageIndex: number): void {
    const geometry = this._state.geometry;
    if (!geometry) {
      // Not laid out (yet, or hidden): remember the page; it wins over any old anchor.
      this._pageIndex = Math.max(0, Math.floor(pageIndex));
      this._anchorIndex = null;
      return;
    }
    this._pageIndex = clampPageIndex(pageIndex, this._state.pageCount);
    this._anchorIndex = this._pageIndex * geometry.pageSize;
    this._sync('navigate');
  }

  next(): void {
    this.goTo(this._state.pageIndex + 1);
  }

  prev(): void {
    this.goTo(this._state.pageIndex - 1);
  }

  first(): void {
    this.goTo(0);
  }

  last(): void {
    this.goTo(this._state.pageCount - 1);
  }

  /**
   * Stable mode: shows the current data and clears `pendingCount`.
   * Server mode: requests the current page again.
   */
  refresh(): void {
    this._sync('refresh');
  }

  /**
   * Handles paging keys pressed inside the grid: PageDown and PageUp.
   *
   * @returns whether the key was handled, so the adapter can `preventDefault()`.
   */
  handleKeydown(key: string): boolean {
    if (key === 'PageDown') {
      this.next();
      return true;
    }
    if (key === 'PageUp') {
      this.prev();
      return true;
    }
    return false;
  }

  // MARK: - Output

  /** The current render state. The same object is returned until something changes. */
  readonly getState = (): ItemsGridState<T> => this._state;

  /** Calls `listener` after every state change. Returns the unsubscribe function. */
  readonly subscribe = (listener: () => void): (() => void) => {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  };

  /**
   * Cancels a pending page request and drops every listener. The controller stays usable:
   * subscribing again resumes updates, which React StrictMode's remount relies on.
   */
  destroy(): void {
    this._cancelRequest();
    this._listeners.clear();
  }

  // MARK: - Derivation

  private _buildInitialState(): ItemsGridState<T> {
    return {
      geometry: null,
      pageSize: 0,
      pageIndex: this._pageIndex,
      pageCount: 1,
      total: 0,
      range: { start: 0, end: 0 },
      items: EMPTY,
      loading: false,
      skeletonCount: 0,
      isEmpty: false,
      frozen: false,
      pendingCount: 0,
      canPrev: false,
      canNext: false,
      align: 'start',
      probeItem: undefined,
      announcement: '',
    };
  }

  private _sync(cause: SyncCause): void {
    const options = this._options;
    const items = options.items ?? EMPTY;
    const isServer = options.mode === 'server';
    const stable = options.reflow === 'stable';
    const preset = resolvePreset(
      options.presets ?? DEFAULT_PRESETS,
      options.preset ?? DEFAULT_PRESET_NAME
    );
    const measured = options.measureRowHeight ? this._measuredRowHeight : null;
    const previous = this._state;
    const geometry = computeGeometry(this._viewport ?? { width: 0, height: 0 }, preset, {
      rowHeight: measured ?? undefined,
      maxColumns: options.maxColumns,
      maxPageSize: options.maxPageSize,
    });
    const total = Math.max(0, isServer ? (options.total ?? items.length) : items.length);
    const loading = !!options.loading;
    // In server mode an unknown total (before the first response) is not "empty".
    const isEmpty = !loading && total === 0 && (!isServer || options.total !== undefined);

    if (!geometry) {
      this._commit({
        ...previous,
        geometry: null,
        pageSize: 0,
        total,
        items: EMPTY,
        loading,
        skeletonCount: 0,
        isEmpty,
        align: options.align ?? 'start',
        probeItem: options.measureRowHeight ? (options.sampleItem ?? items[0]) : undefined,
      });
      return;
    }

    const { pageSize } = geometry;
    const firstLayout = previous.geometry === null;
    const pageSizeChanged = !firstLayout && previous.pageSize !== pageSize;
    // Server mode before the first response: the total is unknown, so nothing may clamp
    // the page (e.g. right after switching modes), and only known pages are shown.
    const unknownTotal = isServer && options.total === undefined;
    const boundTotal = unknownTotal ? Number.MAX_SAFE_INTEGER : total;
    const pageCount = unknownTotal ? 1 : getPageCount(total, pageSize);
    let pageIndex = this._pageIndex;
    let freeze = cause === 'navigate' || cause === 'refresh' || firstLayout || pageSizeChanged;
    let requestNow = cause === 'navigate' || cause === 'refresh' || firstLayout;

    if (firstLayout) {
      // A grid shown again after being hidden (size 0) keeps its anchor, like a resize.
      pageIndex =
        this._anchorIndex === null
          ? clampPageIndex(pageIndex, getPageCount(boundTotal, pageSize))
          : reanchor(this._anchorIndex, pageSize, boundTotal);
      this._anchorIndex ??= pageIndex * pageSize;
    } else if (pageSizeChanged) {
      const anchor = this._anchorIndex ?? previous.pageIndex * previous.pageSize;
      this._anchorIndex = anchor;
      pageIndex = reanchor(anchor, pageSize, boundTotal);
    } else if (!stable || freeze) {
      const clamped = clampPageIndex(pageIndex, getPageCount(boundTotal, pageSize));
      if (clamped !== pageIndex) {
        pageIndex = clamped;
        requestNow = true;
      }
    }
    if (stable && !this._snapshot) {
      freeze = true;
    }

    // Page contents.
    let pageItems: readonly T[];
    let range: ItemRange;
    if (isServer) {
      if (stable && freeze) {
        this._snapshot = { pageKeys: [], knownKeys: new Set() };
        this._totalAtSnapshot = total;
      }
      pageItems = items.length > pageSize ? items.slice(0, pageSize) : items;
      range = unknownTotal
        ? { start: pageIndex * pageSize, end: pageIndex * pageSize + pageItems.length }
        : getPageRange(pageIndex, pageSize, total);
    } else if (stable) {
      const freezeAt = (index: number): void => {
        this._snapshot = createSnapshot(
          items,
          options.getKey,
          getPageRange(index, pageSize, total)
        );
      };
      if (freeze) {
        freezeAt(pageIndex);
      }
      pageItems = resolveFrozenPage(this._snapshot!, items, options.getKey);
      if (pageItems.length === 0 && total > 0) {
        // Every frozen card is gone: show what is there now instead of an empty page.
        pageIndex = clampPageIndex(pageIndex, pageCount);
        freezeAt(pageIndex);
        pageItems = resolveFrozenPage(this._snapshot!, items, options.getKey);
      }
      const start = pageIndex * pageSize;
      range = { start, end: start + pageItems.length };
    } else {
      range = getPageRange(pageIndex, pageSize, total);
      pageItems = items.slice(range.start, range.end);
    }
    if (!stable) {
      this._snapshot = null;
    }
    this._pageIndex = pageIndex;

    const pendingCount =
      stable && this._snapshot
        ? isServer
          ? Math.max(0, total - this._totalAtSnapshot)
          : countPending(this._snapshot, items, options.getKey)
        : 0;
    const shownPageCount = Math.max(pageCount, pageIndex + 1);

    // Announcements: the page after it moves, then new items when they arrive.
    const messages = { ...DEFAULT_MESSAGES, ...options.messages };
    if (
      !firstLayout &&
      (pageIndex !== previous.pageIndex ||
        range.start !== previous.range.start ||
        range.end !== previous.range.end ||
        cause === 'navigate')
    ) {
      this._announcement = messages.page({
        pageIndex,
        pageCount: shownPageCount,
        start: range.start,
        end: range.end,
        total,
      });
    } else if (pendingCount > previous.pendingCount) {
      this._announcement = messages.newItems(pendingCount);
    }

    this._commit({
      geometry,
      pageSize,
      pageIndex,
      pageCount: shownPageCount,
      total,
      range,
      items: pageItems,
      loading,
      skeletonCount: loading
        ? getSkeletonCount(pageIndex, pageSize, isServer ? options.total : undefined)
        : 0,
      isEmpty,
      frozen: stable && this._snapshot !== null,
      pendingCount,
      canPrev: pageIndex > 0,
      canNext: pageIndex < shownPageCount - 1,
      align: options.align ?? 'start',
      probeItem: options.measureRowHeight ? (options.sampleItem ?? items[0]) : undefined,
      announcement: this._announcement,
    });

    if (isServer) {
      this._request({ pageIndex, pageSize }, requestNow, cause === 'refresh');
    }
    if (!firstLayout && pageIndex !== previous.pageIndex) {
      options.onPageChange?.(pageIndex);
    }
  }

  private _commit(next: ItemsGridState<T>): void {
    if (sameState(this._state, next)) {
      return;
    }
    this._state = next;
    for (const listener of [...this._listeners]) {
      listener();
    }
    if (this._ready) {
      this._options.onStateChange?.(next);
    }
  }

  // MARK: - Server requests

  private _request(request: PageRequest, immediate: boolean, force: boolean): void {
    const last = this._lastRequest;
    const same =
      !!last && last.pageIndex === request.pageIndex && last.pageSize === request.pageSize;
    if (same && !force) {
      if (immediate) {
        this._cancelRequest();
      }
      return;
    }
    if (immediate || force) {
      this._cancelRequest();
      this._emitRequest(request);
      return;
    }
    // Resize-driven: wait until the size settles so a drag-resize sends one request.
    this._cancelRequest();
    this._requestTimer = setTimeout(() => {
      this._requestTimer = null;
      const { pageIndex, pageSize } = this._state;
      const latest = this._lastRequest;
      if (latest && latest.pageIndex === pageIndex && latest.pageSize === pageSize) {
        return;
      }
      this._emitRequest({ pageIndex, pageSize });
    }, this._options.requestDebounceMs ?? DEFAULT_DEBOUNCE_MS);
  }

  private _emitRequest(request: PageRequest): void {
    this._lastRequest = request;
    this._options.onPageRequest?.(request);
  }

  private _cancelRequest(): void {
    if (this._requestTimer !== null) {
      clearTimeout(this._requestTimer);
      this._requestTimer = null;
    }
  }
}

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
 * so cards shift across page boundaries. `stable`: in client mode the page keeps its cards
 * until navigation, a page-size change (resize, preset) or `refresh()`, and new items are
 * counted in `pendingCount`; in server mode the app owns the cards, the page only clamps when
 * it no longer exists, and `pendingCount` is the growth of `total`.
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
  /** Pages known so far (see {@link ItemsGridState.pageCount}). */
  readonly pageCount: number;
  /** Zero-based index of the first item on the page. */
  readonly start: number;
  /** Zero-based index one past the last item on the page. */
  readonly end: number;
  /** Dataset size; only meaningful when `totalKnown`. */
  readonly total: number;
  /** `false` in server mode while `total` is unknown. */
  readonly totalKnown: boolean;
}

/** Screen-reader announcements. Override them to localize. */
export interface ItemsGridMessages {
  /**
   * Announced after the visible page changes. Default: "Page 2 of 5, items 13–24 of 57",
   * or "Page 2, items 13–24" while the server total is unknown.
   */
  readonly page: (info: PageMessageInfo) => string;
  /** Announced when stable mode counts new items. Default: "5 new items". */
  readonly newItems: (count: number) => string;
}

/** Default English announcements. Frozen; pass `messages` to override. */
export const DEFAULT_MESSAGES: Readonly<ItemsGridMessages> = Object.freeze({
  page: ({ pageIndex, pageCount, start, end, total, totalKnown }: PageMessageInfo) =>
    totalKnown
      ? `Page ${pageIndex + 1} of ${pageCount}, items ${start + 1}–${end} of ${total}`
      : `Page ${pageIndex + 1}, items ${start + 1}–${end}`,
  newItems: (count: number) => `${count} new ${count === 1 ? 'item' : 'items'}`,
});

/**
 * Options for {@link ItemsGridController}. All but `getKey` are optional. Invalid values
 * throw an `items-grid:` error and leave the previous options in place.
 */
export interface ItemsGridOptions<T> {
  /**
   * Stable identity of an item. Keeps card DOM and state across updates, so it must not
   * depend on the item's position, and must be unique (also as a string, for React).
   */
  readonly getKey: (item: T) => ItemKey;
  /**
   * Client mode: the whole dataset. Server mode: the current page. Default `[]`.
   * Replace the array to update it; it is compared by identity, never mutated.
   */
  readonly items?: readonly T[];
  /** Default `'client'`. */
  readonly mode?: PagingMode;
  /**
   * Server mode: size of the whole dataset, a non-negative integer. `undefined` (or `null`)
   * means unknown: the page is never clamped, `canNext` is `true` while pages come back
   * full, and `state.totalKnown` is `false`.
   */
  readonly total?: number | null;
  /** Name of the active preset in `presets`. Default `'normal'`. */
  readonly preset?: string;
  /** Available presets. Default {@link DEFAULT_PRESETS}. */
  readonly presets?: Readonly<Record<string, SizePreset>>;
  /**
   * Measure the row height from a hidden probe card (`sampleItem`, or the first item)
   * instead of using the preset's; re-measured whenever the probe resizes. Default `false`.
   */
  readonly measureRowHeight?: boolean;
  /** The item rendered in the measuring probe; defaults to the first item. */
  readonly sampleItem?: T;
  /** Overrides the preset's `maxColumns`; an integer ≥ 1. */
  readonly maxColumns?: number;
  /** Overrides the preset's `maxPageSize`; an integer ≥ 1. */
  readonly maxPageSize?: number;
  /** Default `'live'`. */
  readonly reflow?: ReflowMode;
  /** Default `'start'` (leftover height below the last row). */
  readonly align?: GridAlign;
  /**
   * The app is fetching data; adapters render one skeleton per slot when given a skeleton
   * renderer. In server mode set it in the same tick as `onPageRequest`, or the previous
   * page's cards stay visible under the new page's numbers. Default `false`.
   */
  readonly loading?: boolean;
  /**
   * Zero-based page to show. Read at construction; afterwards a changed value navigates
   * there (like `goTo`), an unchanged one is ignored. Default `0`.
   */
  readonly pageIndex?: number;
  /**
   * Server mode: delay before requesting after a page-size change (resize, preset, measured
   * row height…), in ms, so a drag-resize sends one request. Navigation and `refresh()`
   * request immediately. Default `150`.
   */
  readonly requestDebounceMs?: number;
  /** Server mode: called when the grid needs a page the app has not supplied yet. */
  readonly onPageRequest?: (request: PageRequest) => void;
  /**
   * Called whenever the page index changes: navigation, reanchoring after a resize or
   * re-show, and clamping (including on the first layout).
   */
  readonly onPageChange?: (pageIndex: number) => void;
  /**
   * Called with every new state after subscribers, never for the state the constructor
   * derives. Lets app chrome outside the grid react, e.g. a "5 new items" banner.
   */
  readonly onStateChange?: (state: ItemsGridState<T>) => void;
  /** Screen-reader announcements, merged over {@link DEFAULT_MESSAGES}. */
  readonly messages?: Partial<ItemsGridMessages>;
}

/** Everything a view needs to render the current page. Frozen; replaced on change. */
export interface ItemsGridState<T> {
  /** `null` until the viewport has been measured (and while it is hidden). */
  readonly geometry: GridGeometry | null;
  /** Cards per page; always `geometry?.pageSize ?? 0`. */
  readonly pageSize: number;
  /** Zero-based current page. */
  readonly pageIndex: number;
  /**
   * Pages known so far. With a known total, `ceil(total / pageSize)` (at least the current
   * page + 1); while the server total is unknown, the current page + 1, plus one more when
   * `canNext`.
   */
  readonly pageCount: number;
  /**
   * Dataset size. While the server total is unknown: the items seen so far (`range.end`), or
   * `0` before the grid is measured.
   */
  readonly total: number;
  /** `false` in server mode while `total` is unknown. */
  readonly totalKnown: boolean;
  /** Indexes of the visible items: `range.start` is `pageIndex × pageSize`. */
  readonly range: ItemRange;
  /** The cards to render on this page, in order. */
  readonly items: readonly T[];
  readonly loading: boolean;
  /** Skeleton cards to render while loading; `0` when not loading or not measured. */
  readonly skeletonCount: number;
  /**
   * Render the empty state: not loading and a known total of `0` (in server mode `total: 0`,
   * whatever `items` holds).
   */
  readonly isEmpty: boolean;
  /** `true` in stable mode once the page is frozen (and its total known, in server mode). */
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

/**
 * What apps get from the adapters: navigation and state, without the setters the adapter
 * owns. All members are bound, so `onClick={grid.next}` works.
 */
export interface ItemsGridHandle<T> {
  /** Shows `pageIndex` (clamped to the known pages); re-freezes a stable page. */
  readonly goTo: (pageIndex: number) => void;
  readonly next: () => void;
  readonly prev: () => void;
  readonly first: () => void;
  readonly last: () => void;
  /** Stable mode: shows the current data. Server mode: requests the current page again. */
  readonly refresh: () => void;
  /** Handles PageDown / PageUp; returns whether the key was handled. */
  readonly handleKeydown: (key: string) => boolean;
  readonly getState: () => ItemsGridState<T>;
  readonly subscribe: (listener: () => void) => () => void;
}

type SyncCause = 'options' | 'mode' | 'viewport' | 'measure' | 'navigate' | 'refresh';

const DEFAULT_DEBOUNCE_MS = 150;
/** Effects rounds before the loop gives up on callbacks that keep re-triggering it. */
const MAX_EFFECT_ROUNDS = 100;
const EMPTY: readonly never[] = Object.freeze([]);
const MODES: readonly PagingMode[] = ['client', 'server'];
const REFLOWS: readonly ReflowMode[] = ['live', 'stable'];
const ALIGNS: readonly GridAlign[] = ['start', 'center'];

const describe = (value: unknown): string =>
  typeof value === 'string' ? JSON.stringify(value) : String(value);
const invalid = (name: string, value: unknown): Error =>
  new Error(`items-grid: invalid ${name} (${describe(value)}).`);
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isCount = (value: number): boolean => Number.isInteger(value) && value >= 0;
const isCap = (value: number | undefined): boolean =>
  value === undefined || (Number.isInteger(value) && value >= 1);

/** `null` total means unknown, like `undefined`. */
function normalize<T>(options: ItemsGridOptions<T>): ItemsGridOptions<T> {
  return options.total === null ? { ...options, total: undefined } : options;
}

/** Throws an `items-grid:` error naming the first invalid option. */
function validate<T>(options: ItemsGridOptions<T>): void {
  if (typeof options.getKey !== 'function') throw invalid('getKey', options.getKey);
  if (options.mode !== undefined && !MODES.includes(options.mode)) {
    throw invalid('mode', options.mode);
  }
  if (options.reflow !== undefined && !REFLOWS.includes(options.reflow)) {
    throw invalid('reflow', options.reflow);
  }
  if (options.align !== undefined && !ALIGNS.includes(options.align)) {
    throw invalid('align', options.align);
  }
  if (options.total != null && !isCount(options.total)) throw invalid('total', options.total);
  if (options.pageIndex !== undefined && !(isNumber(options.pageIndex) && options.pageIndex >= 0)) {
    throw invalid('pageIndex', options.pageIndex);
  }
  if (options.items !== undefined && !Array.isArray(options.items)) {
    throw invalid('items', options.items);
  }
  for (const name of ['page', 'newItems'] as const) {
    const message = options.messages?.[name];
    if (message !== undefined && typeof message !== 'function') {
      throw invalid(`messages.${name}`, message);
    }
  }
  if (!isCap(options.maxColumns)) throw invalid('maxColumns', options.maxColumns);
  if (!isCap(options.maxPageSize)) throw invalid('maxPageSize', options.maxPageSize);
  const debounce = options.requestDebounceMs;
  if (debounce !== undefined && !(isNumber(debounce) && debounce >= 0)) {
    throw invalid('requestDebounceMs', debounce);
  }
  resolvePreset(options.presets ?? DEFAULT_PRESETS, options.preset ?? DEFAULT_PRESET_NAME);
}

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
    if (key === 'geometry') {
      if (!sameGeometry(a.geometry, b.geometry)) return false;
    } else if (key === 'items') {
      if (!sameItems(a.items, b.items)) return false;
    } else if (key === 'range') {
      if (a.range.start !== b.range.start || a.range.end !== b.range.end) return false;
    } else if (a[key] !== b[key]) {
      return false;
    }
  }
  return true;
}

const freezeState = <T>(state: ItemsGridState<T>): ItemsGridState<T> => {
  if (state.geometry) Object.freeze(state.geometry);
  Object.freeze(state.range);
  Object.freeze(state.items);
  return Object.freeze(state);
};

/**
 * How many times each controller has accepted new options. Module-private: the vanilla mount
 * reads it (via {@link getOptionsRevision}) to tell a rejected `setOptions` from one that was
 * applied but whose app callbacks then threw.
 */
const optionsRevisions = new WeakMap<object, number>();

/** @internal Number of `setOptions` calls `controller` has accepted. */
export function getOptionsRevision(controller: object): number {
  return optionsRevisions.get(controller) ?? 0;
}

/** An error from app code called during a sync, and where it came from. */
interface Caught {
  readonly source: string;
  readonly error: unknown;
}

/** Errors collected during a sync; the first is rethrown, the rest are logged. */
interface Failure {
  readonly errors: readonly Caught[];
}

function rethrow(failure: Failure | null): void {
  if (!failure) return;
  const [first, ...rest] = failure.errors;
  for (const { source, error } of rest) {
    console.error(
      `items-grid: ${source} threw during an update; the first error was rethrown.`,
      error
    );
  }
  throw first!.error;
}

/** How soon the page request a sync asks for must go out. */
interface OwedRequest {
  readonly immediate: boolean;
  readonly force: boolean;
}

/**
 * The framework-agnostic grid model: turns the viewport size, preset and data into the
 * page to render, and owns paging, reanchoring, stable-mode freezing and server page
 * requests. It is plain and non-reactive: adapters push inputs in (`setOptions`,
 * `setViewportSize`, `setMeasuredRowHeight`), `subscribe` to changes and read `getState()`.
 * Apps get the narrower {@link ItemsGridHandle} from the adapters.
 *
 * It touches no DOM, so it is safe to create during server-side rendering.
 */
export class ItemsGridController<T> implements ItemsGridHandle<T> {
  private _options: ItemsGridOptions<T>;
  private _viewport: ViewportSize | null = null;
  private _measuredRowHeight: number | null = null;
  private _pageIndex: number;
  /** Index of the first item on the page at the last navigation; survives resizes. */
  private _anchorIndex: number | null = null;
  /** Client stable mode: the frozen page. */
  private _snapshot: FreezeSnapshot | null = null;
  /** Server stable mode: the known total when the page was frozen. */
  private _baselineTotal: number | null = null;
  private _lastRequest: PageRequest | null = null;
  private _requestTimer: ReturnType<typeof setTimeout> | null = null;
  private _announcement = '';
  private _state: ItemsGridState<T>;
  private readonly _listeners = new Set<() => void>();
  private readonly _warnedKeys = new Set<string>();
  /** `false` while the constructor derives the first state, which is never reported. */
  private _ready = false;
  /** Syncs in progress; effects run only when the outermost one finishes. */
  private _depth = 0;
  /** The page request the syncs since the last effects run asked for, if any. */
  private _owedRequest: OwedRequest | null = null;
  /** Bumped by `destroy()`, so a notification loop stops once a subscriber destroys the grid. */
  private _epoch = 0;
  /** The page index last reported through `onPageChange` (or the initial one). */
  private _reportedPageIndex: number;

  /** @throws an `items-grid:` error for invalid options. */
  constructor(options: ItemsGridOptions<T>) {
    const normalized = normalize({ ...options });
    validate(normalized);
    this._options = normalized;
    this._pageIndex = Math.floor(normalized.pageIndex ?? 0);
    this._state = freezeState(this._unmeasuredState(0, true, false, false));
    this._reportedPageIndex = this._pageIndex;
    rethrow(this._sync('options'));
    this._reportedPageIndex = this._state.pageIndex;
    this._ready = true;
  }

  // MARK: - Inputs

  /**
   * Merges new options. A call that changes nothing does not notify. An explicit
   * `undefined` for `getKey` is ignored.
   *
   * @throws an `items-grid:` error for invalid options; the previous options stay in place.
   */
  setOptions(options: Partial<ItemsGridOptions<T>>): void {
    const previous = this._options;
    const { getKey, ...rest } = options;
    const patch: Partial<ItemsGridOptions<T>> = getKey === undefined ? rest : options;
    const keys = Object.keys(patch) as (keyof ItemsGridOptions<T>)[];
    if (keys.every(key => previous[key] === patch[key])) {
      return;
    }
    const next = normalize({ ...previous, ...patch });
    validate(next);

    // Everything below is undone if deriving the new state throws (e.g. a throwing getKey).
    const saved = {
      snapshot: this._snapshot,
      baselineTotal: this._baselineTotal,
      lastRequest: this._lastRequest,
      pageIndex: this._pageIndex,
      anchorIndex: this._anchorIndex,
    };
    this._options = next;
    const modeChanged = (previous.mode ?? 'client') !== (next.mode ?? 'client');
    if (modeChanged) {
      // A new data source: forget the last request (the 'mode' sync requests or cancels).
      this._lastRequest = null;
    }
    if (modeChanged || previous.reflow !== next.reflow) {
      this._snapshot = null;
      this._baselineTotal = null;
    }
    // A changed pageIndex navigates in the same sync (one request, one report).
    const navigated =
      next.pageIndex !== undefined &&
      next.pageIndex !== previous.pageIndex &&
      Math.floor(next.pageIndex) !== this._state.pageIndex;
    if (navigated) {
      this._pageIndex = Math.floor(next.pageIndex!);
      if (!this._state.geometry) this._anchorIndex = null;
    }

    let failure: Failure | null;
    try {
      failure = this._sync(modeChanged ? 'mode' : navigated ? 'navigate' : 'options', navigated);
    } catch (error) {
      this._options = previous;
      this._snapshot = saved.snapshot;
      this._baselineTotal = saved.baselineTotal;
      this._lastRequest = saved.lastRequest;
      this._pageIndex = saved.pageIndex;
      this._anchorIndex = saved.anchorIndex;
      throw error;
    }
    optionsRevisions.set(this, getOptionsRevision(this) + 1);
    rethrow(failure);
  }

  /** Reports the viewport's content-box size. Adapters wire this to a ResizeObserver. */
  setViewportSize(size: ViewportSize): void {
    this._viewport = { width: size.width, height: size.height };
    rethrow(this._sync('viewport'));
  }

  /** Reports the measured card height, or `null` to fall back to the preset's. */
  setMeasuredRowHeight(height: number | null): void {
    const next = height !== null && Number.isFinite(height) && height > 0 ? height : null;
    if (next === this._measuredRowHeight) {
      return;
    }
    this._measuredRowHeight = next;
    rethrow(this._sync('measure'));
  }

  // MARK: - Navigation (bound, so they can be passed around)

  /**
   * Shows `pageIndex`, clamped to the known pages (not clamped forward while the server
   * total is unknown). Re-freezes a stable page. Before the grid is measured (or while it is
   * hidden) the page is remembered and applied at the next layout.
   *
   * @throws an `items-grid:` error for a non-finite `pageIndex`.
   */
  readonly goTo = (pageIndex: number): void => {
    if (!Number.isFinite(pageIndex)) throw invalid('pageIndex', pageIndex);
    this._pageIndex = Math.max(0, Math.floor(pageIndex));
    if (!this._state.geometry) {
      // The explicit page wins over the anchor of an earlier layout.
      this._anchorIndex = null;
    }
    rethrow(this._sync('navigate'));
  };

  readonly next = (): void => {
    if (this._state.canNext) this.goTo(this._state.pageIndex + 1);
  };

  readonly prev = (): void => {
    if (this._state.canPrev) this.goTo(this._state.pageIndex - 1);
  };

  readonly first = (): void => {
    this.goTo(0);
  };

  readonly last = (): void => {
    this.goTo(this._state.pageCount - 1);
  };

  /**
   * Stable mode: shows the current data and clears `pendingCount`.
   * Server mode: requests the current page again (also the way to retry a failed fetch).
   */
  readonly refresh = (): void => {
    rethrow(this._sync('refresh'));
  };

  /**
   * Handles paging keys pressed inside the grid: PageDown and PageUp.
   *
   * @returns whether it is a paging key (also at the first / last page), so the adapter can
   * `preventDefault()` the browser's own scrolling.
   */
  readonly handleKeydown = (key: string): boolean => {
    if (key === 'PageDown') {
      this.next();
      return true;
    }
    if (key === 'PageUp') {
      this.prev();
      return true;
    }
    return false;
  };

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
   * Cancels a pending page request, forgets the last one and drops every listener. The
   * controller stays usable: subscribing again resumes updates (React StrictMode remounts
   * rely on it), and the next layout requests its page again (debounced, unless it is the
   * first layout).
   */
  destroy(): void {
    this._cancelRequest();
    this._lastRequest = null;
    // Nothing owed survives: a sync that a subscriber destroyed runs no effects.
    this._owedRequest = null;
    this._reportedPageIndex = this._state.pageIndex;
    this._epoch++;
    this._listeners.clear();
  }

  // MARK: - Derivation

  private _unmeasuredState(
    total: number,
    totalKnown: boolean,
    loading: boolean,
    isEmpty: boolean
  ): ItemsGridState<T> {
    const options = this._options;
    return {
      geometry: null,
      pageSize: 0,
      pageIndex: this._pageIndex,
      // Nothing is paged yet, but the remembered page must stay addressable (e.g. by last()).
      pageCount: this._pageIndex + 1,
      total,
      totalKnown,
      range: { start: 0, end: 0 },
      items: EMPTY,
      loading,
      skeletonCount: 0,
      isEmpty,
      frozen: false,
      pendingCount: 0,
      canPrev: false,
      canNext: false,
      align: options.align ?? 'start',
      probeItem: options.measureRowHeight ? (options.sampleItem ?? options.items?.[0]) : undefined,
      announcement: this._announcement,
    };
  }

  /**
   * Derives and commits the state for `cause`. Throws only before committing; errors from
   * subscribers and callbacks are collected and returned for the caller to rethrow.
   */
  private _sync(cause: SyncCause, navigated = false): Failure | null {
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
    const totalKnown = !isServer || options.total != null;
    const knownTotal = isServer ? (options.total ?? 0) : items.length;
    const loading = !!options.loading;
    // An unknown server total (e.g. before the first response) is not "empty".
    const isEmpty = !loading && totalKnown && knownTotal === 0;

    if (!geometry) {
      // Not laid out (yet, or hidden): nothing is paged and nothing may be requested.
      return this._finish(
        freezeState(
          this._unmeasuredState(totalKnown ? knownTotal : 0, totalKnown, loading, isEmpty)
        ),
        { immediate: false, force: false }
      );
    }

    const { pageSize } = geometry;
    const firstLayout = previous.geometry === null;
    const pageSizeChanged = !firstLayout && previous.pageSize !== pageSize;
    // While the server total is unknown nothing may clamp the page.
    const boundTotal = totalKnown ? knownTotal : Number.MAX_SAFE_INTEGER;
    const boundPageCount = getPageCount(boundTotal, pageSize);
    let pageIndex = this._pageIndex;
    let freeze =
      cause === 'navigate' ||
      cause === 'refresh' ||
      cause === 'mode' ||
      firstLayout ||
      pageSizeChanged;
    let requestNow = cause === 'navigate' || cause === 'refresh' || cause === 'mode' || firstLayout;

    if (firstLayout) {
      // A grid shown again after being hidden keeps its anchor, like a resize.
      pageIndex =
        this._anchorIndex === null
          ? clampPageIndex(pageIndex, boundPageCount)
          : reanchor(this._anchorIndex, pageSize, boundTotal);
    } else if (pageSizeChanged) {
      const anchor = this._anchorIndex ?? previous.pageIndex * previous.pageSize;
      this._anchorIndex = anchor;
      pageIndex = reanchor(anchor, pageSize, boundTotal);
    } else if (!stable || freeze || (isServer && totalKnown && pageIndex >= boundPageCount)) {
      // Stable pages hold still, except a server page that no longer exists at all.
      const clamped = clampPageIndex(pageIndex, boundPageCount);
      if (clamped !== pageIndex) {
        pageIndex = clamped;
        requestNow = true;
        // A stable page that had to move shows (and counts from) the current data.
        freeze = true;
      }
    }
    if (firstLayout || cause === 'navigate' || navigated) {
      this._anchorIndex =
        firstLayout && this._anchorIndex !== null ? this._anchorIndex : pageIndex * pageSize;
    }

    // Page contents.
    let pageItems: readonly T[];
    let range: ItemRange;
    let pendingCount = 0;
    let frozen = false;
    if (isServer) {
      pageItems = items.slice(0, pageSize);
      const start = pageIndex * pageSize;
      range = totalKnown
        ? getPageRange(pageIndex, pageSize, knownTotal)
        : { start, end: start + pageItems.length };
      if (stable) {
        // The baseline is the known total when the page froze, taken once the total is known;
        // a brief unknown total (e.g. while refetching) keeps it.
        if (freeze && !totalKnown) {
          this._baselineTotal = null;
        } else if (totalKnown && (freeze || this._baselineTotal === null)) {
          this._baselineTotal = knownTotal;
        }
        frozen = totalKnown && this._baselineTotal !== null;
        pendingCount = frozen ? Math.max(0, knownTotal - this._baselineTotal!) : 0;
      }
    } else if (stable) {
      const freezeAt = (index: number): void => {
        this._snapshot = createSnapshot(
          items,
          options.getKey,
          getPageRange(index, pageSize, knownTotal)
        );
      };
      if (freeze || !this._snapshot) {
        freezeAt(pageIndex);
      }
      pageItems = resolveFrozenPage(this._snapshot!, items, options.getKey);
      if (pageItems.length === 0 && knownTotal > 0) {
        // Every frozen card is gone: show what is there now instead of an empty page.
        pageIndex = clampPageIndex(pageIndex, boundPageCount);
        freezeAt(pageIndex);
        pageItems = resolveFrozenPage(this._snapshot!, items, options.getKey);
      }
      const start = pageIndex * pageSize;
      range = { start, end: start + pageItems.length };
      frozen = true;
      pendingCount = countPending(this._snapshot!, items, options.getKey);
    } else {
      range = getPageRange(pageIndex, pageSize, knownTotal);
      pageItems = items.slice(range.start, range.end);
    }
    if (!stable) {
      this._snapshot = null;
      this._baselineTotal = null;
    }
    this._pageIndex = pageIndex;
    this._warnDuplicates(pageItems);

    const total = totalKnown ? knownTotal : range.end;
    let pageCount: number;
    let canNext: boolean;
    if (totalKnown) {
      pageCount = Math.max(getPageCount(knownTotal, pageSize), pageIndex + 1);
      canNext = pageIndex < pageCount - 1;
    } else {
      // Unknown total: a full page suggests there is more.
      canNext = pageItems.length >= pageSize;
      pageCount = pageIndex + (canNext ? 2 : 1);
    }

    // Announcements: the page after it moves, then new items when they arrive.
    if (
      !firstLayout &&
      (pageIndex !== previous.pageIndex ||
        range.start !== previous.range.start ||
        range.end !== previous.range.end ||
        cause === 'navigate')
    ) {
      const page = options.messages?.page ?? DEFAULT_MESSAGES.page;
      this._announcement = page({
        pageIndex,
        pageCount,
        start: range.start,
        end: range.end,
        total,
        totalKnown,
      });
    } else if (pendingCount > previous.pendingCount) {
      const newItems = options.messages?.newItems ?? DEFAULT_MESSAGES.newItems;
      this._announcement = newItems(pendingCount);
    }

    return this._finish(
      freezeState({
        geometry,
        pageSize,
        pageIndex,
        pageCount,
        total,
        totalKnown,
        range,
        items: pageItems,
        loading,
        skeletonCount: loading
          ? getSkeletonCount(pageIndex, pageSize, totalKnown && isServer ? knownTotal : undefined)
          : 0,
        isEmpty,
        frozen,
        pendingCount,
        canPrev: pageIndex > 0,
        canNext,
        align: options.align ?? 'start',
        probeItem: options.measureRowHeight ? (options.sampleItem ?? items[0]) : undefined,
        announcement: this._announcement,
      }),
      { immediate: requestNow, force: cause === 'refresh' }
    );
  }

  /**
   * Commits the state and notifies, then — once the outermost sync is done — runs the side
   * effects from the controller's own bookkeeping: the page request the syncs asked for, and
   * an `onPageChange` when the page differs from the last one reported. So a subscriber that
   * syncs again (navigates, starts loading, destroys the grid) can neither drop nor reorder
   * them. Effects run even when a subscriber throws; every error is collected and returned.
   */
  private _finish(next: ItemsGridState<T>, request: OwedRequest): Failure | null {
    const errors: Caught[] = [];
    const attempt = (source: string, run: () => void): void => {
      try {
        run();
      } catch (error) {
        errors.push({ source, error });
      }
    };
    const owed = this._owedRequest;
    this._owedRequest = {
      immediate: request.immediate || !!owed?.immediate,
      force: request.force || !!owed?.force,
    };
    this._depth++;
    try {
      if (!sameState(this._state, next)) {
        this._state = next;
        const epoch = this._epoch;
        for (const listener of [...this._listeners]) {
          if (epoch !== this._epoch) break; // destroyed by an earlier subscriber
          attempt('a subscriber', listener);
        }
        if (this._ready && epoch === this._epoch) {
          attempt('onStateChange', () => this._options.onStateChange?.(next));
        }
      }
      if (this._depth === 1) {
        this._runEffects(attempt);
      }
    } finally {
      this._depth--;
    }
    return errors.length ? { errors } : null;
  }

  /**
   * Delivers what the syncs owe, from the current state, until nothing is owed: callbacks
   * may sync again (e.g. `onPageRequest` navigating or switching mode), and while effects run
   * the depth stays raised, so those nested syncs leave their effects to this loop — which
   * keeps request-before-report order, reports only the final page, and returns every error
   * to the call that started it.
   */
  private _runEffects(attempt: (source: string, run: () => void) => void): void {
    const unreported = (): boolean =>
      this._ready && this._state.pageIndex !== this._reportedPageIndex;
    let rounds = 0;
    while (this._owedRequest || unreported()) {
      if (++rounds > MAX_EFFECT_ROUNDS) {
        // A callback keeps navigating or refreshing (e.g. onPageRequest calling refresh()).
        // Settle on the current state and fail loudly instead of hanging the page.
        this._owedRequest = null;
        this._reportedPageIndex = this._state.pageIndex;
        attempt('the effects loop', () => {
          throw new Error(
            `items-grid: effects did not settle after ${MAX_EFFECT_ROUNDS} rounds; ` +
              'onPageRequest or onPageChange keeps navigating or refreshing.'
          );
        });
        return;
      }
      const owed = this._owedRequest;
      if (owed) {
        this._owedRequest = null;
        const state = this._state;
        if (this._options.mode === 'server' && state.geometry) {
          attempt('onPageRequest', () =>
            this._request(
              { pageIndex: state.pageIndex, pageSize: state.pageSize },
              owed.immediate,
              owed.force
            )
          );
        } else {
          this._cancelRequest();
        }
        continue;
      }
      const pageIndex = this._state.pageIndex;
      this._reportedPageIndex = pageIndex;
      attempt('onPageChange', () => this._options.onPageChange?.(pageIndex));
    }
  }

  private _warnDuplicates(items: readonly T[]): void {
    // Compared as strings: React keys (and many DOM ids) collapse 1 and '1'.
    const seen = new Set<string>();
    for (const item of items) {
      const key = String(this._options.getKey(item));
      if (seen.has(key) && !this._warnedKeys.has(key)) {
        this._warnedKeys.add(key);
        console.warn(
          `items-grid: getKey returned the duplicate key "${key}"; cards with the same ` +
            'key replace each other. Keys must be unique.'
        );
      }
      seen.add(key);
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
    // Page-size change: wait until the size settles so a drag-resize sends one request.
    this._cancelRequest();
    this._requestTimer = setTimeout(() => {
      this._requestTimer = null;
      try {
        this._debouncedRequest();
      } catch (error) {
        // Nobody can catch a timer's error: report it with context instead.
        console.error('items-grid: a debounced page request failed.', error);
      }
    }, this._options.requestDebounceMs ?? DEFAULT_DEBOUNCE_MS);
  }

  private _debouncedRequest(): void {
    const { pageIndex, pageSize } = this._state;
    const latest = this._lastRequest;
    if (
      this._options.mode !== 'server' ||
      pageSize <= 0 ||
      (latest && latest.pageIndex === pageIndex && latest.pageSize === pageSize)
    ) {
      return;
    }
    this._emitRequest({ pageIndex, pageSize });
  }

  private _emitRequest(request: PageRequest): void {
    const previous = this._lastRequest;
    this._lastRequest = request;
    try {
      this._options.onPageRequest?.(request);
    } catch (error) {
      // Not sent after all: asking for the same page again must retry it.
      if (this._lastRequest === request) this._lastRequest = previous;
      throw error;
    }
  }

  private _cancelRequest(): void {
    if (this._requestTimer !== null) {
      clearTimeout(this._requestTimer);
      this._requestTimer = null;
    }
  }
}

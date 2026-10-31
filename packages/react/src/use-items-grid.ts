import {
  DEFAULT_MESSAGES,
  ItemsGridController,
  type ItemsGridHandle,
  type ItemsGridOptions,
  type ItemsGridState,
  observeSize,
} from '@mellowforge/items-grid-core';
import {
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

/**
 * `useLayoutEffect` in the browser, `useEffect` on the server: neither runs there, but React 18
 * warns about every layout effect it renders on the server (e.g. Next.js client components).
 */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** What {@link useItemsGrid} returns. */
export interface UseItemsGridResult<T> {
  /** Navigation (`next()`, `goTo()`…), `refresh()` and state; the hook owns the inputs. */
  readonly controller: ItemsGridHandle<T>;
  /** The current render state; the component re-renders when it changes. */
  readonly state: ItemsGridState<T>;
  /**
   * Attach to the grid viewport on the first render (it is observed once per grid). Apply
   * `getViewportStyle(state)` to it inline; its height must come from the host.
   */
  readonly viewportRef: RefObject<HTMLDivElement | null>;
  /** Attach to the hidden probe card when `measureRowHeight` is on. */
  readonly probeRef: RefObject<HTMLDivElement | null>;
}

/**
 * The headless grid: creates one controller for the component's lifetime, pushes option
 * changes into it, observes the viewport (and the probe) and re-renders on state changes.
 *
 * Callbacks (`getKey`, `onPageRequest`, `onPageChange`, `onStateChange`, `messages`) are read from a
 * latest-value ref, so inline arrows are free: a new identity never re-syncs the grid.
 */
export function useItemsGrid<T>(options: ItemsGridOptions<T>): UseItemsGridResult<T> {
  const latest = useRef(options);
  useIsomorphicLayoutEffect(() => {
    latest.current = options;
  });

  const [controller] = useState(() => new ItemsGridController<T>(options));
  useIsomorphicLayoutEffect(() => {
    controller.setOptions({
      getKey: item => latest.current.getKey(item),
      onPageRequest: request => latest.current.onPageRequest?.(request),
      onPageChange: pageIndex => latest.current.onPageChange?.(pageIndex),
      onStateChange: state => latest.current.onStateChange?.(state),
      messages: {
        page: info => (latest.current.messages?.page ?? DEFAULT_MESSAGES.page)(info),
        newItems: count => (latest.current.messages?.newItems ?? DEFAULT_MESSAGES.newItems)(count),
      },
    });
  }, [controller]);

  const {
    items,
    mode,
    total,
    preset,
    presets,
    measureRowHeight,
    sampleItem,
    maxColumns,
    maxPageSize,
    reflow,
    align,
    loading,
    pageIndex,
    requestDebounceMs,
  } = options;
  useIsomorphicLayoutEffect(() => {
    controller.setOptions({
      items,
      mode,
      total,
      preset,
      presets,
      measureRowHeight,
      sampleItem,
      maxColumns,
      maxPageSize,
      reflow,
      align,
      loading,
      pageIndex,
      requestDebounceMs,
    });
  }, [
    controller,
    items,
    mode,
    total,
    preset,
    presets,
    measureRowHeight,
    sampleItem,
    maxColumns,
    maxPageSize,
    reflow,
    align,
    loading,
    pageIndex,
    requestDebounceMs,
  ]);

  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getState,
    controller.getState
  );

  const viewportRef = useRef<HTMLDivElement | null>(null);
  useIsomorphicLayoutEffect(() => {
    const viewport = viewportRef.current;
    return viewport ? observeSize(viewport, size => controller.setViewportSize(size)) : undefined;
  }, [controller]);

  const probeRef = useRef<HTMLDivElement | null>(null);
  const hasProbe = state.probeItem !== undefined;
  useIsomorphicLayoutEffect(() => {
    const probe = probeRef.current;
    if (!hasProbe || !probe) {
      return undefined;
    }
    return observeSize(probe, size => controller.setMeasuredRowHeight(size.height), {
      box: 'border',
    });
  }, [controller, hasProbe]);

  // Cancels a pending debounced request; StrictMode's remount resubscribes cleanly.
  useEffect(() => () => controller.destroy(), [controller]);

  return { controller, state, viewportRef, probeRef };
}

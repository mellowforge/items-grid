import type { ViewportSize } from '../engine/types';

/** Options for {@link observeSize}. */
export interface ObserveSizeOptions {
  /**
   * `content` (default) measures the content box — the space available to the grid
   * tracks. `border` measures the border box — the full height a card occupies.
   */
  readonly box?: 'content' | 'border';
}

let warnedUnavailable = false;

/**
 * Watches an element's size and reports it at most once per animation frame, with the
 * latest value, so a drag-resize does at most one layout per frame.
 *
 * @returns teardown that disconnects the observer and drops a pending frame. Where
 * `ResizeObserver` does not exist (SSR, tests without a polyfill) nothing is observed, and
 * in a browser-like environment a one-time warning says so.
 */
export function observeSize(
  element: Element,
  onSize: (size: ViewportSize) => void,
  options: ObserveSizeOptions = {}
): () => void {
  if (typeof ResizeObserver === 'undefined') {
    if (!warnedUnavailable && typeof window !== 'undefined') {
      warnedUnavailable = true;
      console.warn(
        'items-grid: ResizeObserver is unavailable, so the grid cannot measure its viewport and ' +
          'stays empty. Polyfill it (e.g. in jsdom tests).'
      );
    }
    return () => {};
  }
  let latest: ViewportSize | null = null;
  let frame: number | null = null;

  const observer = new ResizeObserver(entries => {
    const entry = entries[entries.length - 1];
    if (!entry) {
      return;
    }
    if (options.box === 'border') {
      // Older Safari has no borderBoxSize; the bounding box is the border box there.
      const border = entry.borderBoxSize?.[0];
      const box = border ? null : entry.target.getBoundingClientRect();
      latest = border
        ? { width: border.inlineSize, height: border.blockSize }
        : { width: box!.width, height: box!.height };
    } else {
      latest = { width: entry.contentRect.width, height: entry.contentRect.height };
    }
    if (frame === null) {
      frame = requestAnimationFrame(() => {
        frame = null;
        if (latest) {
          onSize(latest);
        }
      });
    }
  });
  observer.observe(element, options.box === 'border' ? { box: 'border-box' } : undefined);

  return () => {
    observer.disconnect();
    if (frame !== null) {
      cancelAnimationFrame(frame);
      frame = null;
    }
  };
}

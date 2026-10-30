import type { ViewportSize } from '../engine/types';

/** Options for {@link observeSize}. */
export interface ObserveSizeOptions {
  /**
   * `content` (default) measures the content box — the space available to the grid
   * tracks. `border` measures the border box — the full height a card occupies.
   */
  readonly box?: 'content' | 'border';
}

/**
 * Watches an element's size and reports it at most once per animation frame, with the
 * latest value, so a drag-resize does at most one layout per frame.
 *
 * @returns teardown that disconnects the observer and drops a pending frame. Where
 * `ResizeObserver` does not exist (SSR, very old browsers) nothing is observed.
 */
export function observeSize(
  element: Element,
  onSize: (size: ViewportSize) => void,
  options: ObserveSizeOptions = {}
): () => void {
  if (typeof ResizeObserver === 'undefined') {
    return () => {};
  }
  let latest: ViewportSize | null = null;
  let frame: number | null = null;

  const observer = new ResizeObserver(entries => {
    const entry = entries[entries.length - 1];
    if (!entry) {
      return;
    }
    const border = options.box === 'border' ? entry.borderBoxSize?.[0] : undefined;
    latest = border
      ? { width: border.inlineSize, height: border.blockSize }
      : { width: entry.contentRect.width, height: entry.contentRect.height };
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

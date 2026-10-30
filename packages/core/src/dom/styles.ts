import type { ItemsGridState } from '../controller';

/**
 * Inline style declarations, keyed by CSS property name (kebab-case). Adapters apply them
 * directly, so the layout works without importing any stylesheet.
 */
export type StyleDeclarations = Readonly<Record<string, string>>;

/**
 * Class names every adapter puts on the same elements. They are hooks for the optional
 * stylesheet and for app styling; layout never depends on them.
 */
export const ITEMS_GRID_CLASSES = Object.freeze({
  host: 'qf-items-grid',
  viewport: 'qf-items-grid__viewport',
  cell: 'qf-items-grid__cell',
  /** Modifier added next to `cell` on skeleton slots. */
  skeleton: 'qf-items-grid__cell--skeleton',
  /** Modifier added next to `cell` on the hidden measuring probe. */
  empty: 'qf-items-grid__empty',
  probe: 'qf-items-grid__probe',
  live: 'qf-items-grid__live',
  pager: 'qf-items-grid-pager',
  pagerStatus: 'qf-items-grid-pager__status',
  pagerList: 'qf-items-grid-pager__list',
  pagerButton: 'qf-items-grid-pager__button',
  pagerGap: 'qf-items-grid-pager__gap',
});

/** The host: a flex column, so the viewport takes whatever height the pager leaves. */
export function getHostStyle(): StyleDeclarations {
  return { display: 'flex', 'flex-direction': 'column', 'min-height': '0', 'min-width': '0' };
}

/**
 * The viewport: CSS grid tracks from the geometry. Its height comes from the host, never
 * from its content — otherwise measuring it would feed back into the page size.
 */
export function getViewportStyle(state: ItemsGridState<unknown>): StyleDeclarations {
  const style: Record<string, string> = {
    display: 'grid',
    flex: '1 1 0%',
    'min-height': '0',
    'min-width': '0',
    overflow: 'hidden',
    position: 'relative',
    'align-content': state.align === 'center' ? 'center' : 'start',
  };
  const geometry = state.geometry;
  if (geometry) {
    style['grid-template-columns'] = `repeat(${geometry.cols}, minmax(0, 1fr))`;
    style['grid-auto-rows'] = `${geometry.rowHeight}px`;
    style['gap'] = `${geometry.gap}px`;
  }
  return style;
}

/** A card slot. `min-width: 0` lets long content shrink instead of widening the track. */
export function getCellStyle(): StyleDeclarations {
  return { 'min-width': '0', 'min-height': '0', overflow: 'hidden' };
}

/** The empty-state container: fills the whole viewport, whatever the track layout. */
export function getEmptyStyle(): StyleDeclarations {
  return { position: 'absolute', inset: '0' };
}

/**
 * The hidden measuring probe: one column wide with its natural height, so its border box
 * is the height a card wants at the current column width.
 */
export function getProbeStyle(state: ItemsGridState<unknown>): StyleDeclarations {
  const geometry = state.geometry;
  const width = geometry
    ? `calc((100% - ${(geometry.cols - 1) * geometry.gap}px) / ${geometry.cols})`
    : '100%';
  return {
    position: 'absolute',
    top: '0',
    left: '0',
    width,
    height: 'auto',
    visibility: 'hidden',
    'pointer-events': 'none',
  };
}

/** Hides the live region visually while keeping it readable by screen readers. */
export function getVisuallyHiddenStyle(): StyleDeclarations {
  return {
    position: 'absolute',
    width: '1px',
    height: '1px',
    margin: '-1px',
    padding: '0',
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
    'white-space': 'nowrap',
    border: '0',
  };
}

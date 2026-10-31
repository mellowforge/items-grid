/** Where the focused card sits on the current page, for {@link getCardMove}. */
export interface CardGrid {
  /** The focused card's offset on the page. */
  readonly offset: number;
  /** Cards on the page. */
  readonly count: number;
  /** Columns of the page's grid (`geometry.cols`). */
  readonly cols: number;
  /** Rows of a full page (`geometry.rows`). */
  readonly rows: number;
  /** A previous page exists (`state.canPrev`). */
  readonly canPrev: boolean;
  /** A next page exists (`state.canNext`; with an unknown server total, while pages are full). */
  readonly canNext: boolean;
  /** Right-to-left layout: ArrowLeft moves forward. */
  readonly rtl?: boolean;
}

/**
 * Where a navigation key sends focus: a card on this page, or a card on the neighbouring
 * page (the renderer clamps `offset` to the cards that page actually has).
 */
export type CardMove =
  | { readonly kind: 'card'; readonly offset: number }
  | { readonly kind: 'page'; readonly direction: 'next' | 'prev'; readonly offset: number };

/**
 * The move for an arrow key, Home or End pressed on a focused card; `null` for any other key
 * (or a page without cards). Arrows walk the data as one list: → past the last card goes to
 * the next page's first card, ← before the first to the previous page's last card (the
 * previous page is always full), ↑ / ↓ past the top / bottom row to the same column there.
 * ↓ from a column the shorter last row doesn't reach moves to the last card. Without a
 * previous / next page (`canPrev` / `canNext` false) the key is still handled and focus
 * stays put.
 */
export function getCardMove(key: string, grid: CardGrid): CardMove | null {
  const { offset, count, cols, rows, canPrev, canNext, rtl = false } = grid;
  if (count === 0) return null;
  const stay: CardMove = { kind: 'card', offset };
  const to = (target: number): CardMove => ({ kind: 'card', offset: target });
  const column = offset % cols;

  switch (key) {
    case 'Home':
      return to(0);
    case 'End':
      return to(count - 1);
    case 'ArrowRight':
    case 'ArrowLeft': {
      const forward = (key === 'ArrowRight') !== rtl;
      if (forward) {
        if (offset + 1 < count) return to(offset + 1);
        return canNext ? { kind: 'page', direction: 'next', offset: 0 } : stay;
      }
      if (offset > 0) return to(offset - 1);
      return canPrev ? { kind: 'page', direction: 'prev', offset: cols * rows - 1 } : stay;
    }
    case 'ArrowDown': {
      if (offset + cols < count) return to(offset + cols);
      const lastRow = Math.floor((count - 1) / cols);
      if (Math.floor(offset / cols) < lastRow) return to(count - 1);
      return canNext ? { kind: 'page', direction: 'next', offset: column } : stay;
    }
    case 'ArrowUp':
      if (offset - cols >= 0) return to(offset - cols);
      return canPrev
        ? { kind: 'page', direction: 'prev', offset: (rows - 1) * cols + column }
        : stay;
    default:
      return null;
  }
}

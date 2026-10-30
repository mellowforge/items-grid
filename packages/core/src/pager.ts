import type { ItemRange } from './engine/types';

/** Texts of the optional pager. Override them to localize. */
export interface PagerLabels {
  /** `aria-label` of the pager's navigation landmark. Default "Pagination". */
  readonly navigation: string;
  /** `aria-label` of the previous-page button. Default "Previous page". */
  readonly previous: string;
  /** `aria-label` of the next-page button. Default "Next page". */
  readonly next: string;
  /** `aria-label` of a page button, from its zero-based index. Default "Page 3". */
  readonly page: (pageIndex: number) => string;
  /**
   * Visible status next to the buttons. Default "Items 13–24 of 57", "Items 13–24" while
   * the server total is unknown, or "No items".
   */
  readonly status: (range: ItemRange, total: number, totalKnown: boolean) => string;
}

/** Default English pager texts. Frozen; pass labels to override. */
export const DEFAULT_PAGER_LABELS: Readonly<PagerLabels> = Object.freeze({
  navigation: 'Pagination',
  previous: 'Previous page',
  next: 'Next page',
  page: (pageIndex: number) => `Page ${pageIndex + 1}`,
  status: (range: ItemRange, total: number, totalKnown: boolean) => {
    if (range.end === range.start) return 'No items';
    const shown = `Items ${range.start + 1}–${range.end}`;
    return totalKnown ? `${shown} of ${total}` : shown;
  },
});

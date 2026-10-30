import type { ItemRange } from './engine/types';

/** Texts of the optional pager. Override them to localize. */
export interface PagerLabels {
  /** `aria-label` of the pager's `<nav>`. Default "Pagination". */
  navigation: string;
  /** `aria-label` of the previous-page button. Default "Previous page". */
  previous: string;
  /** `aria-label` of the next-page button. Default "Next page". */
  next: string;
  /** `aria-label` of a page button, from its zero-based index. Default "Page 3". */
  page(pageIndex: number): string;
  /** Visible status next to the buttons. Default "Items 13–24 of 57", or "No items". */
  status(range: ItemRange, total: number): string;
}

/** Default English pager texts. */
export const DEFAULT_PAGER_LABELS: PagerLabels = {
  navigation: 'Pagination',
  previous: 'Previous page',
  next: 'Next page',
  page: pageIndex => `Page ${pageIndex + 1}`,
  status: (range, total) =>
    total === 0 || range.end === range.start
      ? 'No items'
      : `Items ${range.start + 1}–${range.end} of ${total}`,
};

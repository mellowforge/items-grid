import type { ItemRange } from './types';

/** Number of pages for `total` items; at least 1, so an empty grid still has a page 0. */
export function getPageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)));
}

/** Clamps a page index into `[0, pageCount - 1]`. */
export function clampPageIndex(pageIndex: number, pageCount: number): number {
  return Math.min(Math.max(0, Math.floor(pageIndex)), Math.max(0, pageCount - 1));
}

/** The item range shown on `pageIndex`, cut short at `total` on the last page. */
export function getPageRange(pageIndex: number, pageSize: number, total: number): ItemRange {
  const start = Math.min(pageIndex * pageSize, Math.max(0, total));
  return { start, end: Math.min(start + pageSize, Math.max(0, total)) };
}

/**
 * The page that shows item `anchorIndex` at the new page size, clamped to the last page.
 * Used after a resize or preset change, so the card that was first on screen stays visible.
 */
export function reanchor(anchorIndex: number, pageSize: number, total: number): number {
  const page = Math.floor(Math.max(0, anchorIndex) / Math.max(1, pageSize));
  return clampPageIndex(page, getPageCount(total, pageSize));
}

/**
 * How many skeletons to render while a page loads: the remaining slots when the total is
 * known (a partial last page), otherwise a whole page.
 */
export function getSkeletonCount(
  pageIndex: number,
  pageSize: number,
  total: number | undefined
): number {
  if (total === undefined) {
    return pageSize;
  }
  const range = getPageRange(pageIndex, pageSize, total);
  return range.end - range.start;
}

/** One slot of a pager: a page index, or a collapsed run of pages. */
export type PagerItem = number | 'gap';

const PAGER_SLOTS = 7;

/**
 * Page indexes for a compact pager: always the first and last page, the current page
 * with one neighbour on each side, and `'gap'` for collapsed runs. Returns a constant
 * number of slots once pages overflow, so the pager does not change width while paging.
 */
export function getPagerItems(pageIndex: number, pageCount: number): PagerItem[] {
  if (pageCount <= PAGER_SLOTS) {
    return Array.from({ length: pageCount }, (_, index) => index);
  }
  const last = pageCount - 1;
  if (pageIndex <= 3) {
    return [0, 1, 2, 3, 4, 'gap', last];
  }
  if (pageIndex >= last - 3) {
    return [0, 'gap', last - 4, last - 3, last - 2, last - 1, last];
  }
  return [0, 'gap', pageIndex - 1, pageIndex, pageIndex + 1, 'gap', last];
}

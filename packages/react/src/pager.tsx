import {
  DEFAULT_PAGER_LABELS,
  getPagerItems,
  ITEMS_GRID_CLASSES as CLASSES,
  type ItemsGridController,
  type ItemsGridState,
  type PagerLabels,
} from '@quietfoundry/items-grid-core';
import type { ReactElement } from 'react';

/** Props of {@link ItemsGridPager}. */
export interface ItemsGridPagerProps {
  /** The grid's controller (from a ref on `ItemsGrid`, or from `useItemsGrid`). */
  controller: Pick<ItemsGridController<unknown>, 'goTo' | 'next' | 'prev'>;
  /** The grid's current state. */
  state: ItemsGridState<unknown>;
  /** Texts, merged over the defaults. */
  labels?: Partial<PagerLabels>;
  className?: string;
}

/**
 * The optional pager: status text, previous / next and a compact list of page buttons.
 * Unstyled apart from the `qf-items-grid-pager*` class hooks (see the core stylesheet).
 */
export function ItemsGridPager({
  controller,
  state,
  labels,
  className,
}: ItemsGridPagerProps): ReactElement {
  const text = { ...DEFAULT_PAGER_LABELS, ...labels };
  return (
    <nav
      className={className ? `${CLASSES.pager} ${className}` : CLASSES.pager}
      aria-label={text.navigation}
    >
      <span className={CLASSES.pagerStatus}>
        {state.loading ? '' : text.status(state.range, state.total)}
      </span>
      <div className={CLASSES.pagerList}>
        <button
          type="button"
          className={CLASSES.pagerButton}
          aria-label={text.previous}
          disabled={!state.canPrev}
          onClick={() => controller.prev()}
        >
          ‹
        </button>
        {/* Keyed by slot, so a clicked page button keeps focus after the page changes. */}
        {getPagerItems(state.pageIndex, state.pageCount).map((item, slot) =>
          item === 'gap' ? (
            <span key={slot} className={CLASSES.pagerGap} aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={slot}
              type="button"
              className={CLASSES.pagerButton}
              aria-label={text.page(item)}
              aria-current={item === state.pageIndex ? 'page' : undefined}
              onClick={() => controller.goTo(item)}
            >
              {item + 1}
            </button>
          )
        )}
        <button
          type="button"
          className={CLASSES.pagerButton}
          aria-label={text.next}
          disabled={!state.canNext}
          onClick={() => controller.next()}
        >
          ›
        </button>
      </div>
    </nav>
  );
}

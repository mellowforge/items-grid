import {
  getCellStyle,
  getEmptyStyle,
  getHostStyle,
  getProbeStyle,
  getViewportStyle,
  getVisuallyHiddenStyle,
  ITEMS_GRID_CLASSES as CLASSES,
  type ItemsGridHandle,
  type ItemsGridOptions,
  type ItemsGridState,
  type PagerLabels,
  shouldPageGrid,
} from '@quietfoundry/items-grid-core';
import {
  type CSSProperties,
  type ForwardedRef,
  forwardRef,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
  useImperativeHandle,
} from 'react';

import { ItemsGridPager } from './pager';
import { toReactStyle } from './style';
import { useItemsGrid } from './use-items-grid';

const HOST_STYLE = toReactStyle(getHostStyle());
const CELL_STYLE = toReactStyle(getCellStyle());
const EMPTY_STYLE = toReactStyle(getEmptyStyle());
const LIVE_STYLE = toReactStyle(getVisuallyHiddenStyle());

/** What a custom `pager` render function receives. */
export interface ItemsGridPagerContext<T> {
  readonly state: ItemsGridState<T>;
  readonly controller: ItemsGridHandle<T>;
}

/** Props of {@link ItemsGrid}: the core options plus how to render. */
export interface ItemsGridProps<T> extends ItemsGridOptions<T> {
  /**
   * Renders one card (also the hidden measuring probe, with index `0`). `index` is
   * `range.start` + the card's offset on the page.
   */
  renderItem: (item: T, index: number) => ReactNode;
  /** Renders one skeleton card; rendered once per slot while `loading`. */
  renderSkeleton?: (slot: number) => ReactNode;
  /** Renders the empty state over the whole viewport while `state.isEmpty`. */
  renderEmpty?: () => ReactNode;
  /**
   * `true` (default) renders {@link ItemsGridPager}; `false` renders none; a function
   * renders a custom pager from the grid's state and controller.
   */
  pager?: boolean | ((context: ItemsGridPagerContext<T>) => ReactNode);
  /** Texts of the built-in pager. */
  pagerLabels?: Partial<PagerLabels>;
  /** Accessible name of the card list. */
  'aria-label'?: string;
  /** Extra class on the host element. */
  className?: string;
  /** Extra styles on the host element. Give it a definite height from your layout. */
  style?: CSSProperties;
}

function ItemsGridInner<T>(
  props: ItemsGridProps<T>,
  ref: ForwardedRef<ItemsGridHandle<T>>
): ReactElement {
  const {
    renderItem,
    renderSkeleton,
    renderEmpty,
    pager = true,
    pagerLabels,
    'aria-label': ariaLabel,
    className,
    style,
    ...options
  } = props;
  const { controller, state, viewportRef, probeRef } = useItemsGrid(options);
  useImperativeHandle(ref, () => controller, [controller]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (shouldPageGrid(event.nativeEvent) && controller.handleKeydown(event.key)) {
      event.preventDefault();
    }
  };

  const renderPager = (): ReactNode => {
    if (typeof pager === 'function') return pager({ state, controller });
    if (pager) return <ItemsGridPager controller={controller} state={state} labels={pagerLabels} />;
    return null;
  };

  const showSkeletons = state.loading && !!renderSkeleton;
  return (
    <div
      className={className ? `${CLASSES.host} ${className}` : CLASSES.host}
      style={style ? { ...HOST_STYLE, ...style } : HOST_STYLE}
    >
      <div
        ref={viewportRef}
        className={CLASSES.viewport}
        // The empty state is not a list item, so the viewport is only a list while it has cards.
        role={state.isEmpty ? undefined : 'list'}
        aria-label={ariaLabel}
        aria-busy={state.loading || undefined}
        style={toReactStyle(getViewportStyle(state))}
        onKeyDown={onKeyDown}
      >
        {showSkeletons
          ? Array.from({ length: state.skeletonCount }, (_, slot) => (
              <div
                key={slot}
                className={`${CLASSES.cell} ${CLASSES.skeleton}`}
                style={CELL_STYLE}
                aria-hidden="true"
              >
                {renderSkeleton(slot)}
              </div>
            ))
          : state.items.map((item, offset) => (
              <div
                key={options.getKey(item)}
                className={CLASSES.cell}
                style={CELL_STYLE}
                role="listitem"
              >
                {renderItem(item, state.range.start + offset)}
              </div>
            ))}
        {state.isEmpty && renderEmpty ? (
          <div className={CLASSES.empty} style={EMPTY_STYLE}>
            {renderEmpty()}
          </div>
        ) : null}
        {state.probeItem !== undefined ? (
          <div
            ref={probeRef}
            className={`${CLASSES.cell} ${CLASSES.probe}`}
            style={toReactStyle(getProbeStyle(state))}
            aria-hidden="true"
          >
            {renderItem(state.probeItem, 0)}
          </div>
        ) : null}
      </div>
      {renderPager()}
      <div className={CLASSES.live} style={LIVE_STYLE} aria-live="polite">
        {state.announcement}
      </div>
    </div>
  );
}

/**
 * A card grid that fits its container exactly: the page holds as many full rows and
 * columns as fit, and the rest of the items move to other pages. Give the element a
 * definite height from your layout (e.g. `flex: 1` or `height: 100%`).
 *
 * The `ref` receives an {@link ItemsGridHandle} for imperative navigation and state.
 */
export const ItemsGrid = forwardRef(ItemsGridInner) as <T>(
  props: ItemsGridProps<T> & { ref?: Ref<ItemsGridHandle<T>> }
) => ReactElement;

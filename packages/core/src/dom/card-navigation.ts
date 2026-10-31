import type { ItemsGridHandle } from '../controller';
import { getCardMove } from '../engine/navigation';

type NavigationHandle = Pick<ItemsGridHandle<unknown>, 'getState' | 'next' | 'prev' | 'subscribe'>;

/**
 * Opt-in arrow-key navigation between the cards of a grid viewport (`arrowKeys`). One card
 * at a time is a tab stop (roving `tabindex`); with focus on a card itself, the arrows move
 * between cards — across pages at the edges — and Home / End jump to the first / last card
 * on the page. Keys pressed inside a card's own controls are left to them; Escape there
 * returns focus to the card. When the grid pages from the keyboard (arrows, PageUp /
 * PageDown), focus moves to the card at the same position on the new page once its cards
 * render — unless focus has gone elsewhere by then.
 *
 * Renderer-agnostic: it finds the cards as the viewport's `role="listitem"` children and
 * follows them with a `MutationObserver`, so React, Angular and the vanilla mount share it.
 * Card markup is never touched; only the cells' `tabindex` is set (and removed on detach).
 *
 * @returns a function that detaches it.
 */
export function attachCardNavigation(viewport: HTMLElement, grid: NavigationHandle): () => void {
  /** The tab stop's offset on the page. */
  let active = 0;
  /** Offset to focus once the next page's cards render. */
  let pending: number | null = null;
  /**
   * A PageUp / PageDown pressed in a card, until its event is done: the adapter's own key
   * handler pages (before or after this one, depending on the renderer), and if the page
   * changes meanwhile, focus follows to the same spot.
   */
  let paging: { offset: number; pageIndex: number } | null = null;
  let pagingTimer: ReturnType<typeof setTimeout> | undefined;

  const cards = (): HTMLElement[] =>
    Array.from(viewport.children).filter(
      (child): child is HTMLElement => child.getAttribute('role') === 'listitem'
    );
  const cardOf = (target: EventTarget | null, list: HTMLElement[]): number =>
    target instanceof Node ? list.findIndex(card => card.contains(target)) : -1;

  function syncTabStops(list = cards()): void {
    active = Math.max(0, Math.min(active, list.length - 1));
    list.forEach((card, offset) => card.setAttribute('tabindex', offset === active ? '0' : '-1'));
  }

  function focusCard(list: HTMLElement[], offset: number): void {
    active = Math.min(offset, list.length - 1);
    syncTabStops(list);
    list[active]?.focus();
  }

  function onMutation(): void {
    const list = cards();
    if (pending !== null && list.length > 0) {
      const focus = document.activeElement;
      const free = !focus || focus === document.body || viewport.contains(focus);
      const target = pending;
      pending = null;
      if (free) {
        focusCard(list, target);
        return;
      }
    }
    syncTabStops(list);
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented) return;
    const origin = event.composedPath?.()[0] ?? event.target;
    const list = cards();
    const offset = cardOf(origin, list);
    if (offset < 0) return;
    const state = grid.getState();
    if (origin !== list[offset]) {
      if (event.key === 'Escape') {
        event.preventDefault();
        focusCard(list, offset);
      }
      return;
    }
    if (!state.geometry) return;
    const move = getCardMove(event.key, {
      offset,
      count: list.length,
      cols: state.geometry.cols,
      rows: state.geometry.rows,
      canPrev: state.canPrev,
      canNext: state.canNext,
      rtl: getComputedStyle(viewport).direction === 'rtl',
    });
    if (!move) return;
    event.preventDefault();
    if (move.kind === 'card') {
      focusCard(list, move.offset);
    } else {
      pending = move.offset;
      if (move.direction === 'next') grid.next();
      else grid.prev();
    }
  }

  function onPagingKey(event: KeyboardEvent): void {
    if (event.key !== 'PageDown' && event.key !== 'PageUp') return;
    const offset = cardOf(event.composedPath?.()[0] ?? event.target, cards());
    if (offset < 0) return;
    paging = { offset, pageIndex: grid.getState().pageIndex };
    clearTimeout(pagingTimer);
    pagingTimer = setTimeout(() => (paging = null), 0);
  }

  function onStateChange(): void {
    if (paging && grid.getState().pageIndex !== paging.pageIndex) {
      pending = paging.offset;
      paging = null;
    }
  }

  function onFocusin(event: FocusEvent): void {
    const list = cards();
    const offset = cardOf(event.target, list);
    if (offset >= 0 && offset !== active) {
      active = offset;
      syncTabStops(list);
    }
  }

  function onFocusout(event: FocusEvent): void {
    // Focus leaving for somewhere else on the page cancels a pending move.
    const next = event.relatedTarget;
    if (next instanceof Node && !viewport.contains(next)) pending = null;
  }

  const observer =
    typeof MutationObserver === 'undefined' ? null : new MutationObserver(onMutation);
  observer?.observe(viewport, { childList: true });
  const unsubscribe = grid.subscribe(onStateChange);
  viewport.addEventListener('keydown', onPagingKey, true);
  viewport.addEventListener('keydown', onKeydown);
  viewport.addEventListener('focusin', onFocusin);
  viewport.addEventListener('focusout', onFocusout);
  syncTabStops();

  return () => {
    observer?.disconnect();
    unsubscribe();
    clearTimeout(pagingTimer);
    viewport.removeEventListener('keydown', onPagingKey, true);
    viewport.removeEventListener('keydown', onKeydown);
    viewport.removeEventListener('focusin', onFocusin);
    viewport.removeEventListener('focusout', onFocusout);
    for (const card of cards()) card.removeAttribute('tabindex');
  };
}

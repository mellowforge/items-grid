import type { ItemsGridHandle } from '../controller';
import { getCardMove } from '../engine/navigation';

type NavigationHandle = Pick<ItemsGridHandle<unknown>, 'getState' | 'next' | 'prev'>;

/**
 * Opt-in arrow-key navigation between the cards of a grid viewport (`arrowKeys`). One card
 * at a time is a tab stop (roving `tabindex`); with focus on a card itself, the arrows move
 * between cards — across pages at the edges — and Home / End jump to the first / last card
 * on the page. Keys pressed inside a card's own controls are left to them; Escape there
 * returns focus to the card. When the focused card leaves the DOM — the page changed (PageUp
 * / PageDown, a resize that reanchors) or a realtime update removed it — focus moves to the
 * card now at the same position (in server mode once the page's cards arrive); arrows that
 * cross a page land on the first card or the same column. Focus the user moved elsewhere is
 * never pulled back.
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
  /** Offset to focus once the page's cards render. */
  let pending: number | null = null;
  /**
   * The card holding focus and its offset, until focus really leaves the grid. Browsers fire
   * no focusout when the focused node is removed, so a disconnected `cell` here means the
   * renderer removed it while it had focus.
   */
  let lastFocus: { cell: HTMLElement; offset: number } | null = null;

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
    const focus = document.activeElement;
    const inside = cardOf(focus, list);
    if (inside >= 0) {
      // Insertions and removals around the focused card shift its offset.
      active = inside;
      lastFocus = { cell: list[inside]!, offset: inside };
    } else if (lastFocus && !lastFocus.cell.isConnected) {
      const dropped = !focus || focus === document.body;
      if (pending === null && dropped) pending = lastFocus.offset;
      lastFocus = null;
    }
    if (pending !== null && list.length > 0) {
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

  function onFocusin(event: FocusEvent): void {
    const list = cards();
    const offset = cardOf(event.target, list);
    if (offset < 0) return;
    lastFocus = { cell: list[offset]!, offset };
    if (offset !== active) {
      active = offset;
      syncTabStops(list);
    }
  }

  function onFocusout(event: FocusEvent): void {
    const next = event.relatedTarget;
    if (next instanceof Node && viewport.contains(next)) return;
    const left = (): void => {
      lastFocus = null;
      pending = null;
    };
    // Focus moved somewhere else on the page: forget it. Blurred to nothing: only if the
    // element is still there (a removed one is the renderer's doing, not the user's).
    if (next instanceof Node) left();
    else {
      const target = event.target;
      queueMicrotask(() => {
        if (target instanceof Node && target.isConnected) left();
      });
    }
  }

  const observer =
    typeof MutationObserver === 'undefined' ? null : new MutationObserver(onMutation);
  observer?.observe(viewport, { childList: true });
  viewport.addEventListener('keydown', onKeydown);
  viewport.addEventListener('focusin', onFocusin);
  viewport.addEventListener('focusout', onFocusout);
  syncTabStops();

  return () => {
    observer?.disconnect();
    viewport.removeEventListener('keydown', onKeydown);
    viewport.removeEventListener('focusin', onFocusin);
    viewport.removeEventListener('focusout', onFocusout);
    for (const card of cards()) card.removeAttribute('tabindex');
  };
}

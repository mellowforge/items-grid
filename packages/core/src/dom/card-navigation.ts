import type { ItemsGridHandle } from '../controller';
import { getCardMove } from '../engine/navigation';

/** Options of {@link attachCardNavigation}. */
export interface CardNavigationOptions {
  /**
   * Listen to `keydown` on the viewport (default `true`). Pass `false` when the renderer
   * delegates events and card handlers run after native viewport listeners (React): call
   * {@link CardNavigation.handleKeydown} from the viewport's own key handler instead, so a
   * card control that handles a key (`preventDefault()`) keeps it.
   */
  readonly listenToKeys?: boolean;
}

/** An attached {@link attachCardNavigation}. */
export interface CardNavigation {
  /** Handles a `keydown` that reached the viewport; only needed with `listenToKeys: false`. */
  readonly handleKeydown: (event: KeyboardEvent) => void;
  /** Stops listening and removes the cells' `tabindex`. */
  readonly detach: () => void;
}

const isNode = (value: unknown): value is Node =>
  typeof value === 'object' && value !== null && typeof (value as Node).nodeType === 'number';

/**
 * Opt-in arrow-key navigation between the cards of a grid viewport (`arrowKeys`). One card
 * cell at a time is a tab stop (roving `tabindex`). With focus on a card cell itself, the
 * arrows move between cards and Home / End jump to the first / last card on the page; → past
 * the last card goes to the next page's first card, ← before the first to the previous page's
 * last card, ↑ / ↓ past the top / bottom row to the same column there. Keys with a modifier,
 * keys during IME composition and keys a card control already handled are left alone; Escape
 * in a card's control returns focus to the card.
 *
 * When the focused card leaves the DOM — the page changed (PageUp / PageDown, a resize that
 * reanchors) or a realtime update removed it — focus moves to the card now at the same
 * position (in server mode once the page's cards arrive); a card the renderer only moved
 * keeps focus. Focus the user moved elsewhere is never pulled back.
 *
 * Renderer-agnostic: it finds the cards as the viewport's `role="listitem"` children and
 * follows them with a `MutationObserver`, so React, Angular and the vanilla mount share it.
 * Card markup is never touched; only the cells' `tabindex` is set (and removed on detach).
 */
export function attachCardNavigation(
  viewport: HTMLElement,
  grid: Pick<ItemsGridHandle<unknown>, 'getState' | 'next' | 'prev'>,
  { listenToKeys = true }: CardNavigationOptions = {}
): CardNavigation {
  /** The tab stop's offset on the page. */
  let active = 0;
  /** Offset to focus once the page's cards render. */
  let pending: number | null = null;
  /**
   * The card holding focus and its offset, until focus really leaves the grid. Removing or
   * moving the focused node drops focus to the document: some browsers (Chrome) fire a
   * focusout without `relatedTarget` for it, others none, so the mutation records decide
   * whether the renderer or the user moved focus.
   */
  let lastFocus: { cell: HTMLElement; offset: number } | null = null;
  let detached = false;

  const root = (): Document | ShadowRoot => viewport.getRootNode() as Document | ShadowRoot;
  const focusedElement = (): Element | null => root().activeElement ?? null;
  const isDropped = (focus: Element | null): boolean =>
    !focus || focus === viewport.ownerDocument.body;
  const cards = (): HTMLElement[] =>
    Array.from(viewport.children).filter(
      (child): child is HTMLElement => child.getAttribute('role') === 'listitem'
    );
  const cardOf = (target: unknown, list: HTMLElement[]): number =>
    isNode(target) ? list.findIndex(card => card.contains(target)) : -1;

  function syncTabStops(list = cards()): void {
    active = Math.max(0, Math.min(active, list.length - 1));
    list.forEach((card, offset) => card.setAttribute('tabindex', offset === active ? '0' : '-1'));
  }

  function focusCard(list: HTMLElement[], offset: number): void {
    active = Math.min(offset, list.length - 1);
    syncTabStops(list);
    list[active]?.focus();
  }

  function onMutation(records: readonly MutationRecord[]): void {
    if (detached) return;
    const list = cards();
    const focus = focusedElement();
    const inside = cardOf(focus, list);
    if (inside >= 0) {
      // Insertions and removals around the focused card shift its offset.
      active = inside;
      lastFocus = { cell: list[inside]!, offset: inside };
    } else if (lastFocus) {
      const { cell, offset } = lastFocus;
      const moved = list.indexOf(cell);
      const touched = records.some(record => Array.from(record.removedNodes).includes(cell));
      if (moved >= 0 && touched && isDropped(focus)) {
        // The renderer moved the focused card (removing it blurred it): keep it focused.
        focusCard(list, moved);
        return;
      }
      if (!cell.isConnected) {
        if (pending === null && isDropped(focus)) pending = offset;
        lastFocus = null;
      }
    }
    if (pending !== null && list.length > 0) {
      const free = isDropped(focus) || viewport.contains(focus);
      const target = pending;
      pending = null;
      if (free) {
        focusCard(list, target);
        return;
      }
    }
    syncTabStops(list);
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (detached || event.defaultPrevented || event.isComposing) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const list = cards();
    // `target` is retargeted to the light-DOM host of a control inside a shadow root.
    const offset = cardOf(event.target, list);
    if (offset < 0) return;
    const origin = event.composedPath?.()[0] ?? event.target;
    if (origin !== list[offset]) {
      if (event.key === 'Escape') {
        event.preventDefault();
        focusCard(list, offset);
      }
      return;
    }
    const state = grid.getState();
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
    if (isNode(next) && viewport.contains(next)) return;
    const left = (): void => {
      lastFocus = null;
      pending = null;
    };
    if (isNode(next)) {
      // Focus moved somewhere else on the page.
      left();
      return;
    }
    // Blurred to nothing: the user, or the renderer removing / moving the focused card.
    // Settle pending DOM changes first; then a still-connected target that didn't get focus
    // back means the user left.
    const target = event.target;
    queueMicrotask(() => {
      if (detached) return;
      const records = observer?.takeRecords() ?? [];
      if (records.length > 0) onMutation(records);
      const focus = focusedElement();
      if (isNode(target) && target.isConnected && !(isNode(focus) && viewport.contains(focus))) {
        left();
      }
    });
  }

  const observer =
    typeof MutationObserver === 'undefined' ? null : new MutationObserver(onMutation);
  observer?.observe(viewport, { childList: true });
  if (listenToKeys) viewport.addEventListener('keydown', handleKeydown);
  viewport.addEventListener('focusin', onFocusin);
  viewport.addEventListener('focusout', onFocusout);
  syncTabStops();

  return {
    handleKeydown,
    detach() {
      if (detached) return;
      detached = true;
      observer?.disconnect();
      viewport.removeEventListener('keydown', handleKeydown);
      viewport.removeEventListener('focusin', onFocusin);
      viewport.removeEventListener('focusout', onFocusout);
      for (const card of cards()) card.removeAttribute('tabindex');
    },
  };
}

import { Component, computed, input } from '@angular/core';
import {
  getPagerItems,
  type ItemsGridHandle,
  type ItemsGridState,
  type PagerLabels,
  resolvePagerLabels,
} from '@mellowforge/items-grid-core';

/**
 * The optional pager: status text, previous / next and a compact list of page buttons.
 * Unstyled apart from the `mf-items-grid-pager*` class hooks (see the core stylesheet).
 *
 * `mf-items-grid` renders one by default. To place your own, set `[pager]="false"` and
 * bind this to the grid: `<mf-items-grid-pager [controller]="grid.controller" [state]="grid.state()" />`.
 */
@Component({
  selector: 'mf-items-grid-pager',
  host: {
    class: 'mf-items-grid-pager',
    role: 'navigation',
    '[attr.aria-label]': 'text().navigation',
  },
  template: `
    <span class="mf-items-grid-pager__status">{{
      state().loading || !state().geometry
        ? ''
        : text().status(state().range, state().total, state().totalKnown)
    }}</span>
    <div class="mf-items-grid-pager__list">
      <button
        type="button"
        class="mf-items-grid-pager__button"
        [attr.aria-label]="text().previous"
        [disabled]="!state().canPrev"
        (click)="controller().prev()"
      >
        ‹
      </button>
      <!-- Tracked by slot, so a clicked page button keeps focus after the page changes. -->
      @for (item of items(); track $index) {
        @if (item === 'gap') {
          <span class="mf-items-grid-pager__gap" aria-hidden="true">…</span>
        } @else {
          <button
            type="button"
            class="mf-items-grid-pager__button"
            [attr.aria-label]="text().page(item)"
            [attr.aria-current]="item === state().pageIndex ? 'page' : null"
            (click)="controller().goTo(item)"
          >
            {{ item + 1 }}
          </button>
        }
      }
      <button
        type="button"
        class="mf-items-grid-pager__button"
        [attr.aria-label]="text().next"
        [disabled]="!state().canNext"
        (click)="controller().next()"
      >
        ›
      </button>
    </div>
  `,
})
export class MfItemsGridPager {
  /** The grid's handle: `grid.controller`. */
  readonly controller = input.required<Pick<ItemsGridHandle<unknown>, 'goTo' | 'next' | 'prev'>>();

  /** The grid's current state. */
  readonly state = input.required<ItemsGridState<unknown>>();

  /** Texts, merged over the defaults. */
  readonly labels = input<Partial<PagerLabels>>();

  protected readonly text = computed<PagerLabels>(() => resolvePagerLabels(this.labels()));

  protected readonly items = computed(() =>
    getPagerItems(this.state().pageIndex, this.state().pageCount),
  );
}

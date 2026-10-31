import { Directive, inject, input, TemplateRef } from '@angular/core';
import type { ItemsGridHandle, ItemsGridState } from '@mellowforge/items-grid-core';

/** Template context of `ng-template[mfItemsGridItem]`. */
export interface MfItemsGridItemContext<T> {
  /** The item; `let-item`. */
  $implicit: T;
  item: T;
  /** `range.start` + the card's offset on the page; `0` for the measuring probe. */
  index: number;
}

/** Template context of `ng-template[mfItemsGridPagerTemplate]`. */
export interface MfItemsGridPagerContext<T> {
  /** The grid's render state; `let-state`. */
  $implicit: ItemsGridState<T>;
  state: ItemsGridState<T>;
  /** Navigation (`next()`, `goTo()`, …); `let-grid="controller"`. */
  controller: ItemsGridHandle<T>;
}

/** Template context of `ng-template[mfItemsGridSkeleton]`. */
export interface MfItemsGridSkeletonContext {
  /** Zero-based slot on the page; `let-slot`. */
  $implicit: number;
  slot: number;
}

/**
 * The card template, rendered once per item on the current page.
 *
 * Bind `[mfItemsGridItemOf]` to the grid's items to type `let-item` under strict templates.
 *
 * ```html
 * <mf-items-grid [items]="devices()" [getKey]="byId">
 *   <ng-template mfItemsGridItem [mfItemsGridItemOf]="devices()" let-device>
 *     <app-device-card [device]="device" />
 *   </ng-template>
 * </mf-items-grid>
 * ```
 */
@Directive({
  selector: 'ng-template[mfItemsGridItem]',
})
export class MfItemsGridItem<T> {
  /** Only for typing: the items the grid renders, so `let-item` is a `T`. */
  readonly mfItemsGridItemOf = input<readonly T[] | undefined>(undefined);

  readonly template = inject<TemplateRef<MfItemsGridItemContext<T>>>(TemplateRef);

  static ngTemplateContextGuard<T>(
    _directive: MfItemsGridItem<T>,
    _context: unknown,
  ): _context is MfItemsGridItemContext<T> {
    return true;
  }
}

/** The skeleton card template, rendered once per slot while `loading`. */
@Directive({
  selector: 'ng-template[mfItemsGridSkeleton]',
})
export class MfItemsGridSkeleton {
  readonly template = inject<TemplateRef<MfItemsGridSkeletonContext>>(TemplateRef);

  static ngTemplateContextGuard(
    _directive: MfItemsGridSkeleton,
    _context: unknown,
  ): _context is MfItemsGridSkeletonContext {
    return true;
  }
}

/** The empty-state template, rendered over the whole viewport while `state().isEmpty`. */
@Directive({
  selector: 'ng-template[mfItemsGridEmpty]',
})
export class MfItemsGridEmpty {
  readonly template = inject<TemplateRef<unknown>>(TemplateRef);
}

/**
 * A custom pager, rendered below the cards in place of the built-in `<mf-items-grid-pager>`
 * (`[pager]="false"` still hides it). Like the built-in pager it sits outside the viewport,
 * so the cards fit the space that is left.
 *
 * ```html
 * <mf-items-grid [items]="devices()" [getKey]="byId">
 *   <ng-template mfItemsGridItem let-device>…</ng-template>
 *   <ng-template mfItemsGridPagerTemplate let-state let-grid="controller">
 *     <button type="button" [disabled]="!state.canNext" (click)="grid.next()">More</button>
 *   </ng-template>
 * </mf-items-grid>
 * ```
 */
@Directive({
  selector: 'ng-template[mfItemsGridPagerTemplate]',
})
export class MfItemsGridPagerTemplate {
  readonly template = inject<TemplateRef<MfItemsGridPagerContext<unknown>>>(TemplateRef);

  static ngTemplateContextGuard(
    _directive: MfItemsGridPagerTemplate,
    _context: unknown,
  ): _context is MfItemsGridPagerContext<unknown> {
    return true;
  }
}

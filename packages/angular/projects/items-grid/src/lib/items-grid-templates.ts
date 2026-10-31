import { Directive, inject, input, TemplateRef } from '@angular/core';

/** Template context of `ng-template[qfItemsGridItem]`. */
export interface QfItemsGridItemContext<T> {
  /** The item; `let-item`. */
  $implicit: T;
  item: T;
  /** `range.start` + the card's offset on the page; `0` for the measuring probe. */
  index: number;
}

/** Template context of `ng-template[qfItemsGridSkeleton]`. */
export interface QfItemsGridSkeletonContext {
  /** Zero-based slot on the page; `let-slot`. */
  $implicit: number;
  slot: number;
}

/**
 * The card template, rendered once per item on the current page.
 *
 * Bind `[qfItemsGridItemOf]` to the grid's items to type `let-item` under strict templates.
 *
 * ```html
 * <qf-items-grid [items]="devices()" [getKey]="byId">
 *   <ng-template qfItemsGridItem [qfItemsGridItemOf]="devices()" let-device>
 *     <app-device-card [device]="device" />
 *   </ng-template>
 * </qf-items-grid>
 * ```
 */
@Directive({
  selector: 'ng-template[qfItemsGridItem]',
})
export class QfItemsGridItem<T> {
  /** Only for typing: the items the grid renders, so `let-item` is a `T`. */
  readonly qfItemsGridItemOf = input<readonly T[] | undefined>(undefined);

  readonly template = inject<TemplateRef<QfItemsGridItemContext<T>>>(TemplateRef);

  static ngTemplateContextGuard<T>(
    _directive: QfItemsGridItem<T>,
    _context: unknown,
  ): _context is QfItemsGridItemContext<T> {
    return true;
  }
}

/** The skeleton card template, rendered once per slot while `loading`. */
@Directive({
  selector: 'ng-template[qfItemsGridSkeleton]',
})
export class QfItemsGridSkeleton {
  readonly template = inject<TemplateRef<QfItemsGridSkeletonContext>>(TemplateRef);

  static ngTemplateContextGuard(
    _directive: QfItemsGridSkeleton,
    _context: unknown,
  ): _context is QfItemsGridSkeletonContext {
    return true;
  }
}

/** The empty-state template, rendered over the whole viewport while `state().isEmpty`. */
@Directive({
  selector: 'ng-template[qfItemsGridEmpty]',
})
export class QfItemsGridEmpty {
  readonly template = inject<TemplateRef<unknown>>(TemplateRef);
}

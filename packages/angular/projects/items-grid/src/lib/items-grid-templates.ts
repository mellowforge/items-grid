import { Directive, inject, TemplateRef } from '@angular/core';

/** Template context of `ng-template[qfItemsGridItem]`. */
export interface QfItemsGridItemContext<T> {
  /** The item; `let-item`. */
  $implicit: T;
  item: T;
  /** The item's position in the dataset. */
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
 * ```html
 * <qf-items-grid [items]="devices()" [getKey]="byId">
 *   <ng-template qfItemsGridItem let-device>
 *     <app-device-card [device]="device" />
 *   </ng-template>
 * </qf-items-grid>
 * ```
 */
@Directive({
  selector: 'ng-template[qfItemsGridItem]',
})
export class QfItemsGridItem<T> {
  readonly template = inject<TemplateRef<QfItemsGridItemContext<T>>>(TemplateRef);

  static ngTemplateContextGuard<T>(
    _directive: QfItemsGridItem<T>,
    context: unknown,
  ): context is QfItemsGridItemContext<T> {
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
    context: unknown,
  ): context is QfItemsGridSkeletonContext {
    return true;
  }
}

/** The empty-state template, rendered over the whole viewport when there are no items. */
@Directive({
  selector: 'ng-template[qfItemsGridEmpty]',
})
export class QfItemsGridEmpty {
  readonly template = inject<TemplateRef<unknown>>(TemplateRef);
}

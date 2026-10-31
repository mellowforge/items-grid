import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  contentChild,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import {
  DEFAULT_MESSAGES,
  getCellStyle,
  getEmptyStyle,
  getHostStyle,
  getProbeStyle,
  getViewportStyle,
  getVisuallyHiddenStyle,
  type GridAlign,
  type ItemKey,
  ItemsGridController,
  type ItemsGridHandle,
  type ItemsGridMessages,
  type ItemsGridState,
  observeSize,
  type PageRequest,
  type PagerLabels,
  type PagingMode,
  type ReflowMode,
  shouldPageGrid,
  type SizePreset,
} from '@mellowforge/items-grid-core';

import { MfItemsGridPager } from './items-grid-pager';
import {
  MfItemsGridEmpty,
  MfItemsGridItem,
  MfItemsGridPagerTemplate,
  MfItemsGridSkeleton,
} from './items-grid-templates';

/**
 * A card grid that fits its host exactly: the page holds as many full rows and columns as
 * fit, and the rest of the items move to other pages. Give the host a definite height from
 * your layout (e.g. `flex: 1` or `height: 100%`).
 *
 * ```html
 * <mf-items-grid [items]="devices()" [getKey]="byId" preset="compact">
 *   <ng-template mfItemsGridItem let-device><app-device-card [device]="device" /></ng-template>
 * </mf-items-grid>
 * ```
 */
@Component({
  selector: 'mf-items-grid',
  exportAs: 'mfItemsGrid',
  imports: [NgTemplateOutlet, MfItemsGridPager],
  host: { class: 'mf-items-grid', '[style]': 'hostStyle' },
  template: `
    <!-- PageUp/PageDown bubble up from focused cards; the list itself is not a tab stop. -->
    <!-- eslint-disable-next-line @angular-eslint/template/interactive-supports-focus -->
    <div
      #viewport
      class="mf-items-grid__viewport"
      [attr.role]="state().isEmpty ? null : 'list'"
      [attr.aria-label]="ariaLabel() ?? null"
      [attr.aria-busy]="state().loading ? 'true' : null"
      [style]="viewportStyle()"
      (keydown)="onKeydown($event)"
    >
      @if (state().loading && skeletonDef(); as skeleton) {
        @for (slot of skeletonSlots(); track slot) {
          <div
            class="mf-items-grid__cell mf-items-grid__cell--skeleton"
            [style]="cellStyle"
            aria-hidden="true"
          >
            <ng-container
              [ngTemplateOutlet]="skeleton.template"
              [ngTemplateOutletContext]="{ $implicit: slot, slot }"
            />
          </div>
        }
      } @else {
        @for (item of state().items; track trackKey(item); let offset = $index) {
          <div class="mf-items-grid__cell" [style]="cellStyle" role="listitem">
            <ng-container
              [ngTemplateOutlet]="itemDef()?.template ?? null"
              [ngTemplateOutletContext]="{
                $implicit: item,
                item,
                index: state().range.start + offset,
              }"
            />
          </div>
        }
      }
      @if (state().isEmpty && emptyDef(); as empty) {
        <div class="mf-items-grid__empty" [style]="emptyStyle">
          <ng-container [ngTemplateOutlet]="empty.template" />
        </div>
      }
      @if (probeItem(); as probe) {
        <div
          #probe
          class="mf-items-grid__cell mf-items-grid__probe"
          [style]="probeStyle()"
          aria-hidden="true"
        >
          <ng-container
            [ngTemplateOutlet]="itemDef()?.template ?? null"
            [ngTemplateOutletContext]="{ $implicit: probe.item, item: probe.item, index: 0 }"
          />
        </div>
      }
    </div>
    @if (pager()) {
      @if (pagerDef(); as custom) {
        <ng-container
          [ngTemplateOutlet]="custom.template"
          [ngTemplateOutletContext]="{ $implicit: state(), state: state(), controller }"
        />
      } @else {
        <mf-items-grid-pager
          [controller]="controller"
          [state]="state()"
          [labels]="pagerLabels() ?? undefined"
        />
      }
    }
    <div class="mf-items-grid__live" [style]="liveStyle" aria-live="polite">
      {{ state().announcement }}
    </div>
  `,
})
export class MfItemsGrid<T> {
  // MARK: - Inputs

  /** Client mode: the whole dataset. Server mode: the current page. Replace, don't mutate. */
  readonly items = input<readonly T[]>([]);

  /** Stable identity of an item; must not depend on its position. */
  readonly getKey = input.required<(item: T) => ItemKey>();

  /** `'client'` (default) slices `items`; `'server'` requests pages via `pageRequest`. */
  readonly mode = input<PagingMode>('client');

  /**
   * Server mode: size of the whole dataset. `undefined` / `null` means unknown: the page is
   * never clamped and `canNext` stays true while pages come back full.
   */
  readonly total = input<number | null | undefined>(undefined);

  /** Name of the active preset. Default `'normal'`. */
  readonly preset = input<string | undefined>(undefined);

  /** Available presets. Default: compact, normal, large. */
  readonly presets = input<Readonly<Record<string, SizePreset>> | undefined>(undefined);

  /** Measure the row height from a hidden sample card instead of using the preset's. */
  readonly measureRowHeight = input(false);

  /** The item rendered in the measuring probe; defaults to the first item. */
  readonly sampleItem = input<T | undefined>(undefined);

  /** Overrides the preset's `maxColumns`. */
  readonly maxColumns = input<number | undefined>(undefined);

  /** Overrides the preset's `maxPageSize`. */
  readonly maxPageSize = input<number | undefined>(undefined);

  /** `'live'` (default) or `'stable'` (freeze the page; count new items). */
  readonly reflow = input<ReflowMode>('live');

  /** `'start'` (default, leftover height below the rows) or `'center'`. */
  readonly align = input<GridAlign>('start');

  /** The app is fetching data: render the skeleton template once per slot. */
  readonly loading = input(false);

  /**
   * Zero-based page to show. The grid navigates when it changes and reports its own
   * changes through `pageIndexChange`, so `[(pageIndex)]` binds two-way.
   */
  readonly pageIndex = input(0);

  /**
   * Server mode: delay before requesting after a page-size change (resize, preset, measured
   * row height…), in ms, so a drag-resize sends one request. Default 150.
   */
  readonly requestDebounceMs = input<number | undefined>(undefined);

  /** Screen-reader announcements, merged over the English defaults. */
  readonly messages = input<Partial<ItemsGridMessages> | undefined>(undefined);

  /**
   * Render a pager below the grid: the built-in one, or the projected
   * `ng-template[mfItemsGridPagerTemplate]`. Default `true`.
   */
  readonly pager = input(true);

  /** Texts of the built-in pager. */
  readonly pagerLabels = input<Partial<PagerLabels> | undefined>(undefined);

  /** Accessible name of the card list. */
  readonly ariaLabel = input<string | undefined>(undefined);

  // MARK: - Outputs

  /** Server mode: the grid needs this page. Respond by updating `items` and `total`. */
  readonly pageRequest = output<PageRequest>();

  /** The page index changed: navigation, reanchoring after a resize, or clamping. */
  readonly pageIndexChange = output<number>();

  /**
   * Every new render state, for app chrome outside the grid (e.g. a "5 new items" banner
   * from `pendingCount`). Inside a template, `#grid="mfItemsGrid"` + `grid.state()` also works.
   */
  readonly stateChange = output<ItemsGridState<T>>();

  // MARK: - Templates & view

  protected readonly itemDef = contentChild(MfItemsGridItem<T>);
  protected readonly skeletonDef = contentChild(MfItemsGridSkeleton);
  protected readonly emptyDef = contentChild(MfItemsGridEmpty);
  protected readonly pagerDef = contentChild(MfItemsGridPagerTemplate<T>);

  private readonly _viewport = viewChild.required<ElementRef<HTMLElement>>('viewport');
  private readonly _probe = viewChild<ElementRef<HTMLElement>>('probe');

  // MARK: - State

  /** Navigation (`next()`, `goTo()`, `refresh()`…) and state; the component owns the inputs. */
  readonly controller: ItemsGridHandle<T>;

  private readonly _controller: ItemsGridController<T>;

  /**
   * Monotonic version bumped by every controller notification; `state` reads it to
   * re-derive from the plain, non-reactive controller.
   */
  private readonly _version = signal(0);

  /** The current render state. */
  readonly state = computed<ItemsGridState<T>>(() => {
    this._version();
    return this._controller.getState();
  });

  protected readonly hostStyle = getHostStyle();
  protected readonly cellStyle = getCellStyle();
  protected readonly emptyStyle = getEmptyStyle();
  protected readonly liveStyle = getVisuallyHiddenStyle();
  protected readonly viewportStyle = computed(() => getViewportStyle(this.state()));
  protected readonly probeStyle = computed(() => getProbeStyle(this.state()));
  protected readonly skeletonSlots = computed(() =>
    Array.from({ length: this.state().skeletonCount }, (_, slot) => slot),
  );
  /** Wrapped so `@if` also renders a falsy probe item (e.g. `0`). */
  protected readonly probeItem = computed(() => {
    const item = this.state().probeItem;
    return item === undefined ? null : { item };
  });

  constructor() {
    // Callbacks read the latest inputs untracked, so option changes never rebuild anything.
    this._controller = new ItemsGridController<T>({
      getKey: (item) => untracked(this.getKey)(item),
      onPageRequest: (request) => this.pageRequest.emit(request),
      onPageChange: (pageIndex) => this.pageIndexChange.emit(pageIndex),
      onStateChange: (state) => this.stateChange.emit(state),
      messages: {
        page: (info) => (untracked(this.messages)?.page ?? DEFAULT_MESSAGES.page)(info),
        newItems: (count) =>
          (untracked(this.messages)?.newItems ?? DEFAULT_MESSAGES.newItems)(count),
      },
    });
    this.controller = this._controller;
    const unsubscribe = this._controller.subscribe(() => this._version.update((v) => v + 1));

    // Every option input flows through one effect; the controller ignores unchanged values,
    // and a changed pageIndex navigates (so `[(pageIndex)]` binds two-way).
    effect(() => {
      const options = {
        items: this.items(),
        mode: this.mode(),
        total: this.total(),
        preset: this.preset(),
        presets: this.presets(),
        measureRowHeight: this.measureRowHeight(),
        sampleItem: this.sampleItem(),
        maxColumns: this.maxColumns(),
        maxPageSize: this.maxPageSize(),
        reflow: this.reflow(),
        align: this.align(),
        loading: this.loading(),
        pageIndex: this.pageIndex(),
        requestDebounceMs: this.requestDebounceMs(),
      };
      untracked(() => this._controller.setOptions(options));
    });

    effect((onCleanup) => {
      const viewport = this._viewport().nativeElement;
      onCleanup(observeSize(viewport, (size) => this._controller.setViewportSize(size)));
    });

    effect((onCleanup) => {
      const probe = this._probe()?.nativeElement;
      if (probe) {
        onCleanup(
          observeSize(probe, (size) => this._controller.setMeasuredRowHeight(size.height), {
            box: 'border',
          }),
        );
      }
    });

    afterNextRender(() => {
      if (!this.itemDef()) {
        console.warn(
          'items-grid: <mf-items-grid> has no ng-template[mfItemsGridItem], so its cards render ' +
            'empty. Add one and import MfItemsGridItem into the component.',
        );
      }
    });

    inject(DestroyRef).onDestroy(() => {
      unsubscribe();
      this._controller.destroy();
    });
  }

  protected trackKey(item: T): ItemKey {
    return this.getKey()(item);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (shouldPageGrid(event) && this._controller.handleKeydown(event.key)) {
      event.preventDefault();
    }
  }
}

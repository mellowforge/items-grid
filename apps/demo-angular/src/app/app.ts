import { Component, computed, effect, signal, viewChild } from '@angular/core';
import {
  MfItemsGrid,
  MfItemsGridEmpty,
  MfItemsGridItem,
  MfItemsGridSkeleton,
} from '@mellowforge/items-grid-angular';
import type {
  GridAlign,
  ItemsGridState,
  PageRequest,
  PagingMode,
  ReflowMode,
} from '@mellowforge/items-grid-core';
import {
  ALIGN_OPTIONS,
  type CardSize,
  createEntities,
  DEMO_ITEM_COUNT,
  DENSITY_OPTIONS,
  type Entity,
  fetchPage,
  MAX_PAGE_OPTIONS,
  type MaxPageChoice,
  maxPageSizeOf,
  MODE_OPTIONS,
  type PageResponse,
  REFLOW_OPTIONS,
  startSimulation,
} from 'demo-shared';

import { Card } from './card';
import { Segmented } from './segmented';

interface ServerPage {
  readonly ids: readonly string[];
  readonly total: number | undefined;
  readonly loading: boolean;
}

const NO_PAGE: ServerPage = { ids: [], total: undefined, loading: true };

/** The page shell: toolbar, realtime simulation, fake API and the grid. */
@Component({
  selector: 'app-root',
  host: { class: 'app' },
  imports: [Card, Segmented, MfItemsGrid, MfItemsGridItem, MfItemsGridSkeleton, MfItemsGridEmpty],
  template: `
    <header class="app__header">
      <span class="app__brand">Fleet Console</span>
      <span class="app__flavor">items-grid · Angular</span>
    </header>
    <main class="app__main">
      <div class="toolbar">
        <h1 class="toolbar__title">Entities</h1>
        <span class="toolbar__count">{{ database().length }} items</span>
        @if (pendingCount() > 0) {
          <span class="banner">
            <span>{{ pendingCount() }} new {{ pendingCount() === 1 ? 'item' : 'items' }}</span>
            <button type="button" class="banner__show" (click)="grid().controller.refresh()">
              Show
            </button>
          </span>
        }
        @if (loadError()) {
          <span class="banner banner--error" role="alert">
            <span>Could not load this page</span>
            <button type="button" class="banner__show" (click)="grid().controller.refresh()">
              Retry
            </button>
          </span>
        }
        <span class="toolbar__spacer"></span>
        <app-segmented
          label="Density"
          [options]="densityOptions"
          [value]="density()"
          (valueChange)="density.set($event)"
        />
        <app-segmented
          label="Data"
          [options]="modeOptions"
          [value]="mode()"
          (valueChange)="changeMode($event)"
        />
        <app-segmented
          label="Updates"
          [options]="reflowOptions"
          [value]="reflow()"
          (valueChange)="reflow.set($event)"
        />
        <app-segmented
          label="Align"
          [options]="alignOptions"
          [value]="align()"
          (valueChange)="align.set($event)"
        />
        <app-segmented
          label="Max"
          [options]="maxPageOptions"
          [value]="maxPage()"
          (valueChange)="maxPage.set($event)"
        />
        <label class="toggle">
          <input
            type="checkbox"
            [checked]="realtime()"
            (change)="realtime.set($any($event.target).checked)"
          />
          Realtime
        </label>
      </div>
      <mf-items-grid
        class="app__grid"
        ariaLabel="Entities"
        [items]="items()"
        [getKey]="getKey"
        [mode]="mode()"
        [total]="mode() === 'server' ? server().total : undefined"
        [loading]="mode() === 'server' && server().loading"
        [preset]="density()"
        [reflow]="reflow()"
        [align]="align()"
        [maxPageSize]="maxPageSize()"
        (pageRequest)="onPageRequest($event)"
        (stateChange)="onStateChange($event)"
      >
        <ng-template mfItemsGridItem [mfItemsGridItemOf]="items()" let-entity>
          <article
            appCard
            [entity]="entity"
            [size]="density()"
            (toggled)="toggle(entity.id, $event)"
          ></article>
        </ng-template>
        <ng-template mfItemsGridSkeleton>
          <div class="skeleton-card">
            <div class="skeleton-card__group">
              <div class="skeleton-card__bar" style="width: 55%"></div>
              <div class="skeleton-card__bar" style="width: 35%"></div>
            </div>
            <div class="skeleton-card__group">
              <div class="skeleton-card__bar" style="width: 100%"></div>
              <div class="skeleton-card__bar" style="width: 70%"></div>
            </div>
          </div>
        </ng-template>
        <ng-template mfItemsGridEmpty>
          <div class="empty-state">
            <p class="empty-state__title">No entities yet</p>
            <p class="empty-state__hint">They will appear here as soon as they report in.</p>
          </div>
        </ng-template>
      </mf-items-grid>
    </main>
  `,
})
export class App {
  protected readonly densityOptions = DENSITY_OPTIONS;
  protected readonly modeOptions = MODE_OPTIONS;
  protected readonly reflowOptions = REFLOW_OPTIONS;
  protected readonly alignOptions = ALIGN_OPTIONS;
  protected readonly maxPageOptions = MAX_PAGE_OPTIONS;

  protected readonly database = signal(createEntities(DEMO_ITEM_COUNT));
  protected readonly density = signal<CardSize>('normal');
  protected readonly mode = signal<PagingMode>('client');
  protected readonly reflow = signal<ReflowMode>('live');
  protected readonly align = signal<GridAlign>('start');
  protected readonly maxPage = signal<MaxPageChoice>('fit');
  protected readonly maxPageSize = computed(() => maxPageSizeOf(this.maxPage()));
  protected readonly realtime = signal(false);
  protected readonly server = signal<ServerPage>(NO_PAGE);
  protected readonly pendingCount = signal(0);
  protected readonly loadError = signal(false);
  protected readonly grid = viewChild.required(MfItemsGrid<Entity>);

  protected readonly getKey = (entity: Entity): string => entity.id;

  protected readonly items = computed(() => {
    const database = this.database();
    if (this.mode() === 'client') return database;
    const byId = new Map(database.map((entity) => [entity.id, entity]));
    return this.server().ids.flatMap((id) => byId.get(id) ?? []);
  });

  private _requestSeq = 0;
  private _quietRefresh = false;

  constructor() {
    effect((onCleanup) => {
      if (!this.realtime()) return;
      onCleanup(
        startSimulation({
          read: () => this.database(),
          write: (entities) => {
            this.database.set(entities);
            if (this.mode() === 'server') {
              this.server.update((page) => ({ ...page, total: entities.length }));
              // Live server mode re-fetches the page in the background so inserts shift in.
              if (this.reflow() === 'live') {
                this._quietRefresh = true;
                this.grid().controller.refresh();
                // No request goes out while the grid is hidden; don't let the flag leak.
                this._quietRefresh = false;
              }
            }
          },
        }),
      );
    });
  }

  protected onPageRequest(request: PageRequest): void {
    const seq = ++this._requestSeq;
    if (!this._quietRefresh) this.server.update((page) => ({ ...page, loading: true }));
    this._quietRefresh = false;
    this.loadError.set(false);
    void this._load(request, seq);
  }

  private async _load(request: PageRequest, seq: number): Promise<void> {
    let response: PageResponse;
    try {
      response = await fetchPage(this.database(), request);
    } catch (error) {
      if (seq !== this._requestSeq || this.mode() !== 'server') return;
      console.error(error);
      // Clear the stale cards so the old page never shows under the new page's numbers;
      // refresh() asks for this page again.
      this.server.update((page) => ({ ...page, ids: [], loading: false }));
      this.loadError.set(true);
      return;
    }
    if (seq !== this._requestSeq || this.mode() !== 'server') return;
    this.server.set({
      ids: response.items.map((entity) => entity.id),
      total: response.total,
      loading: false,
    });
  }

  protected onStateChange(state: ItemsGridState<Entity>): void {
    this.pendingCount.set(state.pendingCount);
  }

  protected changeMode(mode: PagingMode): void {
    this.mode.set(mode);
    this.server.set(NO_PAGE);
    this.loadError.set(false);
  }

  protected toggle(id: string, enabled: boolean): void {
    this.database.update((entities) =>
      entities.map((entity) => (entity.id === id ? { ...entity, enabled } : entity)),
    );
  }
}

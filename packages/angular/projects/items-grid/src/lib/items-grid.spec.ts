import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { PageRequest, PagingMode } from '@quietfoundry/items-grid-core';

import { flushFrames, installLayoutStubs, ResizeObserverStub } from '../test-utils/resize-observer';
import { QfItemsGrid } from './items-grid';
import { QfItemsGridEmpty, QfItemsGridItem, QfItemsGridSkeleton } from './items-grid-templates';

interface Entity {
  id: number;
  name: string;
}

const entities = (count: number): Entity[] =>
  Array.from({ length: count }, (_, id) => ({ id, name: `Entity ${id}` }));

@Component({
  imports: [QfItemsGrid, QfItemsGridItem, QfItemsGridSkeleton, QfItemsGridEmpty],
  template: `
    <qf-items-grid
      [items]="items()"
      [getKey]="getKey"
      [mode]="mode()"
      [loading]="loading()"
      [measureRowHeight]="measure()"
      [pager]="pager()"
      [(pageIndex)]="page"
      ariaLabel="Entities"
      (pageRequest)="requests.push($event)"
      (pageIndexChange)="pageChanges.push($event)"
      (stateChange)="lastPageSize = $event.pageSize"
    >
      <ng-template qfItemsGridItem let-item>
        <article>{{ item.name }}</article>
      </ng-template>
      <ng-template qfItemsGridSkeleton><div class="test-skeleton"></div></ng-template>
      <ng-template qfItemsGridEmpty><p>No entities yet</p></ng-template>
    </qf-items-grid>
  `,
})
class HostComponent {
  readonly items = signal(entities(30));
  readonly mode = signal<PagingMode>('client');
  readonly loading = signal(false);
  readonly measure = signal(false);
  readonly pager = signal(true);
  readonly page = signal(0);
  readonly requests: PageRequest[] = [];
  readonly pageChanges: number[] = [];
  lastPageSize = 0;
  readonly getKey = (item: Entity): number => item.id;
  readonly grid = viewChild.required(QfItemsGrid<Entity>);
}

let fixture: ComponentFixture<HostComponent>;
let host: HostComponent;
let element: HTMLElement;

const viewport = (): HTMLElement => element.querySelector('[role="list"]')!;
const cards = (): string[] =>
  Array.from(element.querySelectorAll('[role="listitem"]')).map(
    (item) => item.textContent?.trim() ?? '',
  );
const button = (name: string): HTMLButtonElement =>
  Array.from(element.querySelectorAll('button')).find(
    (candidate) => candidate.getAttribute('aria-label') === name,
  )!;

/** Normal preset: 1318×552 → 4 × 3 = 12 per page; 976×552 → 3 × 3 = 9. */
async function layout(width = 1318, height = 552): Promise<void> {
  ResizeObserverStub.for(viewport()).fire(width, height);
  flushFrames();
  await fixture.whenStable();
}

async function click(target: HTMLElement): Promise<void> {
  target.click();
  await fixture.whenStable();
}

beforeEach(async () => {
  installLayoutStubs();
  await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
  fixture = TestBed.createComponent(HostComponent);
  host = fixture.componentInstance;
  element = fixture.nativeElement;
  await fixture.whenStable();
});

afterEach(() => {
  fixture.destroy();
  vi.unstubAllGlobals();
});

describe('QfItemsGrid', () => {
  it('renders exactly one page of cards once the viewport is measured (no manual detectChanges)', async () => {
    expect(cards()).toHaveLength(0);
    await layout();
    expect(cards()).toHaveLength(12);
    expect(cards()[0]).toBe('Entity 0');
  });

  it('marks the grid as a labelled list and applies the geometry inline', async () => {
    await layout();
    expect(viewport().getAttribute('aria-label')).toBe('Entities');
    expect(viewport().style.gridTemplateColumns).toBe('repeat(4, minmax(0, 1fr))');
    expect(viewport().style.gridAutoRows).toBe('160px');
    expect(element.querySelector('qf-items-grid')!.classList).toContain('qf-items-grid');
  });

  it('pages with the pager buttons', async () => {
    await layout();
    expect(button('Previous page').disabled).toBe(true);
    expect(button('Page 1').getAttribute('aria-current')).toBe('page');
    await click(button('Next page'));
    expect(cards()[0]).toBe('Entity 12');
    await click(button('Page 3'));
    expect(cards()).toHaveLength(6);
    expect(element.querySelector('.qf-items-grid-pager__status')!.textContent!.trim()).toBe(
      'Items 25–30 of 30',
    );
  });

  it('pages with PageDown inside the grid', async () => {
    await layout();
    const event = new KeyboardEvent('keydown', {
      key: 'PageDown',
      bubbles: true,
      cancelable: true,
    });
    element.querySelector('[role="listitem"]')!.dispatchEvent(event);
    await fixture.whenStable();
    expect(event.defaultPrevented).toBe(true);
    expect(cards()[0]).toBe('Entity 12');
  });

  it('keeps the first card on screen when the page shrinks', async () => {
    await layout();
    await click(button('Page 2')); // items 12–23
    await layout(976, 552); // 9 per page → page 2 shows 9–17
    expect(cards()).toContain('Entity 12');
  });

  it('keeps card DOM nodes when items are replaced with updated objects', async () => {
    await layout();
    const first = element.querySelector('[role="listitem"]');
    host.items.set(entities(30).map((item) => ({ ...item, name: `${item.name}!` })));
    await fixture.whenStable();
    expect(element.querySelector('[role="listitem"]')).toBe(first);
    expect(cards()[0]).toBe('Entity 0!');
  });

  it('renders one skeleton per slot while loading', async () => {
    host.mode.set('server');
    host.items.set([]);
    host.loading.set(true);
    await layout();
    expect(element.querySelectorAll('.test-skeleton')).toHaveLength(12);
    expect(viewport().getAttribute('aria-busy')).toBe('true');
  });

  it('renders the empty template when there are no items', async () => {
    host.items.set([]);
    await layout();
    expect(element.querySelector('.qf-items-grid__empty')!.textContent!.trim()).toBe(
      'No entities yet',
    );
  });

  it('measures the row height from a hidden probe card', async () => {
    host.measure.set(true);
    await layout();
    const probe = element.querySelector<HTMLElement>('.qf-items-grid__probe')!;
    expect(probe.getAttribute('aria-hidden')).toBe('true');
    ResizeObserverStub.for(probe).fire(280, 118, { inlineSize: 280, blockSize: 118 });
    flushFrames();
    await fixture.whenStable();
    expect(viewport().style.gridAutoRows).toBe('118px');
  });

  it('requests pages in server mode', async () => {
    host.mode.set('server');
    host.items.set([]);
    await fixture.whenStable();
    await layout();
    expect(host.requests).toEqual([{ pageIndex: 0, pageSize: 12 }]);
  });

  it('binds the page index two-way', async () => {
    host.page.set(2);
    await layout();
    expect(cards()[0]).toBe('Entity 24');
    await click(button('Previous page'));
    expect(host.page()).toBe(1);
  });

  it('reports state changes to app chrome outside the grid', async () => {
    await layout();
    expect(host.lastPageSize).toBe(12);
  });

  it('reports page changes', async () => {
    await layout();
    await click(button('Next page'));
    expect(host.pageChanges.at(-1)).toBe(1);
  });

  it('announces page changes in a polite live region', async () => {
    await layout();
    await click(button('Next page'));
    expect(element.querySelector('[aria-live="polite"]')!.textContent!.trim()).toBe(
      'Page 2 of 3, items 13–24 of 30',
    );
  });

  it('exposes the controller for imperative navigation', async () => {
    await layout();
    host.grid().controller.goTo(2);
    await fixture.whenStable();
    expect(cards()[0]).toBe('Entity 24');
  });

  it('renders no pager when pager is false', async () => {
    host.pager.set(false);
    await layout();
    expect(element.querySelector('[role="navigation"]')).toBeNull();
  });

  it('stops observing when destroyed', async () => {
    await layout();
    const observer = ResizeObserverStub.for(viewport());
    fixture.destroy();
    expect(observer.disconnected).toBe(true);
  });
});

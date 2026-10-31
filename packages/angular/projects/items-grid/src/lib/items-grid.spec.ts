import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { PageRequest, PagingMode } from '@mellowforge/items-grid-core';

import { flushFrames, installLayoutStubs, ResizeObserverStub } from '../test-utils/resize-observer';
import { MfItemsGrid } from './items-grid';
import { MfItemsGridPager } from './items-grid-pager';
import {
  MfItemsGridEmpty,
  MfItemsGridItem,
  MfItemsGridPagerTemplate,
  MfItemsGridSkeleton,
} from './items-grid-templates';

interface Entity {
  id: number;
  name: string;
}

const entities = (count: number): Entity[] =>
  Array.from({ length: count }, (_, id) => ({ id, name: `Entity ${id}` }));

@Component({
  imports: [MfItemsGrid, MfItemsGridItem, MfItemsGridSkeleton, MfItemsGridEmpty],
  template: `
    <mf-items-grid
      [items]="items()"
      [getKey]="getKey"
      [mode]="mode()"
      [loading]="loading()"
      [measureRowHeight]="measure()"
      [pager]="pager()"
      [preset]="preset()"
      [total]="total()"
      [pagerLabels]="labels()"
      [(pageIndex)]="page"
      ariaLabel="Entities"
      (pageRequest)="requests.push($event)"
      (pageIndexChange)="pageChanges.push($event)"
      (stateChange)="lastPageSize = $event.pageSize"
    >
      <ng-template mfItemsGridItem [mfItemsGridItemOf]="items()" let-item>
        <article>
          {{ item.name }}
          @if (withInput()) {
            <input [attr.aria-label]="'Note for ' + item.name" />
          }
          @if (handled()) {
            <button type="button" class="eats-keys" (keydown)="$event.preventDefault()">x</button>
          }
        </article>
      </ng-template>
      <ng-template mfItemsGridSkeleton><div class="test-skeleton"></div></ng-template>
      <ng-template mfItemsGridEmpty><p>No entities yet</p></ng-template>
    </mf-items-grid>
  `,
})
class HostComponent {
  readonly items = signal(entities(30));
  readonly mode = signal<PagingMode>('client');
  readonly loading = signal(false);
  readonly measure = signal(false);
  readonly pager = signal(true);
  readonly page = signal(0);
  readonly preset = signal('normal');
  readonly total = signal<number | undefined>(undefined);
  readonly withInput = signal(false);
  readonly labels = signal<{ next?: string; page?: undefined } | undefined>(undefined);
  readonly handled = signal(false);
  readonly requests: PageRequest[] = [];
  readonly pageChanges: number[] = [];
  lastPageSize = 0;
  readonly getKey = (item: Entity): number => item.id;
  readonly grid = viewChild.required(MfItemsGrid<Entity>);
}

let fixture: ComponentFixture<HostComponent>;
let host: HostComponent;
let element: HTMLElement;

const viewport = (): HTMLElement => element.querySelector('.mf-items-grid__viewport')!;
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
  vi.useRealTimers();
  fixture.destroy();
  vi.unstubAllGlobals();
});

describe('MfItemsGrid', () => {
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
    expect(element.querySelector('mf-items-grid')!.classList).toContain('mf-items-grid');
  });

  it('pages with the pager buttons', async () => {
    await layout();
    expect(button('Previous page').disabled).toBe(true);
    expect(button('Page 1').getAttribute('aria-current')).toBe('page');
    await click(button('Next page'));
    expect(cards()[0]).toBe('Entity 12');
    await click(button('Page 3'));
    expect(cards()).toHaveLength(6);
    expect(element.querySelector('.mf-items-grid-pager__status')!.textContent!.trim()).toBe(
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

  it('renders the empty template, and is not a list while empty', async () => {
    host.items.set([]);
    await layout();
    expect(element.querySelector('.mf-items-grid__empty')!.textContent!.trim()).toBe(
      'No entities yet',
    );
    expect(viewport().hasAttribute('role')).toBe(false);
  });

  it('keeps the first card on screen and reports the page when the preset changes', async () => {
    await layout();
    await click(button('Page 3')); // items 24–29
    host.preset.set('large'); // 3 × 2 = 6 per page
    await fixture.whenStable();
    expect(cards()).toContain('Entity 24');
    expect(host.page()).toBe(4);
  });

  it('pages back with PageUp and leaves other keys alone', async () => {
    await layout();
    await click(button('Next page'));
    const arrow = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    });
    element.querySelector('[role="listitem"]')!.dispatchEvent(arrow);
    expect(arrow.defaultPrevented).toBe(false);
    element
      .querySelector('[role="listitem"]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true }));
    await fixture.whenStable();
    expect(cards()[0]).toBe('Entity 0');
  });

  it('ignores PageDown typed into a field inside a card', async () => {
    host.withInput.set(true);
    await layout();
    const event = new KeyboardEvent('keydown', {
      key: 'PageDown',
      bubbles: true,
      cancelable: true,
    });
    element.querySelector('input[aria-label="Note for Entity 0"]')!.dispatchEvent(event);
    await fixture.whenStable();
    expect(event.defaultPrevented).toBe(false);
    expect(cards()[0]).toBe('Entity 0');
  });

  it('swaps skeletons for cards when loading ends', async () => {
    host.mode.set('server');
    host.items.set([]);
    host.loading.set(true);
    await layout();
    host.items.set(entities(12));
    host.total.set(30);
    host.loading.set(false);
    await fixture.whenStable();
    expect(element.querySelectorAll('.test-skeleton')).toHaveLength(0);
    expect(cards()).toHaveLength(12);
    expect(viewport().hasAttribute('aria-busy')).toBe(false);
  });

  it('renders a server page with a known total', async () => {
    host.mode.set('server');
    host.items.set([]);
    await layout();
    host.items.set(entities(12));
    host.total.set(120);
    await fixture.whenStable();
    expect(cards()).toHaveLength(12);
    expect(element.querySelector('.mf-items-grid-pager__status')!.textContent!.trim()).toBe(
      'Items 1–12 of 120',
    );
    expect(button('Page 10')).toBeTruthy();
  });

  it('navigates when the bound page changes after layout', async () => {
    await layout();
    host.page.set(2);
    await fixture.whenStable();
    expect(cards()[0]).toBe('Entity 24');
  });

  it('cancels its pending page request when destroyed', async () => {
    host.mode.set('server');
    host.items.set([]);
    await layout();
    // Without the controller's teardown the debounced request would fire into a destroyed
    // output, which Angular only reports with a console warning.
    const warn = vi.spyOn(console, 'warn');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    ResizeObserverStub.for(viewport()).fire(976, 552);
    flushFrames();
    fixture.destroy();
    vi.advanceTimersByTime(500);
    vi.useRealTimers();
    expect(host.requests).toEqual([{ pageIndex: 0, pageSize: 12 }]);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('surfaces invalid options as an error and recovers', async () => {
    await layout();
    host.preset.set('huge');
    await expect(fixture.whenStable()).rejects.toThrow('items-grid: unknown preset "huge"');
    host.preset.set('normal');
    await fixture.whenStable();
    expect(cards()).toHaveLength(12);
  });

  it('pages on while the server total is unknown and pages come back full', async () => {
    host.mode.set('server');
    host.items.set(entities(12));
    await layout();
    expect(element.querySelector('.mf-items-grid-pager__status')!.textContent!.trim()).toBe(
      'Items 1–12',
    );
    expect(button('Page 2')).toBeTruthy();
    await click(button('Next page'));
    expect(host.requests.at(-1)).toEqual({ pageIndex: 1, pageSize: 12 });
  });

  it('passes pager labels through, ignoring undefined ones', async () => {
    host.labels.set({ next: 'Weiter', page: undefined });
    await layout();
    expect(button('Weiter')).toBeTruthy();
    expect(button('Page 1')).toBeTruthy();
  });

  it('reports reanchoring when a hidden grid is shown again', async () => {
    host.items.set(entities(120));
    await layout();
    await click(button('Page 5')); // index 4, item 48
    await layout(0, 0);
    await layout(976, 552); // 9 per page → item 48 is on index 5
    expect(host.page()).toBe(5);
  });

  it('does not page when a card already handled the key', async () => {
    host.handled.set(true);
    await layout();
    element
      .querySelector('.eats-keys')!
      .dispatchEvent(
        new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, cancelable: true }),
      );
    await fixture.whenStable();
    expect(cards()[0]).toBe('Entity 0 x');
  });

  it('keeps the pager status blank until the grid is measured', () => {
    expect(element.querySelector('.mf-items-grid-pager__status')!.textContent!.trim()).toBe('');
  });

  it('does not warn about the item template when one is projected', async () => {
    const warn = vi.spyOn(console, 'warn');
    await layout();
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('mfItemsGridItem'));
    warn.mockRestore();
  });

  it('measures the row height from a hidden probe card', async () => {
    host.measure.set(true);
    await layout();
    const probe = element.querySelector<HTMLElement>('.mf-items-grid__probe')!;
    expect(probe.getAttribute('aria-hidden')).toBe('true');
    ResizeObserverStub.for(probe).fire(280, 100, { inlineSize: 280, blockSize: 118 });
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

@Component({
  imports: [MfItemsGrid],
  template: `<mf-items-grid [items]="items" [getKey]="getKey" />`,
})
class MissingTemplateHostComponent {
  readonly items = entities(3);
  readonly getKey = (item: Entity): number => item.id;
}

@Component({
  imports: [MfItemsGrid, MfItemsGridItem, MfItemsGridPager],
  template: `
    <mf-items-grid #grid [items]="items" [getKey]="getKey" [pager]="false">
      <ng-template mfItemsGridItem let-item>{{ item.name }}</ng-template>
    </mf-items-grid>
    <mf-items-grid-pager class="outside" [controller]="grid.controller" [state]="grid.state()" />
  `,
})
class CustomPagerHostComponent {
  readonly items = entities(30);
  readonly getKey = (item: Entity): number => item.id;
}

@Component({
  imports: [MfItemsGrid, MfItemsGridItem, MfItemsGridPagerTemplate],
  template: `
    <mf-items-grid [items]="items" [getKey]="getKey" [pager]="pager()">
      <ng-template mfItemsGridItem let-item>{{ item.name }}</ng-template>
      @if (custom()) {
        <ng-template
          mfItemsGridPagerTemplate
          [mfItemsGridPagerTemplateOf]="items"
          let-state
          let-grid="controller"
        >
          <button type="button" class="custom" (click)="grid.next()">
            custom {{ state.pageIndex + 1 }} of {{ state.pageCount }} from
            {{ state.items[0]?.name }}
          </button>
        </ng-template>
      }
    </mf-items-grid>
  `,
})
class PagerTemplateHostComponent {
  readonly items = entities(30);
  readonly pager = signal(true);
  readonly custom = signal(true);
  readonly getKey = (item: Entity): number => item.id;
}

describe('MfItemsGrid — composition', () => {
  it('renders a projected pager template in place of the built-in pager, and none when pager is false', async () => {
    const custom = TestBed.createComponent(PagerTemplateHostComponent);
    await custom.whenStable();
    const root: HTMLElement = custom.nativeElement;
    ResizeObserverStub.for(root.querySelector('.mf-items-grid__viewport')!).fire(1318, 552);
    flushFrames();
    await custom.whenStable();
    const customButton = (): HTMLButtonElement | null => root.querySelector('button.custom');
    const label = (): string => customButton()!.textContent!.replace(/\s+/g, ' ').trim();
    expect(root.querySelector('mf-items-grid-pager')).toBeNull();
    expect(label()).toBe('custom 1 of 3 from Entity 0');
    // The template sits between the viewport and the live region, like the built-in pager.
    const host = root.querySelector('mf-items-grid')!;
    const position = (selector: string): number =>
      customButton()!.compareDocumentPosition(host.querySelector(selector)!);
    expect(position('.mf-items-grid__viewport')).toBe(Node.DOCUMENT_POSITION_PRECEDING);
    expect(position('.mf-items-grid__live')).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    customButton()!.click();
    await custom.whenStable();
    expect(label()).toBe('custom 2 of 3 from Entity 12');
    expect(root.querySelector('[role="listitem"]')!.textContent!.trim()).toBe('Entity 12');
    // A template that leaves the content gives the built-in pager back.
    custom.componentInstance.custom.set(false);
    await custom.whenStable();
    expect(customButton()).toBeNull();
    expect(root.querySelector('mf-items-grid-pager')).not.toBeNull();
    custom.componentInstance.custom.set(true);
    custom.componentInstance.pager.set(false);
    await custom.whenStable();
    expect(customButton()).toBeNull();
    expect(root.querySelector('mf-items-grid-pager')).toBeNull();
    custom.destroy();
  });

  it('warns when no item template is projected', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const missing = TestBed.createComponent(MissingTemplateHostComponent);
    await missing.whenStable();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ng-template[mfItemsGridItem]'));
    warn.mockRestore();
    missing.destroy();
  });

  it('drives a pager placed outside the grid', async () => {
    const custom = TestBed.createComponent(CustomPagerHostComponent);
    await custom.whenStable();
    const root: HTMLElement = custom.nativeElement;
    ResizeObserverStub.for(root.querySelector('.mf-items-grid__viewport')!).fire(1318, 552);
    flushFrames();
    await custom.whenStable();
    expect(root.querySelectorAll('mf-items-grid-pager')).toHaveLength(1);
    root.querySelector<HTMLButtonElement>('.outside button[aria-label="Next page"]')!.click();
    await custom.whenStable();
    expect(root.querySelector('[role="listitem"]')!.textContent!.trim()).toBe('Entity 12');
    custom.destroy();
  });
});

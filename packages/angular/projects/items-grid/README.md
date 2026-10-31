# @mellowforge/items-grid-angular

Angular component over `@mellowforge/items-grid-core`: a card grid that fits its host
exactly — full rows and columns only — and pages the rest. Size presets, fixed or measured
row height, client or server paging, live or stable realtime reflow, skeletons and an
optional pager. Signal inputs, zoneless-ready, no Material or CDK dependency. Angular 22+.

```sh
npm install @mellowforge/items-grid-angular @mellowforge/items-grid-core
```

## Usage

```ts
import {
  MfItemsGrid,
  MfItemsGridEmpty,
  MfItemsGridItem,
  MfItemsGridSkeleton,
} from '@mellowforge/items-grid-angular';

@Component({
  selector: 'app-devices',
  imports: [MfItemsGrid, MfItemsGridItem, MfItemsGridSkeleton, MfItemsGridEmpty, DeviceCard],
  template: `
    <mf-items-grid
      class="devices-grid"
      ariaLabel="Devices"
      [items]="devices()"
      [getKey]="byId"
      preset="compact"
      [(pageIndex)]="page"
    >
      <ng-template mfItemsGridItem [mfItemsGridItemOf]="devices()" let-device>
        <app-device-card [device]="device" />
      </ng-template>
      <ng-template mfItemsGridSkeleton><app-skeleton-card /></ng-template>
      <ng-template mfItemsGridEmpty><app-empty-state /></ng-template>
    </mf-items-grid>
  `,
  // The grid needs a definite height from your layout: here the host is a full-height
  // flex column and the grid takes the space left by any toolbar.
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .devices-grid {
      flex: 1;
      min-height: 0;
    }
  `,
})
export class Devices {
  readonly devices = input.required<Device[]>();
  readonly page = signal(0);
  readonly byId = (device: Device) => device.id;
}
```

Optional pager theme — import it once from a global stylesheet:
`@import '@mellowforge/items-grid-core/styles.css';` (theming and dark mode: the Styling
section of the `@mellowforge/items-grid-core` README).

`[mfItemsGridItemOf]` is only for typing: with `strictTemplates`, `let-device` is then a
`Device`; without it, `let-device` is `any`. A grid without an item template renders empty
cards and logs a warning (with the binding, a missing `MfItemsGridItem` import is a compile
error instead).

## API

**Inputs** mirror the core options (see the core README): `items`, `getKey` (required),
`mode`, `total`, `preset`, `presets`, `measureRowHeight`, `sampleItem`, `maxColumns`,
`maxPageSize`, `reflow`, `align`, `loading`, `pageIndex`, `requestDebounceMs`, `messages`,
plus `pager` (default `true`), `pagerLabels`, `ariaLabel` and `arrowKeys` (default `false`:
arrow keys, Home and End move focus between cards — see the "Arrow keys" section of the
`@mellowforge/items-grid-core` README). Invalid values throw an
`items-grid:` error from the options effect (so they reach Angular's `ErrorHandler`) and the
previous options stay in place.

**Outputs:** `pageRequest` (server mode: `{ pageIndex, pageSize }` — set `loading` in the
handler; on failure clear `loading` and the page's `items`, and retry with
`grid.controller.refresh()`), `pageIndexChange` (every
page change the grid makes, so `[(pageIndex)]` binds two-way) and `stateChange` (every new
state — e.g. for a "5 new items" banner from `pendingCount`).

**Templates:** `ng-template[mfItemsGridItem]` (context: `$implicit` / `item`, `index` =
`range.start` + the offset on the page),
`ng-template[mfItemsGridSkeleton]` (context: `$implicit` / `slot`),
`ng-template[mfItemsGridEmpty]` and `ng-template[mfItemsGridPagerTemplate]` (context:
`$implicit` / `state`, `controller`) — a custom pager rendered in place of the built-in one,
below the cards and outside the measured viewport; `[pager]="false"` hides it too. Bind
`[mfItemsGridPagerTemplateOf]` to the items to type `state.items` under strict templates:

```html
<ng-template
  mfItemsGridPagerTemplate
  [mfItemsGridPagerTemplateOf]="devices()"
  let-state
  let-grid="controller"
>
  <button type="button" [disabled]="!state.canNext" (click)="grid.next()">More</button>
</ng-template>
```

**Template reference:** `#grid="mfItemsGrid"` exposes `grid.state()` (a signal of the render
state) and `grid.controller`, an `ItemsGridHandle` (`next()`, `goTo()`, `refresh()`, …). To place a pager elsewhere on the page, set
`[pager]="false"` and render
`<mf-items-grid-pager [controller]="grid.controller" [state]="grid.state()" />` anywhere.

## License

MIT

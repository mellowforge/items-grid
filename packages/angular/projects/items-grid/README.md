# @quietfoundry/items-grid-angular

Angular component over `@quietfoundry/items-grid-core`: a card grid that fits its host
exactly — full rows and columns only — and pages the rest. Size presets, fixed or measured
row height, client or server paging, live or stable realtime reflow, skeletons and an
optional pager. Signal inputs, zoneless-ready, no Material or CDK dependency. Angular 22+.

```sh
npm install @quietfoundry/items-grid-angular @quietfoundry/items-grid-core
```

## Usage

```ts
import {
  QfItemsGrid,
  QfItemsGridEmpty,
  QfItemsGridItem,
  QfItemsGridSkeleton,
} from '@quietfoundry/items-grid-angular';

@Component({
  selector: 'app-devices',
  imports: [QfItemsGrid, QfItemsGridItem, QfItemsGridSkeleton, QfItemsGridEmpty, DeviceCard],
  template: `
    <qf-items-grid
      class="devices-grid"
      ariaLabel="Devices"
      [items]="devices()"
      [getKey]="byId"
      preset="compact"
      [(pageIndex)]="page"
    >
      <ng-template qfItemsGridItem let-device>
        <app-device-card [device]="device" />
      </ng-template>
      <ng-template qfItemsGridSkeleton><app-skeleton-card /></ng-template>
      <ng-template qfItemsGridEmpty><app-empty-state /></ng-template>
    </qf-items-grid>
  `,
  // The grid needs a definite height from your layout.
  styles: `
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

Optional pager theme — add to `angular.json` styles:
`node_modules/@quietfoundry/items-grid-core/dist/styles.css`.

## API

**Inputs** mirror the core options (see the core README): `items`, `getKey` (required),
`mode`, `total`, `preset`, `presets`, `measureRowHeight`, `sampleItem`, `maxColumns`,
`maxPageSize`, `reflow`, `align`, `loading`, `pageIndex`, `requestDebounceMs`, `messages`,
plus `pager` (default `true`), `pagerLabels` and `ariaLabel`.

**Outputs:** `pageRequest` (server mode: `{ pageIndex, pageSize }`), `pageIndexChange`
(so `[(pageIndex)]` binds two-way) and `stateChange` (every new state — e.g. for a
"5 new items" banner from `pendingCount`).

**Templates:** `ng-template[qfItemsGridItem]` (context: `$implicit` / `item`, `index`),
`ng-template[qfItemsGridSkeleton]` (context: `$implicit` / `slot`) and
`ng-template[qfItemsGridEmpty]`.

**Template reference:** `#grid="qfItemsGrid"` exposes `grid.state()` (a signal of the render
state) and `grid.controller` (`next()`, `goTo()`, `refresh()`, …). To place a custom pager,
set `[pager]="false"` and render
`<qf-items-grid-pager [controller]="grid.controller" [state]="grid.state()" />` anywhere.

## License

MIT

# @quietfoundry/items-grid-react

React component over [`@quietfoundry/items-grid-core`](../core/README.md): a card grid that
fits its container exactly — full rows and columns only — and pages the rest. Size presets,
fixed or measured row height, client or server paging, live or stable realtime reflow,
skeletons and an optional pager. React 18 and 19.

```sh
npm install @quietfoundry/items-grid-react @quietfoundry/items-grid-core
```

## Usage

```tsx
import { ItemsGrid } from '@quietfoundry/items-grid-react';
import '@quietfoundry/items-grid-core/styles.css'; // optional pager theme

export function Devices({ devices }: { devices: Device[] }) {
  return (
    <ItemsGrid
      style={{ flex: 1, minHeight: 0 }} // the grid needs a definite height from your layout
      aria-label="Devices"
      items={devices}
      getKey={device => device.id}
      preset="compact"
      renderItem={device => <DeviceCard device={device} />}
      renderSkeleton={() => <SkeletonCard />}
      renderEmpty={() => <EmptyState />}
    />
  );
}
```

Every option of the core (`mode`, `total`, `preset`, `presets`, `measureRowHeight`,
`sampleItem`, `maxColumns`, `maxPageSize`, `reflow`, `align`, `loading`, `pageIndex`,
`requestDebounceMs`, `onPageRequest`, `onPageChange`, `onStateChange`, `messages`) is a prop —
see the [core README](../core/README.md#options-itemsgridoptionst). Callbacks may be inline
arrows: they are read from a latest-value ref, so a new identity never re-syncs the grid.

Additional props:

| Prop                 | Description                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------------- |
| `renderItem`         | **Required.** `(item, index) => ReactNode`. Cards keep their DOM across updates by `getKey`. |
| `renderSkeleton`     | `(slot) => ReactNode`, rendered once per slot while `loading`.                               |
| `renderEmpty`        | `() => ReactNode`, rendered over the viewport when there are no items.                       |
| `pager`              | `true` (default), `false`, or `({ state, controller }) => ReactNode` for your own.           |
| `pagerLabels`        | Localized pager texts.                                                                       |
| `aria-label`         | Accessible name of the card list.                                                            |
| `className`, `style` | Applied to the host element.                                                                 |

`pageIndex` sets the first page and is followed when it changes; `onPageChange` reports the
grid's own changes.

### Server mode

```tsx
<ItemsGrid
  mode="server"
  items={page.items}
  total={page.total}
  loading={loading}
  onPageRequest={({ pageIndex, pageSize }) => load(pageIndex, pageSize)}
  getKey={device => device.id}
  renderItem={device => <DeviceCard device={device} />}
  renderSkeleton={() => <SkeletonCard />}
/>
```

### Imperative API and app chrome

The `ref` receives the core `ItemsGridController` (`next()`, `goTo()`, `refresh()`, …).
`onStateChange` lets chrome outside the grid react — e.g. a "5 new items" banner in stable
mode whose button calls `ref.current.refresh()`. For fully custom markup, `useItemsGrid`
returns `{ controller, state, viewportRef, probeRef }`, and `ItemsGridPager` renders the
pager from any state and controller.

## License

MIT

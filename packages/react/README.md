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
Object props (`items`, `presets`, `sampleItem`) are compared by identity, so memoize them.

Additional props:

| Prop                 | Description                                                                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `renderItem`         | **Required.** `(item, index) => ReactNode`; `index` is `range.start` + the offset on the page. Cards keep their DOM across updates by `getKey`. |
| `renderSkeleton`     | `(slot) => ReactNode`, rendered once per slot while `loading`.                                                                                  |
| `renderEmpty`        | `() => ReactNode`, rendered over the viewport while `state.isEmpty` (a known total of 0).                                                       |
| `pager`              | `true` (default), `false`, or `({ state, controller }) => ReactNode` for your own.                                                              |
| `pagerLabels`        | Localized pager texts.                                                                                                                          |
| `aria-label`         | Accessible name of the card list.                                                                                                               |
| `className`, `style` | Applied to the host element.                                                                                                                    |

`pageIndex` sets the first page and navigates when it changes; `onPageChange` reports every
page change the grid makes (navigation, reanchoring, clamping).

### Server mode

```tsx
<ItemsGrid
  ref={grid}
  mode="server"
  items={page.items}
  total={page.total} // undefined while unknown: next stays enabled while pages come back full
  loading={loading}
  onPageRequest={({ pageIndex, pageSize }) => load(pageIndex, pageSize)}
  getKey={device => device.id}
  renderItem={device => <DeviceCard device={device} />}
  renderSkeleton={() => <SkeletonCard />}
/>
```

In `load`, set `loading` synchronously, drop responses that arrive after a newer request,
and on failure clear `loading` and the page's `items` and offer a retry with
`grid.current?.refresh()`. Invalid options throw during render: wrap the grid in an error
boundary if they can come from user input.

### Imperative API and app chrome

The `ref` receives an `ItemsGridHandle` (`next()`, `goTo()`, `refresh()`, `getState()`, …).
`onStateChange` lets chrome outside the grid react — e.g. a "5 new items" banner in stable
mode whose button calls `ref.current.refresh()`. For fully custom markup, `useItemsGrid`
returns `{ controller, state, viewportRef, probeRef }`: attach `viewportRef` on the first
render and apply `getViewportStyle(state)` to it inline (its height must come from the
host). `ItemsGridPager` renders the pager from any state and handle, anywhere.

## License

MIT

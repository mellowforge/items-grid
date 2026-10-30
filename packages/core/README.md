# @quietfoundry/items-grid-core

Headless engine for **card grids that fit the screen exactly**. Give it a container and your
items, and it decides how many cards fit — full rows and columns only, no inner scrolling —
and pages the rest. Zero dependencies, framework-agnostic, SSR-safe.

Use it directly (vanilla `mountItemsGrid`), or through
[`@quietfoundry/items-grid-react`](../react/README.md) or
[`@quietfoundry/items-grid-angular`](../angular/projects/items-grid/README.md).

```sh
npm install @quietfoundry/items-grid-core
```

## What it solves

- **Consistent row height.** Every card in a grid gets the same row height: a fixed one per
  size preset, or one measured once from a sample card.
- **Exact fit + pagination.** `cols = floor((width + gap) / (minCardWidth + gap))`,
  `rows = floor((height + gap) / (rowHeight + gap))`, `pageSize = cols × rows`. Recomputed
  on every resize; the first card of the page stays on screen instead of jumping to page 1.
- **Size presets.** `compact`, `normal`, `large` (or your own), one per grid.
- **Client or server paging**, **live or stable realtime reflow**, **per-slot skeletons**,
  an empty state and an optional, unstyled pager.

## Quick start (vanilla)

```ts
import { mountItemsGrid } from '@quietfoundry/items-grid-core';
import '@quietfoundry/items-grid-core/styles.css'; // optional pager theme

const grid = mountItemsGrid(document.querySelector('#devices')!, {
  items: devices,
  getKey: device => device.id,
  preset: 'compact',
  renderItem: device => createDeviceCard(device),
  updateItem: (card, device) => patchDeviceCard(card, device), // optional, keeps card DOM
  renderSkeleton: () => createSkeletonCard(),
  renderEmpty: () => createEmptyState(),
});

grid.update({ items: nextDevices }); // realtime updates
grid.controller.next(); // imperative paging
grid.destroy();
```

> **Layout requirement:** the container needs a definite height from your layout — e.g.
> `flex: 1; min-height: 0` in a column flexbox, or `height: 100%`. The grid fills exactly
> that box. Put toolbars and banners _outside_ it; the built-in pager sits inside the host
> but outside the measured viewport, so it never needs a hard-coded offset.

## Options (`ItemsGridOptions<T>`)

| Option              | Default    | Description                                                                                                               |
| ------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| `getKey`            | —          | **Required.** Stable identity of an item; must not depend on its position.                                                |
| `items`             | `[]`       | Client mode: the whole dataset. Server mode: the current page.                                                            |
| `mode`              | `'client'` | `'client'` slices `items`; `'server'` asks for pages through `onPageRequest`.                                             |
| `total`             | —          | Server mode: dataset size. Unknown while `undefined` (the page is never clamped then).                                    |
| `preset`            | `'normal'` | Name of the active preset.                                                                                                |
| `presets`           | built-ins  | `Record<string, SizePreset>`: `{ minCardWidth, gap, rowHeight, maxColumns?, maxPageSize? }`.                              |
| `measureRowHeight`  | `false`    | Measure the row height from a hidden probe card (`sampleItem`, or the first item) instead of using the preset's.          |
| `sampleItem`        | —          | The item rendered in the probe.                                                                                           |
| `maxColumns`        | —          | Caps columns (overrides the preset).                                                                                      |
| `maxPageSize`       | —          | Caps cards per page; rows are reduced first, then columns (overrides the preset).                                         |
| `reflow`            | `'live'`   | `'live'`: the page shows the current slice. `'stable'`: the page keeps its cards until navigation, resize or `refresh()`. |
| `align`             | `'start'`  | Leftover height below the rows (`'start'`) or split above and below (`'center'`). Never changes the page size.            |
| `loading`           | `false`    | The app is fetching; render one skeleton per slot.                                                                        |
| `pageIndex`         | `0`        | Zero-based page shown first.                                                                                              |
| `requestDebounceMs` | `150`      | Server mode: delay before requesting after a resize, so a drag-resize sends one request.                                  |
| `onPageRequest`     | —          | Server mode: `({ pageIndex, pageSize }) => void`. Respond by updating `items` and `total`.                                |
| `onPageChange`      | —          | Called when the page index changes (navigation, reanchoring, clamping).                                                   |
| `onStateChange`     | —          | Called with every new state, e.g. to show a "5 new items" banner from `pendingCount`.                                     |
| `messages`          | English    | Screen-reader announcements: `page(info)` and `newItems(count)`.                                                          |

Built-in presets (CSS px):

| Preset    | `minCardWidth` | `gap` | `rowHeight` |
| --------- | -------------- | ----- | ----------- |
| `compact` | 200            | 8     | 96          |
| `normal`  | 280            | 12    | 160         |
| `large`   | 360            | 16    | 240         |

## State (`ItemsGridState<T>`)

`geometry` (`{ cols, rows, pageSize, rowHeight, gap }` or `null` before measuring),
`pageIndex`, `pageCount`, `pageSize`, `total`, `range` (`{ start, end }`), `items` (the cards
to render), `loading`, `skeletonCount`, `isEmpty`, `frozen`, `pendingCount`, `canPrev`,
`canNext`, `align`, `probeItem`, `announcement`.

## Realtime

- **Live** (default): the page number stays and the page shows the current slice, so cards
  shift across page boundaries; if the page disappears it clamps to the last one.
- **Stable**: the page keeps its cards (their latest objects, so status updates still render);
  removed cards leave the page short; new items are counted in `pendingCount`. Navigating,
  resizing, changing preset or calling `refresh()` shows the current data.
- In server mode, stable means the grid does not re-request when `total` changes;
  `pendingCount` is the growth since the page was shown.

## The controller

`new ItemsGridController(options)` is the plain model every adapter wraps:
`setOptions`, `setViewportSize`, `setMeasuredRowHeight`, `goTo`, `next`, `prev`, `first`,
`last`, `refresh`, `handleKeydown` (PageUp / PageDown), `getState`, `subscribe`, `destroy`.
It touches no DOM. Helpers for adapters: `observeSize` (ResizeObserver, one report per
animation frame), `getViewportStyle` and friends (the inline layout styles),
`ITEMS_GRID_CLASSES`, `getPagerItems`, `DEFAULT_PAGER_LABELS`.

## Accessibility

The viewport is a `role="list"` of `role="listitem"` cells, `aria-busy` while loading. A
polite live region announces "Page 3 of 10, items 25–36 of 120" after the page changes and
"5 new items" in stable mode. PageUp / PageDown page while focus is inside the grid. The
pager uses real buttons with labels and `aria-current="page"`.

## Styling

Layout is applied inline; no stylesheet is required. `@quietfoundry/items-grid-core/styles.css`
is an optional, minimal pager theme driven by `--qf-items-grid-*` custom properties. Class
hooks: `qf-items-grid`, `qf-items-grid__viewport`, `__cell`, `__cell--skeleton`, `__empty`,
`__probe`, `__live`, `qf-items-grid-pager`, `__status`, `__list`, `__button`, `__gap`.

## License

MIT

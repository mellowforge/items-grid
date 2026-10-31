# @mellowforge/items-grid-core

Headless engine for **card grids that fit the screen exactly**. Give it a container and your
items, and it decides how many cards fit — full rows and columns only, no inner scrolling —
and pages the rest. Zero dependencies, framework-agnostic, SSR-safe.

Use it directly (vanilla `mountItemsGrid`), or through
[`@mellowforge/items-grid-react`](../react/README.md) or
[`@mellowforge/items-grid-angular`](../angular/projects/items-grid/README.md).

```sh
npm install @mellowforge/items-grid-core
```

## What it solves

- **Consistent row height.** Every card in a grid gets the same row height: a fixed one per
  size preset, or one measured from a sample card (re-measured when that card resizes).
- **Exact fit + pagination.** Recomputed on every resize; the first card of the page stays
  on screen instead of jumping to page 1:

  ```text
  cols     = max(1, floor((width  + gap) / (minCardWidth + gap)))   capped by maxColumns
  rows     = max(1, floor((height + gap) / (rowHeight    + gap)))
  pageSize = cols × rows                                             capped by maxPageSize
  ```

  At least one row is always shown, even when the viewport is shorter than a row (the row
  is then clipped).

- **Size presets.** `compact`, `normal`, `large` (or your own), one per grid.
- **Client or server paging**, **live or stable realtime reflow**, **per-slot skeletons**,
  an empty state and an optional, unstyled pager.

## Quick start (vanilla)

```ts
import { mountItemsGrid } from '@mellowforge/items-grid-core';
import '@mellowforge/items-grid-core/styles.css'; // optional pager theme

const grid = mountItemsGrid(document.querySelector<HTMLElement>('#devices')!, {
  items: devices,
  getKey: device => device.id,
  preset: 'compact',
  renderItem: device => createDeviceCard(device),
  updateItem: (card, device) => patchDeviceCard(card, device), // optional, keeps card DOM
  renderSkeleton: () => createSkeletonCard(),
  renderEmpty: () => createEmptyState(),
});

grid.update({ items: nextDevices }); // realtime updates (replace the array, don't mutate it)
grid.controller.next(); // imperative paging
grid.destroy();
```

> **Layout requirement:** the container needs a definite height from your layout — e.g.
> `flex: 1; min-height: 0` in a column flexbox, or `height: 100%`. The grid fills exactly
> that box. Put toolbars and banners _outside_ it; the built-in pager sits inside the host
> but outside the measured viewport, so it never needs a hard-coded offset.

## Options (`ItemsGridOptions<T>`)

Invalid values throw an `items-grid:` error naming the field, and the previous options stay
in place (for `mountItemsGrid().update()` too). Checked: `getKey`, `items` (an array),
`mode`, `reflow`, `align`, `total`, `pageIndex` (a number ≥ 0; fractions are floored),
`maxColumns`, `maxPageSize`, `requestDebounceMs`, `messages` and the preset values. In the
adapters the error surfaces where they push options: an error boundary in React, Angular's
`ErrorHandler`. The same holds when app code throws while the grid updates (e.g. a throwing
`getKey` or `messages.page`): `setOptions`, `goTo`, `refresh()`, `setViewportSize` and
`setMeasuredRowHeight` apply completely or not at all.

| Option              | Default    | Description                                                                                                                                                                         |
| ------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getKey`            | —          | **Required.** Stable, unique identity of an item (also as a string); must not depend on its position. Duplicates on the visible page are warned about once per key.                 |
| `items`             | `[]`       | Client mode: the whole dataset. Server mode: the current page. Compared by identity — replace it to update.                                                                         |
| `mode`              | `'client'` | `'client'` slices `items`; `'server'` asks for pages through `onPageRequest`.                                                                                                       |
| `total`             | —          | Server mode: dataset size. `undefined` / `null` means unknown: the page is never clamped, `canNext` is true while pages come back full, and `state.totalKnown` is false.            |
| `preset`            | `'normal'` | Name of the active preset.                                                                                                                                                          |
| `presets`           | built-ins  | `Record<string, SizePreset>`: `{ minCardWidth, gap, rowHeight, maxColumns?, maxPageSize? }`. Memoize it in frameworks; it is compared by identity.                                  |
| `measureRowHeight`  | `false`    | Measure the row height from a hidden probe card (`sampleItem`, or the first item) instead of using the preset's; re-measured whenever the probe resizes.                            |
| `sampleItem`        | —          | The item rendered in the probe.                                                                                                                                                     |
| `maxColumns`        | —          | Caps columns (overrides the preset); an integer ≥ 1.                                                                                                                                |
| `maxPageSize`       | —          | Caps cards per page; rows are reduced first, then columns (overrides the preset); an integer ≥ 1.                                                                                   |
| `reflow`            | `'live'`   | `'live'` or `'stable'` — see [Realtime](#realtime).                                                                                                                                 |
| `align`             | `'start'`  | Leftover height below the rows (`'start'`) or split above and below (`'center'`). Never changes the page size.                                                                      |
| `loading`           | `false`    | The app is fetching; renderers show one skeleton per slot when given a skeleton renderer. In server mode set it in the same tick as `onPageRequest`.                                |
| `pageIndex`         | `0`        | Zero-based page. Read at construction; afterwards a changed value navigates there, an unchanged one is ignored.                                                                     |
| `requestDebounceMs` | `150`      | Server mode: delay before requesting after a page-size change (resize, preset, measured row height…), so a drag-resize sends one request. Navigation and `refresh()` are immediate. |
| `onPageRequest`     | —          | Server mode: `({ pageIndex, pageSize }) => void`. Respond by updating `items` and `total`.                                                                                          |
| `onPageChange`      | —          | Called when the page index changes: navigation, reanchoring after a resize or re-show, and clamping (also on the first layout).                                                     |
| `onStateChange`     | —          | Called with every new state (not the constructor's), e.g. to show a "5 new items" banner from `pendingCount`.                                                                       |
| `messages`          | English    | Screen-reader announcements: `page(info)` and `newItems(count)`.                                                                                                                    |

Built-in presets (CSS px):

| Preset    | `minCardWidth` | `gap` | `rowHeight` |
| --------- | -------------- | ----- | ----------- |
| `compact` | 200            | 8     | 96          |
| `normal`  | 280            | 12    | 160         |
| `large`   | 360            | 16    | 240         |

## State (`ItemsGridState<T>`)

A frozen object, replaced on every change: `geometry` (`{ cols, rows, pageSize, rowHeight,
gap }`, or `null` before measuring and while hidden), `pageIndex`, `pageCount` (pages known
so far), `pageSize`, `total`, `totalKnown`, `range` (`{ start, end }`, where `start` is
`pageIndex × pageSize`), `items` (the cards to render), `loading`, `skeletonCount`, `isEmpty`,
`frozen`, `pendingCount`, `canPrev`, `canNext`, `align`, `probeItem`, `announcement`.

## Server mode

The app owns the data: on `onPageRequest({ pageIndex, pageSize })`, set `loading`, fetch,
then pass the page as `items` and the dataset size as `total` (or leave `total` unknown).
Guard against out-of-order responses. On a failed fetch, clear `loading` and the page's
`items` (so the previous page never shows under the new page's numbers), and retry with
`refresh()` — navigating to the same page again does not re-request it. If `onPageRequest`
itself throws, the grid does not re-send that request on its own (even when the callback had
already set `loading`); navigating to the page or `refresh()` retries it. With a known total,
`range` follows `total`, not the length of `items`; while the total is unknown, emptiness is
only reported once you pass `total: 0`.

## Realtime

- **Live** (default): the page number stays and the page shows the current slice, so cards
  shift across page boundaries; if the page disappears it clamps to the last one (in server
  mode that clamp requests the new page).
- **Stable**, client mode: the page keeps its cards (their latest objects, so status
  updates still render); removed cards leave the page short; new items are counted in
  `pendingCount`. Navigation, a page-size change (resize, preset) or `refresh()` shows the
  current data; when every frozen card is gone the page re-freezes on its own.
- **Stable**, server mode: the app still owns the page's `items`; stable means the page is
  never clamped when `total` changes, and `pendingCount` is the growth of `total` since the
  page was shown.

## The controller

`new ItemsGridController(options)` is the plain model every adapter wraps: `setOptions`,
`setViewportSize`, `setMeasuredRowHeight`, plus the navigation and state members of
`ItemsGridHandle` — `goTo`, `next`, `prev`, `first`, `last`, `refresh`, `handleKeydown`
(PageUp / PageDown), `getState`, `subscribe` — which are bound, so `onClick={grid.next}`
works. It touches no DOM. Apps get only the `ItemsGridHandle` from the adapters (and from
`mountItemsGrid().controller`).

Helpers for adapters: `observeSize` (ResizeObserver, one report per animation frame; warns
once per page load where ResizeObserver is missing, e.g. jsdom tests), `getViewportStyle` and
friends (the inline layout styles), `shouldPageGrid` and `isEditableTarget`,
`ITEMS_GRID_CLASSES`, `getPagerItems`, `resolvePagerLabels`, `DEFAULT_PAGER_LABELS`.

After `destroy()`, the vanilla mount's handle ignores calls (warning once) and `update()`
throws.

## Accessibility

The viewport is a `role="list"` of `role="listitem"` cells (no list role while it shows the
empty state), `aria-busy` while loading. A polite live region announces "Page 3 of 10, items
25–36 of 120" after the page changes and "5 new items" in stable mode. PageUp / PageDown page
while focus is inside a card, except in text fields, selects and contenteditable regions
(also inside shadow roots), and except when the card already handled the key. The pager
uses real buttons with labels and `aria-current="page"`.

## Styling

Layout is applied inline; no stylesheet is required. `@mellowforge/items-grid-core/styles.css`
is an optional, minimal pager theme. Theme it with `--mf-items-grid-*` custom properties set
anywhere up the tree (e.g. `:root`); every value has a fallback, so the pager also works when
placed outside the grid. Class hooks: `mf-items-grid`, `mf-items-grid__viewport`, `__cell`,
`__cell--skeleton`, `__empty`, `__probe`, `__live`, `mf-items-grid-pager`, `__status`,
`__list`, `__button`, `__gap`.

## License

MIT

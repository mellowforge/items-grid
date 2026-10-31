---
'@mellowforge/items-grid-core': minor
'@mellowforge/items-grid-react': minor
'@mellowforge/items-grid-angular': minor
---

First release: card grids that fit the screen exactly. Size presets (compact, normal, large or custom) with `maxColumns` and `maxPageSize`, fixed or measured row height, client or server paging, live or stable realtime reflow with a pending-items count, per-slot skeletons, an empty state, top or centred alignment and an optional pager — as a headless core with a vanilla mount, a React component and an Angular component. Apps get an `ItemsGridHandle` for navigation, unknown server totals are supported (`totalKnown`), PageUp/PageDown page the grid with screen-reader announcements, and invalid options throw `items-grid:` errors without changing anything. When app code (`getKey`, `messages`) throws while the grid works out a new page, `setOptions`, `goTo` and `refresh()` change nothing, and viewport and row-height reports keep the page (but not a stale size); a request whose `onPageRequest` threw does not count as sent, so the next update asks again once. The React adapter renders on the server without layout-effect warnings, and the optional pager theme follows the page's `color-scheme` (dark mode with no setup).

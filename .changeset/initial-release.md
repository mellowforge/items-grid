---
'@mellowforge/items-grid-core': minor
'@mellowforge/items-grid-react': minor
'@mellowforge/items-grid-angular': minor
---

First release: card grids that fit the screen exactly. Size presets (compact, normal, large or custom) with `maxColumns` and `maxPageSize`, fixed or measured row height, client or server paging, live or stable realtime reflow with a pending-items count, per-slot skeletons, an empty state, top or centred alignment and an optional pager — as a headless core with a vanilla mount, a React component and an Angular component. Apps get an `ItemsGridHandle` for navigation, unknown server totals are supported (`totalKnown`), PageUp/PageDown page the grid with screen-reader announcements, and invalid options throw `items-grid:` errors without changing anything. Updates are all-or-nothing: when app code (`getKey`, `messages`) throws during `setOptions`, `goTo`, `refresh()` or a viewport or row-height report, the grid keeps its previous inputs; a page whose `onPageRequest` threw is not re-sent until the app navigates to it or calls `refresh()`. The React adapter renders on the server without layout-effect warnings.

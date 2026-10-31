# Backlog

Deferred work, with the reason it was deferred.

- **Rename the repo folder** `actions-grid` → `items-grid` (user will do it). The package URLs already point to `github.com/Constantine-24/items-grid`.
- **Isomorphic layout effect in the React adapter** — `useItemsGrid` uses `useLayoutEffect`, which warns under React 18 server rendering (e.g. Next.js client components). Harmless in the browser, but the packages advertise SSR safety; switch to a `useIsomorphicLayoutEffect`.
- **Custom pager parity** — React's `pager` prop also takes a render function; Angular uses `[pager]="false"` plus a standalone `<mf-items-grid-pager>` instead (same capability, different shape). Revisit if Angular users ask for an in-grid template slot.
- **Roll back navigation inputs too** — only `setOptions` (and vanilla `update()`) are all-or-nothing. `goTo`, `setViewportSize` and `refresh` set the page / viewport before a sync that can still throw from app code (`getKey`, `messages.page`); the next sync then starts from that half-applied input.
- **Retry after a throwing onPageRequest** — if `onPageRequest` updates the grid (e.g. sets `loading`) and then throws, the request it left owed is re-sent once, debounced, and a second failure is only logged. Bounded, but the app didn't ask for it; consider skipping the re-send when it matches the request that just failed.
- **Dark theme** for the demos and the optional pager stylesheet.
- **`maxPageSize` per preset in the demos** — the option is implemented and tested but no demo control exposes it yet.
- **Arrow-key navigation between cards** — out of scope for v0 because cards contain their own controls; revisit with a roving-focus opt-in.
- **Lighthouse / axe pass** on the demos (pager contrast, focus order) with the chrome-devtools a11y skill.

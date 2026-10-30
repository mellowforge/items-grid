# CLAUDE.md

**items-grid** — card grids that fit the screen exactly. A headless, zero-dependency engine (`@quietfoundry/items-grid-core`, with a vanilla `mountItemsGrid`) plus thin adapters for React (`@quietfoundry/items-grid-react`) and Angular (`@quietfoundry/items-grid-angular`), published from this pnpm monorepo. Conventions mirror the sibling repo `treekit`.

Everything under `packages/` is public API: favour backwards compatibility, TSDoc and test coverage over cleverness, and keep the two adapters in parity. Use **context7** for Angular / React / Vite / Vitest / Changesets docs and **chrome-devtools** for checking layout in the demos — jsdom has no layout, so fit-to-screen behaviour is only proven in a browser.

Design history: Figma prototypes (presets × viewports, states, slack alignment) at `https://www.figma.com/design/fZ2yYLtFiO2N7aM0Ai97E4`, engine diagrams at `https://www.figma.com/board/gVi3M0uhf7sCApNT2bybFh`.

## Layout

```text
packages/core                     engine/ (pure: layout, paging, presets, freeze) · controller.ts · pager.ts · dom/ (observe, keyboard, styles, vanilla) · styles/
packages/react                    useItemsGrid · <ItemsGrid> · <ItemsGridPager>
packages/angular                  Angular CLI workspace; library at projects/items-grid
apps/demo-shared                  fixtures, simulation, fake API, shared demo.css (source-only)
apps/demo-vanilla                 consumes core from dist — the published-layout proof
apps/demo-react, apps/demo-angular  source-linked mirrors of each other
```

## Commands

- `pnpm build` (core → react → angular → apps), `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm pack:check`.
- Scoped: `pnpm --filter @quietfoundry/items-grid-core exec vitest run src/controller.spec.ts -t '<name>'`; Angular: `cd packages/angular && pnpm ng test --watch=false`.
- Adapters, `demo-vanilla` and the Angular library resolve core from `packages/core/dist` — **build core first** after changing it.

## Architecture invariants

- **The core stays headless**: no framework imports, no runtime dependencies. `engine/` is pure; `ItemsGridController` touches no DOM (SSR-safe). Only `dom/` uses browser APIs.
- **Geometry is the single source of truth**: `computeGeometry` returns `null` until measured (never a page size of 0); views apply `getViewportStyle(state)` inline so layout never depends on a stylesheet. The viewport's height must come from its host, never from its content.
- **Grid only**: no card markup or card styles ship from `packages/`. Sample cards live in `apps/`.
- **Identity**: `getKey(item)` takes no index; card DOM is keyed by it in every renderer.
- **Anchor**: resizes and preset changes reanchor on the index of the first card at the last navigation; the anchor survives the viewport being hidden.
- **Server mode**: an unknown `total` (`undefined`/`null`) never clamps the page and `canNext` follows full pages; page-size-driven requests are debounced, navigation, `refresh()` and entering server mode are immediate, identical requests are deduplicated, and a mode switch forgets the last request.
- **Inputs fail loudly**: invalid options throw an `items-grid:` error and nothing is stored (`setOptions` and vanilla `update()` are all-or-nothing); misuse that cannot throw warns: duplicate keys once per key per grid, a missing Angular item template once per grid, no ResizeObserver once per page load.
- **Effects are ordered**: subscribers see a state before its page request and `onPageChange`; a callback that syncs again makes the outer effects stale, and they are skipped. Errors from subscribers and effects are collected, the first rethrown.
- **Apps get `ItemsGridHandle`**, never the full controller with its setters.
- **Controller lifecycle**: `destroy()` must stay reversible (React StrictMode re-subscribes). The constructor never reports state through `onStateChange`.
- **React**: callbacks via a latest-value ref (inline arrows are free — don't add `useCallback`); options are pushed in layout effects, never during render; React 18 and 19 peers, so no React-19-only APIs in the library.
- **Angular**: signal inputs/outputs, zoneless; a `_version` signal bridges the controller; observers attach in effects with `onCleanup`.

## Workflow

- TDD: write the failing spec, watch it fail for the right reason, then implement. A new adapter scenario goes into **both** adapter specs.
- User-visible package changes need a changeset (packages are versioned together) and README updates.
- Run the review gate in `.claude/rules/review-gate.md` per chunk. Deferred work goes to `BACKLOG.md`.
- Never publish to npm or push tags; never commit to `main` directly.

@.claude/rules/review-gate.md

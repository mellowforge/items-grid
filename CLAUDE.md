# CLAUDE.md

**items-grid** — card grids that fit the screen exactly. A headless, zero-dependency engine (`@mellowforge/items-grid-core`, with a vanilla `mountItemsGrid`) plus thin adapters for React (`@mellowforge/items-grid-react`) and Angular (`@mellowforge/items-grid-angular`), published from this pnpm monorepo. Conventions mirror the sibling repo `treekit`.

Everything under `packages/` is public API: favour backwards compatibility, TSDoc and test coverage over cleverness, and keep the two adapters in parity. Use **context7** for Angular / React / Vite / Vitest / Changesets docs and **chrome-devtools** for checking layout in the demos — jsdom has no layout, so fit-to-screen behaviour is only proven in a browser.

Design history: Figma prototypes (presets × viewports, states, slack alignment) at `https://www.figma.com/design/fZ2yYLtFiO2N7aM0Ai97E4`, engine diagrams at `https://www.figma.com/board/gVi3M0uhf7sCApNT2bybFh`.

## Layout

```text
packages/core                     engine/ (pure: layout, paging, presets, freeze, navigation) · controller.ts · pager.ts · dom/ (observe, keyboard, card-navigation, styles, vanilla) · styles/
packages/react                    useItemsGrid · <ItemsGrid> · <ItemsGridPager>
packages/angular                  Angular CLI workspace; library at projects/items-grid
apps/site                         landing page (React, source-linked); deployed with the demos to GitHub Pages
apps/demo-shared                  fixtures, simulation, fake API, theme toggle helpers, shared demo.css (source-only)
apps/demo-vanilla                 consumes core from dist — the published-layout proof
apps/demo-react, apps/demo-angular  source-linked mirrors of each other
```

## Commands

- `pnpm build` (core → react → angular → apps), `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm pack:check`, `pnpm test:hooks`, `pnpm build:pages` (landing page + demos into `_site/` under `/items-grid/`; `.github/workflows/pages.yml` deploys it on every push to `main`).
- Scoped: `pnpm --filter @mellowforge/items-grid-core exec vitest run src/controller.spec.ts -t '<name>'`; Angular: `cd packages/angular && pnpm ng test --watch=false` (one spec: `--include lib/items-grid.spec.ts`, relative to the library source root).
- Adapters, `demo-vanilla` and the Angular library resolve core from `packages/core/dist` — **build core first** after changing it.

## Architecture invariants

- **The core stays headless**: no framework imports, no runtime dependencies. `engine/` is pure; `ItemsGridController` touches no DOM (SSR-safe). Only `dom/` uses browser APIs.
- **Geometry is the single source of truth**: `computeGeometry` returns `null` until measured (never a page size of 0); views apply `getViewportStyle(state)` inline so layout never depends on a stylesheet. The viewport's height must come from its host, never from its content. The pager sits below the viewport, so its height must not depend on its content either (one line, the status truncates — `styles/items-grid.css.spec.ts`): its width follows the page size, and a wrapping pager made the grid flip between two page sizes every frame.
- **Grid only**: no card markup or card styles ship from `packages/`. Sample cards live in `apps/`.
- **Identity**: `getKey(item)` takes no index; card DOM is keyed by it in every renderer.
- **Anchor**: resizes and preset changes reanchor on the index of the first card at the last navigation; the anchor survives the viewport being hidden.
- **Server mode**: an unknown `total` (`undefined`/`null`) never clamps the page and `canNext` follows full pages; page-size-driven requests are debounced, navigation, `refresh()` and entering server mode are immediate, identical requests are deduplicated, and a mode switch forgets the last request.
- **Inputs fail loudly**: invalid options throw an `items-grid:` error and nothing is stored (`setOptions` and vanilla `update()` are all-or-nothing); app code throwing mid-update (`getKey`, `messages`) rolls back the options and paging bookkeeping through `_apply`/`_checkpoint` (`setOptions`, `goTo`, `refresh`, `setViewportSize`, `setMeasuredRowHeight`) — never the measurements, because observers don't re-report an unchanged size; misuse that cannot throw warns: duplicate keys once per key per grid, a missing Angular item template once per grid, no ResizeObserver once per page load.
- **Effects are re-entrancy-safe**: subscribers see a state before its page request and `onPageChange`. The controller keeps the owed request and the last reported page itself; only the outermost sync delivers them, looping from the current state until nothing is owed (callbacks that sync again — even `onPageRequest` navigating — just add to the loop), so effects can't be dropped, reordered or reported stale. `destroy()` clears what is owed and stops the notification loop. A throwing `onPageRequest` doesn't count as sent: the next update re-requests it once, debounced (in React and Angular a `loading` set inside the callback arrives as that next update anyway, so suppressing the retry would only work in vanilla). Callbacks that never settle (e.g. `onPageRequest` calling `refresh()`) are cut off after 100 rounds with an `items-grid:` error instead of hanging. Errors from subscribers and effects are collected with their source; the first is rethrown, the rest logged.
- **Arrow keys are one shared DOM helper**: `attachCardNavigation` (`dom/card-navigation.ts`) owns the roving `tabindex`, the keys and focus-follow for all three renderers, which only attach/detach it for `arrowKeys` (an adapter-level option like `pager`, not a controller option). It finds cards as the viewport's `role="listitem"` children through a `MutationObserver`, never touches card markup, handles arrows / Home / End only when the cell itself has focus and Escape only from a control inside a card, and ignores modified keys, IME composition and keys a card already `preventDefault()`ed. React passes `listenToKeys: false` and calls `handleKeydown` from its synthetic `onKeyDown`, because React runs card handlers after native viewport listeners. Focus-follow is one rule, independent of what changed the page: when the focused card leaves the DOM, focus moves to the card now at the same offset (an arrow that crossed a page focuses that move's target instead); a card the renderer only moved (in the mutation records' `removedNodes` but back in the list) gets focus back on the element inside it that had it; focus the user moved elsewhere is never pulled back — a focusout to an outside element, a blur while the element stays connected, or the focused control vanishing from a card that stays (the observer watches the subtree for this). "Focus dropped" is asked of the document, never of a shadow root (which reports no active element while focus is outside it).
- **Apps get `ItemsGridHandle`**, never the full controller with its setters.
- **Controller lifecycle**: `destroy()` must stay reversible (React StrictMode re-subscribes). The constructor never reports state through `onStateChange`.
- **React**: callbacks via a latest-value ref (inline arrows are free — don't add `useCallback`); options are pushed in layout effects, never during render; React 18 and 19 peers, so no React-19-only APIs in the library; layout effects go through `useIsomorphicLayoutEffect` (React 18 warns about them on the server, `ssr.spec.tsx`).
- **Angular**: signal inputs/outputs, zoneless; a `_version` signal bridges the controller; observers attach in effects with `onCleanup`. SSR-safe without a guard: effects do run on the server, but `observeSize` is a silent no-op where `window`/`ResizeObserver` is missing, and the template warning uses `afterNextRender` (browser-only).

## Workflow

- TDD: write the failing spec, watch it fail for the right reason, then implement. A new adapter scenario goes into **both** adapter specs.
- User-visible package changes need a changeset (packages are versioned together) and README updates.
- Run the review gate in `.claude/rules/review-gate.md` per chunk. Deferred work goes to `BACKLOG.md`.
- Never publish to npm or push tags; never commit to `main` directly. `main` is protected by the "Protect main" ruleset (pull request, linear history, the CI check `Format, build, lint, test, package`, no force-push or deletion): push the chunk's branch, `gh pr create`, wait for CI, then `gh pr merge --rebase --delete-branch`. Admins may bypass only through a pull request — that is how the Version Packages PR, which gets no CI, is merged. `.claude/hooks/block-raw-tooling.js` blocks publishing, tag pushes, npm installs, yarn and direct `vitest` in the Angular workspace (tests: `pnpm test:hooks`). Releases: `.claude/rules/release.md`.

@.claude/rules/review-gate.md

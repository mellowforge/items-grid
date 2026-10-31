# Contributing

Thanks for your interest in improving **items-grid**! Bug reports, docs fixes and pull requests are all welcome.

## Getting started

```bash
git clone https://github.com/mellowforge/items-grid.git
cd items-grid
nvm use               # Node version from .nvmrc
corepack enable       # pnpm version from package.json "packageManager"
pnpm install
pnpm build            # core → react → angular → apps
```

Then run whichever app you're working against. All of them except `demo-vanilla` use the library **sources** live, so edits hot-reload without a rebuild:

```bash
pnpm --filter site dev            # landing page
pnpm --filter demo-react dev      # React demo
pnpm --filter demo-angular start  # Angular demo
pnpm --filter @mellowforge/items-grid-core build && pnpm --filter demo-vanilla dev
                                  # vanilla demo, built against the published package layout
```

The three demos are mirrors of each other: density, client/server, live/stable, top/center, max page size, arrow keys and realtime switches over the same 120 sample entities.

## Project layout

| Path                                     | What                                                                                      |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| `packages/core/`                         | `@mellowforge/items-grid-core` — the headless, zero-dependency engine and vanilla mount   |
| `packages/react/`                        | `@mellowforge/items-grid-react` — the React adapter                                       |
| `packages/angular/projects/items-grid`   | `@mellowforge/items-grid-angular` — the Angular adapter (inside an Angular CLI workspace) |
| `apps/site/`                             | The landing page, deployed to GitHub Pages with the demos                                 |
| `apps/demo-react/`, `apps/demo-angular/` | Mirrored demos (shared fixtures, simulation and styles in `apps/demo-shared/`)            |
| `apps/demo-vanilla/`                     | Plain-DOM usage of the core, built against the published package layout                   |
| `CLAUDE.md`, `.claude/rules/`            | Architecture invariants and engineering rules — they apply to humans too                  |

## Development loop

```bash
pnpm --filter @mellowforge/items-grid-core exec vitest run src/controller.spec.ts   # scoped core tests
pnpm --filter @mellowforge/items-grid-react exec vitest run                         # React adapter tests
(cd packages/angular && pnpm ng test --watch=false --include lib/items-grid.spec.ts) # Angular adapter tests
pnpm test            # everything
pnpm lint            # ESLint (Angular through angular-eslint, inline templates included)
pnpm typecheck
pnpm format          # Prettier
pnpm pack:check      # pack each package and verify its tarball and type resolution
pnpm build:pages     # the GitHub Pages site into _site/ (landing page + three demos)
```

Adapters, `demo-vanilla` and the Angular library resolve core from `packages/core/dist` — build core first after changing it.

## Pull requests

1. Open an issue first for anything beyond a small fix, so we can agree on the API.
2. Branch from `main` (`feat/…`, `fix/…`, `docs/…`).
3. Write a failing test first. A change to one adapter comes with the same change — and the same spec — in the other.
4. Keep the exact fit: no partial row, no scrolling viewport, no height derived from content. jsdom has no layout, so check it in a demo in a real browser.
5. Keep the accessibility contract: list semantics, the polite live region, the labelled pager, PageUp / PageDown and arrow keys, WCAG AA contrast in light and dark.
6. Add a changeset (`pnpm changeset`) for any user-visible change to a published package, and update the READMEs.
7. Use [Conventional Commits](https://www.conventionalcommits.org/) (`fix(core): …`, `feat(react): …`).

CI must be green (format, build, lint, typecheck, tests, package check, Pages build) before merge.

## Releases

Releases are automated with [Changesets](https://github.com/changesets/changesets): merged changesets accumulate in a "Version Packages" PR, and merging that PR publishes to npm with provenance through trusted publishing. See [`.claude/rules/release.md`](.claude/rules/release.md).

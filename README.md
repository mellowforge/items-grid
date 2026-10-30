# items-grid

**Card grids that fit the screen exactly.** A reusable layout and paging engine for grids of
entity cards — devices, jobs, services, accounts — with a React and an Angular adapter.

It moves the code every dashboard keeps re-implementing into one place:

- **Consistent row height** — fixed per size preset, or measured from a sample card.
- **Exact fit and pagination** — as many full rows and columns as fit the container
  (`cols × rows`), the rest on other pages, recomputed on resize while keeping the first card
  of the page on screen.
- **Size presets** — `compact`, `normal`, `large` (or your own), with `maxColumns` and
  `maxPageSize` caps.
- **Client or server paging**, **live or stable realtime reflow** (with a "N new items"
  count), **per-slot skeletons**, an **empty state** and an optional, unstyled **pager**.
- **Grid only.** You render the cards; the library never ships card markup.

| Package                                                                              | Description                                |
| ------------------------------------------------------------------------------------ | ------------------------------------------ |
| [`@quietfoundry/items-grid-core`](packages/core/README.md)                           | Headless engine + vanilla `mountItemsGrid` |
| [`@quietfoundry/items-grid-react`](packages/react/README.md)                         | `<ItemsGrid>`, `useItemsGrid`              |
| [`@quietfoundry/items-grid-angular`](packages/angular/projects/items-grid/README.md) | `<qf-items-grid>` with template directives |

## How it fits

```text
cols     = max(1, floor((width  + gap) / (minCardWidth + gap)))
rows     = max(1, floor((height + gap) / (rowHeight    + gap)))
pageSize = cols × rows            (cols capped by maxColumns; maxPageSize trims rows, then cols)
```

The grid measures only its own viewport, so the host needs a **definite height** from your
layout (e.g. `flex: 1; min-height: 0`). Toolbars and banners go outside it. The layout is
CSS Grid with JS-computed tracks — the last row stays aligned and the page count is exact.

## Demos

```sh
pnpm install
pnpm --filter @quietfoundry/items-grid-core build   # demo-vanilla consumes the built core
pnpm --filter demo-vanilla dev                      # plain DOM, published package layout
pnpm --filter demo-react dev                        # React, source-linked
pnpm --filter demo-angular start                    # Angular, source-linked
```

Each demo has density, client/server, live/stable, top/center and realtime switches over the
same 120 sample entities from the Figma prototypes.

## Development

```sh
pnpm build       # core → react → angular → apps
pnpm test        # Vitest everywhere (Angular through ng test)
pnpm lint
pnpm typecheck
pnpm pack:check  # pack each package and verify its tarball and type resolution
```

Releases use [Changesets](https://github.com/changesets/changesets); the three packages are
versioned together.

## License

MIT

# site

The landing page, deployed with the three demos to <https://mellowforge.github.io/items-grid/> by `.github/workflows/pages.yml` (`pnpm build:pages`). Run it with `pnpm --filter site dev`.

Its code examples live in `src/examples/` and are shown on the page verbatim — keep them in step with the root README's quick start. The React and vanilla examples are type-checked; the Angular one needs the Angular compiler, so it is checked by eye.

The hero is a live `<ItemsGrid>` in a resizable frame; colours, cards and badges come from `demo-shared/demo.css`, and the light/dark choice (`demo-shared` `theme.ts`) carries over to the demos.

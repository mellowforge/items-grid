# Release

Three packages are published to npm by **Changesets** from `.github/workflows/release.yml`: `@mellowforge/items-grid-core`, `@mellowforge/items-grid-react` and `@mellowforge/items-grid-angular`. The code lives at `github.com/Constantine-24/items-grid`, and the npm scope is `@mellowforge`. Pushing to `main` opens or updates a "Version Packages" PR that bumps versions and writes each package's `CHANGELOG.md`; merging that PR publishes. Auth is **npm trusted publishing (OIDC)** with provenance, so no npm token is stored in the repository. The root `package.json` and every app are private and never published.

## Changesets

- **Add a changeset** for every user-visible change to a published package: run `pnpm changeset`. Use one changeset per logical change and name every affected package. Write it for consumers: what changed and what they must do.
- **Semver before 1.0:**
  - A breaking change to public API or behaviour is a **minor** bump, with a "Breaking changes" list and migration notes.
  - Features are minor; fixes are patch.
  - From 1.0 on, breaking changes are major.
- **The three packages are versioned in lockstep** (`fixed` in `.changeset/config.json`), so users only ever need "the same version of every `@mellowforge/items-grid-*` package". A changeset still names only the packages that changed. Their CHANGELOGs get the entry; the others only get the new version.
- **Keep the adapters' peer range on core at `workspace:0.x`** (published as `0.x`), together with `onlyUpdatePeerDependentsWhenOutOfRange`. Don't change it back to `workspace:^`. Before 1.0, `^0.1.0` excludes `0.2.0`, and Changesets answers an outdated peer range with a **major** bump of the dependents, so every core minor would push all packages (through `fixed`) to 1.0.0.
  - After touching the config, run `pnpm changeset status --verbose` and check the planned versions.
  - At 1.0 the range becomes `workspace:^`.
- **Private workspace packages** (the apps, `demo-shared`, the Angular workspace) are never versioned (`privatePackages: { version: false, tag: false }`).
- **Peer ranges** (`@angular/core`, `@angular/common`, `react`, `react-dom`) change only deliberately, with a note in the changeset.

## Publishing

- **Agents never publish.** Never run `changeset publish`, `pnpm publish`, `npm publish` or `pnpm release`, and never push tags. `.claude/hooks/block-raw-tooling.js` blocks the publish commands. Releases happen only by merging the Version Packages PR.
- **Check the tarballs before a release PR merges.** Run all gates and `pnpm pack:check`, then read the tarball lists. Each tarball must have:
  - `package.json`, `README.md`, `LICENSE` and `dist/` (with `.d.ts`);
  - no `src/`, no specs and no `workspace:` specifiers.

  `@mellowforge/items-grid-core` also ships `dist/styles.css`.

- **Each package directory carries a `LICENSE`** that is a byte-identical copy of the root `LICENSE`, because npm only packs files from inside the package. CI compares them with `cmp`.
- **The Angular package is published from `packages/angular/dist/items-grid`** (`publishConfig.directory`). pnpm rewrites the `workspace:` ranges there at pack time. `pnpm pack:check` proves it and also runs arethetypeswrong on every tarball.
- **The Version Packages PR shows no CI checks.** It is opened with `GITHUB_TOKEN`, and GitHub does not trigger other workflows from that token's pushes. To compensate, `pnpm release` re-runs the build, tests and `pack:check` before publishing. To get real checks on the PR, give `changesets/action` a fine-grained PAT instead.

## First publish and trusted publishing (maintainer)

npm trusted publishers are configured per **existing** package, so the first version of each package cannot come from OIDC:

1. **Create the npm org.** The `@mellowforge` scope must exist on npm, and the maintainer must be allowed to publish to it.
2. **Publish the first version by hand.** Do this locally, on an up-to-date `main` after the Version Packages PR has merged. Run `npm login`, then `pnpm build && pnpm changeset publish`. The maintainer runs this; agents never do.
3. **Add the trusted publisher.** On npmjs.com, open each package's Settings → Trusted Publisher and set:
   - GitHub owner `Constantine-24`
   - repository `items-grid`
   - workflow `release.yml`
   - no environment
   - allow `npm publish`
4. **Check provenance.** From then on, `release.yml` publishes through OIDC with provenance (`NPM_CONFIG_PROVENANCE`). After the first OIDC release, check that each npm page shows the provenance badge. If it doesn't, have `release.yml` write `provenance=true` to a CI-only `.npmrc` before publishing.

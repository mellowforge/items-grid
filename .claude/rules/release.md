# Release

Three packages are published to npm by **Changesets** from `.github/workflows/release.yml`: `@mellowforge/items-grid-core`, `@mellowforge/items-grid-react` and `@mellowforge/items-grid-angular`. The code lives at `github.com/mellowforge/items-grid`, and the npm scope is `@mellowforge`. Pushing to `main` opens or updates a "Version Packages" PR that bumps versions and writes each package's `CHANGELOG.md`; merging that PR publishes. Auth is **npm trusted publishing (OIDC)** with provenance, so no npm token is stored in the repository. The root `package.json` and every app are private and never published.

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

- **Agents never publish.** Never run `changeset publish`, `pnpm publish`, `npm publish` or `pnpm release`, and never push tags. `.claude/hooks/block-raw-tooling.js` blocks these in their common spellings (flags, runners, `sudo`, `bash -c '…'`; tested by `pnpm test:hooks`). A hook is a guard rail, not a sandbox: the real control is npm-side (step 5 below). Releases happen only by merging the Version Packages PR.
- **The release gates** are `pnpm format:check && pnpm build && pnpm lint && pnpm typecheck && pnpm test && pnpm test:hooks && pnpm pack:check`. `pnpm release` runs all of them before `changeset publish`.
- **Check the tarballs before a release PR merges.** Run the gates, then read the tarball lists that `pnpm pack:check` prints. Each tarball must have `package.json`, `README.md` and `LICENSE`, and no `src/`, no specs and no `workspace:` specifiers. Besides those:
  - `@mellowforge/items-grid-core` and `@mellowforge/items-grid-react`: `dist/` with the ESM and CJS builds and `.d.ts`; core also ships `dist/styles.css`.
  - `@mellowforge/items-grid-angular`: `fesm2022/` and `types/` (with `.d.ts`); there is no `dist/` inside this tarball.
- **Each package directory carries a `LICENSE`** that is a byte-identical copy of the root `LICENSE`, because npm only packs files from inside the package. For Angular, ng-packagr copies `packages/angular/projects/items-grid/LICENSE` into `dist/items-grid`. `pnpm pack:check` compares each tarball's LICENSE with the root one.
- **The Angular package is published from `packages/angular/dist/items-grid`** (`publishConfig.directory`). pnpm rewrites the `workspace:` ranges there at pack time. `pnpm pack:check` proves it and also runs arethetypeswrong on every tarball.
- **The Version Packages PR shows no CI checks.** It is opened with `GITHUB_TOKEN`, and GitHub does not trigger other workflows from that token's pushes. To compensate, `pnpm release` re-runs every gate before publishing. To get real checks on the PR, pass a fine-grained PAT to `changesets/action`'s `github-token` input (v2 ignores a `GITHUB_TOKEN` env var).
- **The release job runs only in `mellowforge/items-grid`**, so forks never open Version PRs or try to publish.

## First publish and trusted publishing (maintainer)

npm trusted publishers are configured per **existing** package, so the first version of each package cannot come from OIDC:

1. **Create the npm org.** The `@mellowforge` scope must exist on npm, and the maintainer must be allowed to publish to it.
2. **Merge the first Version Packages PR.** The Release run on that merge fails at the publish step, because no trusted publisher exists yet. That red run is expected.
3. **Publish the first version by hand.** Do this locally, on an up-to-date `main`. Run `npm login`, then `pnpm release` (every gate, then `changeset publish`), then `git push --follow-tags` to push the release tags that `changeset publish` created. The maintainer runs this; agents never do.
4. **Add the trusted publisher.** On npmjs.com, open each of the three packages' Settings → Trusted Publisher and set:
   - GitHub owner `mellowforge`
   - repository `items-grid`
   - workflow `release.yml`
   - no environment
   - direct publishing allowed

   Confirm all three before the next release: a package without one fails the lockstep release (see below).

5. **Lock token publishing.** In each package's Settings → Publishing access, choose "Require two-factor authentication and disallow tokens" (OIDC publishing keeps working), and run `npm logout` on the machine used for step 3. Then no local token can publish, whatever runs on that machine.
6. **Check provenance.** From then on, `release.yml` publishes through OIDC with provenance (`NPM_CONFIG_PROVENANCE`). After the first OIDC release, check that each npm page shows the provenance badge. If it doesn't, have `release.yml` write `provenance=true` to a CI-only `.npmrc` before publishing.

## A partial release (maintainer)

If the Release run publishes some packages and fails on another (e.g. a missing trusted publisher), npm holds mixed versions until it is fixed:

1. Fix the cause (e.g. add the missing trusted publisher).
2. Re-run the failed Release workflow run. `changeset publish` skips versions already on npm and publishes the rest.
3. Check that every package's tag reached GitHub: `git ls-remote --tags origin`. If any are missing, the maintainer runs `pnpm changeset tag && git push --follow-tags` on the release commit.

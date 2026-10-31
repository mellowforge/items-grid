# Backlog

Deferred work, with the reason it was deferred.

- **Rename the repo folder** `actions-grid` → `items-grid` (user will do it). The package URLs already point to `github.com/mellowforge/items-grid`.
- **Focus after PageUp / PageDown without `arrowKeys`** — the focused card leaves the DOM when the page changes, so focus drops to `<body>`. `arrowKeys` fixes it by focusing the card at the same position; doing that by default would move focus into cards in apps that never opted into card focus (cards aren't focusable without it). Revisit if users report it.
- **A compact pager for narrow grids** — the built-in pager stays on one line (its height must not depend on its content, or the page size feeds back into it and the grid flickers), so below ~330px its page buttons overflow sideways. Options: fewer page slots by available width, or prev / next with "3 / 40" only, chosen by the host's width (never by content).
- **Changesets CLI v3** — `changesets/action` v2 already reads release plans with Changesets v3; the repo still versions with CLI v2 (`@changesets/cli` 2.31). v3 bumps peer dependents by patch instead of major, which would make `onlyUpdatePeerDependentsWhenOutOfRange` (and the `workspace:0.x` peer workaround in `.claude/rules/release.md`) unnecessary. Check its other breaking changes (`changeset tag` → `changeset git-tag`, `version` exits 1 with no changesets) against `release.md` and the scripts first.

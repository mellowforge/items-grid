# Backlog

Deferred work, with the reason it was deferred.

- **Rename the repo folder** `actions-grid` → `items-grid` (user will do it). The package URLs already point to `github.com/mellowforge/items-grid`.
- **Focus after PageUp / PageDown without `arrowKeys`** — the focused card leaves the DOM when the page changes, so focus drops to `<body>`. `arrowKeys` fixes it by focusing the card at the same position; doing that by default would move focus into cards in apps that never opted into card focus (cards aren't focusable without it). Revisit if users report it.
- **A compact pager for narrow grids** — the built-in pager stays on one line (its height must not depend on its content, or the page size feeds back into it and the grid flickers), so below ~330px its page buttons overflow sideways. Options: fewer page slots by available width, or prev / next with "3 / 40" only, chosen by the host's width (never by content).

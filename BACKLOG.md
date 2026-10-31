# Backlog

Deferred work, with the reason it was deferred.

- **Rename the repo folder** `actions-grid` → `items-grid` (user will do it). The package URLs already point to `github.com/mellowforge/items-grid`.
- **Custom pager parity** — React's `pager` prop also takes a render function; Angular uses `[pager]="false"` plus a standalone `<mf-items-grid-pager>` instead (same capability, different shape). Revisit if Angular users ask for an in-grid template slot.
- **Dark theme** for the demos and the optional pager stylesheet.
- **`maxPageSize` per preset in the demos** — the option is implemented and tested but no demo control exposes it yet.
- **Arrow-key navigation between cards** — out of scope for v0 because cards contain their own controls; revisit with a roving-focus opt-in.
- **Lighthouse / axe pass** on the demos (pager contrast, focus order) with the chrome-devtools a11y skill.

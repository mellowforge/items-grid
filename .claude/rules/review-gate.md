# Review Gate

Run `/pr-review-toolkit:review-pr` per completed chunk, giving every agent `CLAUDE.md` and this file. Suggestions are never auto-applied; only Critical and Important findings are mandatory. Reviewers may run on outdated framework knowledge — check flagged idioms against current docs (context7). Known false positives: "add `standalone: true`" / "add `OnPush`" / "add zone.js" (Angular 22 defaults; the repo is zoneless), "memoise callbacks with `useCallback`" (the React adapter reads callbacks from a latest-value ref).

## Required checks

- **Public API discipline.** No unintended change to anything exported from a package entry point, or to any selector, input, output, prop, CSS class or `--mf-items-grid-*` property. Intended changes have TSDoc, a changeset and README updates.
- **The core stays headless** and dependency-free; `engine/` and `controller.ts` use no DOM APIs.
- **Exact fit.** No change may let a partial row show, make the viewport scroll, or derive the viewport's height from its content. Verify in a demo with chrome-devtools, not only in jsdom.
- **Adapter parity.** A feature, fix, prop/input or output changed in one adapter is changed in the other, with a spec in both, or recorded in `BACKLOG.md` with the reason.
- **No leaks.** Every `ResizeObserver`, `requestAnimationFrame`, timer and subscription has matching teardown — including React StrictMode's mount → unmount → mount.
- **No blank-render blind spot.** Keep the React spec that fires a resize outside `act()` and awaits `findBy*`, and Angular specs that assert after `whenStable()` without `detectChanges()`.
- **No `any`, no `enum`**, no decorator-based Angular inputs/outputs.
- **Accessibility.** List/listitem semantics, the polite live region, labelled pager buttons with `aria-current`, and PageUp/PageDown keep working, with a keyboard-path spec.

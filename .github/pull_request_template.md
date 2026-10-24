<!-- Title: Conventional Commits, e.g. "feat(navigation): warn before a hairpin". The title becomes the commit on main. -->
<!-- The path every change follows: docs/EVOLVING.md -->

## Summary

<!-- What changes and why, in a few lines. -->

## Decision and spec

<!-- ADR added or "none needed" (docs/adr/). Spec requirement added or changed (openspec/specs/...), or "no behaviour change". -->

## Verified

<!-- What was run: npm run quality, a real device ride (which phone, which roadbook). State what was NOT verified. -->

## Checklist (docs/EVOLVING.md)

- [ ] ADR when the shape of the system changes
- [ ] Spec updated first when behaviour changes
- [ ] Tests with the code, UI tests for anything a rider sees or does; `npm run quality` passes
- [ ] `npm run smoke:device` on a phone for a release or a native change (or say why not)
- [ ] README / ENGINEERING / roadmap updated when they changed
- [ ] Commits and PR title follow Conventional Commits
- [ ] No attribution trailers

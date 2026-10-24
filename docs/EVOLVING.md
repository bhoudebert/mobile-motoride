# How MotoRide evolves

Every feature goes through the same path, whoever builds it, a person or a
coding agent: designed before coded, specified before tested, explained before
released. Same path as agentRide.

```
idea ─▶ decision ─▶ spec ─▶ code + tests ─▶ docs ─▶ PR ─▶ release
        (ADR)      (openspec)  (core first)   (README)  (review) (automatic)
```

1. **Idea.** `ROADMAP.md` or an issue. Say who it is for, when it is used
   (before, during, after the ride), what the rider does and what the app does.
2. **Decision.** An ADR in `docs/adr/` when the shape of the system changes:
   new dependency, service, data store, a rule across features. Include the
   alternatives that lost.
3. **Spec.** `openspec/specs/<capability>/spec.md`: SHALL requirements, each
   with a WHEN / THEN scenario. Larger proposals start in `openspec/changes/`
   and are folded into the specs once merged, then archived with a date.
4. **Code and tests.** Logic in `src/core/` with tests in `test/`; screens thin with UI tests in `test/ui/`.
   Rules that protect the rider are enforced in code. `npm run quality` passes; for a release or a native
   change `npm run smoke:device` passes on a phone (`docs/TESTING.md`).
5. **Docs.** README, `docs/ENGINEERING.md`, `ROADMAP.md` as needed.
6. **Pull request.** Template filled in: what was verified, what was not.
   Squash merge; the PR title is the commit on `main`.
7. **Release.** release-please reads Conventional Commits and maintains the
   release PR (version, changelog). Do not edit `CHANGELOG.md` by hand.

Verify for real where it matters: a roadbook ridden on a phone beats a green
test. Say which one you did.

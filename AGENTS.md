# Working in this repository

Read this before changing anything. It applies to people and to coding agents
(Claude Code, Codex, others) alike.

## What this is

MotoRide (the repository is mobile-motoride): a motorcycle GPS for Android (iOS later). It rides a **GPX
roadbook** (made by agentRide, `../agentRide`) and warns of dangerous corners,
and later of traffic and danger zones. `README.md` explains the product,
`docs/ENGINEERING.md` how it is built, `openspec/project.md` holds the
conventions and vocabulary, `openspec/specs/<capability>/spec.md` describe the
behaviour as requirements with scenarios.

## Rules

The full path every feature follows is in `docs/EVOLVING.md`. Short form:

1. **Branch, then pull request.** Never commit to `main`. Branch names:
   `feat/...`, `fix/...`, `docs/...`, `build/...`, `ci/...`, `chore/...`.
2. **Conventional Commits, strictly.** `<type>(<scope>): <subject>`; types
   `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `chore`,
   `style`, `revert`; kebab-case scope; imperative subject; one concern per
   commit; header at most 100 characters. The commit-msg hook and CI reject
   anything else.
3. **Spec first when behaviour changes.** Update or add the requirement in
   `openspec/specs/...` in the same PR, before or with the code. A significant
   architectural choice gets a decision record in `docs/adr/`; read the
   existing ones before changing something they cover.
4. **Tests with the code, at every layer.** Logic lives in `src/core/` (no React Native
   import) and gets unit tests in `test/`, run by Node. Screens stay thin and get UI tests in `test/ui/`
   (Jest): any change to what a rider sees or does comes with a test that fails without it, and a bug starts
   with a failing test. Never skip or delete a failing test to ship; fix the cause. `docs/TESTING.md` says how.
5. **Quality gate before pushing:** `npm run quality` (typecheck, lint, format
   check, core and UI tests with coverage thresholds, bundle check) must pass. Before a release or a native
   change, `npm run smoke:device` on a real phone must pass too.
6. **Docs with the change:** README when the overview changes,
   `docs/ENGINEERING.md` when the architecture changes, `ROADMAP.md` when an
   idea is done or added.
7. **Pull request** with the template: summary, spec touched, what was
   verified, what was not (say plainly when it was not run on a device).
8. **Every change goes through a pull request, and CI must be green to merge.** Never merge a red or unfinished
   check, never push to `main`, never bypass with `--admin`, whoever you are (person or agent), small fix or not.
9. **No attribution trailers** or generated-by footers in commits, PR
   descriptions or comments.

## Code conventions

- TypeScript strict. `src/core/` is pure: no `react-native`, no Expo, no I/O;
  Node runs its tests with type stripping, so use explicit `.ts` imports and
  no enums or parameter properties (`erasableSyntaxOnly`).
- Screens (`src/ui/`) call core, they do not compute geometry.
- Rider-safety rules (what triggers a warning, how early) are enforced in code
  and specified in `openspec/specs/corner-warnings`, never left to a screen.
- The app ships no roadbook (ADR 0044): a rider imports a file or fetches from their server. Real roadbooks for the
  tests live in `test/fixtures/roadbooks`; the device smoke pushes them to a local agentRide server.
- Never copy another product's code, assets or private API. Features are built from public documentation
  and open data.

## Useful commands

```
npm run quality           # the gate (core, UI, bundle)
npm run test:ui           # UI tests only (Jest)
npm run smoke:device      # the installed app on a phone, through adb
npm test                  # core unit tests
npm run android           # build and run the dev client on a device
npm start                 # Metro for the dev client
```

# Contributing

Everyone taking part follows the [code of conduct](CODE_OF_CONDUCT.md).

## Setup

```bash
nvm use           # Node 24, from .nvmrc
npm install       # also installs the git hooks (simple-git-hooks)
npm run quality   # must pass before any pull request (core + UI tests, bundle)
```

With [Nix](https://nixos.org) (optional), `nix develop` (or `direnv allow`) gives
Node 24, JDK 17 and the pinned Android SDK; on NixOS it is the way to build, because
Gradle's downloaded `aapt2` cannot run there (the shell points Gradle to the SDK's own).

In the Nix shell `npm run specs` validates the specs (every requirement needs a scenario), as CI does; a pull request that
changes `src/` or `App.tsx` also needs a change under `openspec/` or `docs/`, or the `no-spec` label for a change with no
behaviour or usage change (see `docs/EVOLVING.md`).

Running the app needs a development build on an Android phone or emulator
(`npm run android`); Expo Go does not include MapLibre.

## Workflow

The path every feature follows is `docs/EVOLVING.md`. In short: branch from
`main`, spec first, ADR if the shape changes, code with tests, `npm run
quality`, pull request with the template. Every change goes through a pull request, and CI must be green
to merge: no push to `main`, no `--admin`.

## Commits

[Conventional Commits](https://www.conventionalcommits.org), enforced by a
hook and CI: `<type>(<scope>): <subject>`.

- Types: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`,
  `chore`, `style`, `revert`.
- Scope in kebab-case (`navigator`, `corners`, `gpx`, `ui`, `deps`).
- Imperative subject, header at most 100 characters, body lines at most 120.
- One concern per commit. Breaking change: `!` after the scope or a
  `BREAKING CHANGE:` footer.
- No attribution trailers.

Examples: `feat(corners): warn before a hairpin`,
`fix(gpx): read attributes in either order`.

The PR title follows the same convention; squash merges turn it into the
commit on `main`, which release-please reads.

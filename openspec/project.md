# Project Context

## Purpose

MotoRide (repository mobile-motoride) is a motorcycle GPS. It rides a GPX roadbook planned by
agentRide and warns the rider of dangerous corners ahead; later of traffic and
danger zones, and it can navigate to a destination.

## Tech Stack

- TypeScript, React Native with Expo (development build), MapLibre Native, `expo-location`, `expo-speech`.
- Core logic in `src/core/`, pure, tested by Node 24 (`node --test`, type stripping, no build step).
- Data: roadbooks as GPX from agentRide, bundled into the app (ADR 0005). Map tiles from a MapLibre-compatible provider.

## Project Conventions

### Code Style

- ESLint and Prettier (`eslint.config.js`, `.prettierrc.json`); `npm run quality` must pass.
- `src/core/` imports nothing from React Native or Expo; explicit `.ts` import extensions; no enums.
- Safety rules (when to warn, how early) are enforced in core and specified, never decided by a screen.

### Architecture Patterns

- `parseGpx` -> `Roadbook` -> `prepareRoadbook` (distances, corners) -> `createNavigator(fix) -> NavState` -> UI.
- The UI renders `NavState` and speaks warnings; it holds no geometry.

### Testing Strategy

- Unit tests in `test/` for everything in `src/core/`, with synthetic tracks (a straight, an arc, a hairpin) and one real bundled roadbook as a regression.
- A change is not "verified" until it ran on a phone; say so in the PR when it did not.

### Git Workflow

- Branches off `main`, pull requests reviewed by the maintainer, CI gate (`npm run quality` plus commitlint), Conventional Commits, release-please for versions and changelog.
- Specs live in `openspec/specs`; proposed changes in `openspec/changes`, archived with a date once folded into the specs.
- No attribution trailers in commits or pull requests.

## Domain Context

- **Roadbook**: a named ride as a line (`track`), numbered stops (`waypoints`), and totals. Comes from agentRide as GPX.
- **Fix**: one GPS reading: position, speed, heading, time, accuracy.
- **Progress**: distance along the roadbook line, from the start.
- **Corner**: a stretch of the line that turns tightly; has a start, an end, a minimum radius, a direction and a severity.
- **Severity**: `hairpin` (radius under 25 m and at least 100 degrees), `sharp` (radius under 60 m and at least 45 degrees), otherwise `bend`. Only the first two raise a warning.
- **Advisory speed**: the speed at which the corner is ridden at a comfortable lateral acceleration (3 m/s²), rounded down to 5 km/h. Guidance only.
- **Off route**: more than 50 m from the line for three consecutive fixes.

## Important Constraints

- Safety: a warning must never depend on the network, and the app must not ask for input while riding.
- GPS on a phone is noisy (5-20 m); the line is the truth for corner shape, the fix only places the rider on it.
- Public OSM tile servers cannot be used by the app; a provider is required before release.
- Danger-zone and radar alerts are regulated per country; label as zones and check the law before shipping.

## External Dependencies

OpenFreeMap (optional basemap, ADR 0007), agentRide (source of GPX). Later: a routing service, a traffic API, a backend (ADR 0004).

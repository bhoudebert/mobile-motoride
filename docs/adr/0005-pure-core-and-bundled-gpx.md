# 0005. Pure core and bundled GPX roadbooks

- Status: accepted
- Date: 2026-10-18

## Context

Safety logic (finding corners, deciding when to warn) must be tested without a
phone. agentRide exports GPX files with a route line (`trkpt`) and stops
(`wpt`); those exports are the user's own data and are not public.

## Decision

All logic lives in `src/core/`, pure TypeScript with no React Native import,
tested by Node. `scripts/bundle-roadbooks.ts` reads GPX files from a folder
(default `../agentRide/exports`) with the same parser as the app and writes
compact JSON to `src/data/bundled/`, imported by the app. The generated JSON
is committed only for the roadbooks the author chooses to ship.

## Consequences

Corner detection and navigation are covered by fast tests. The bundle step is
explicit and repeatable. The parser is regex-based (no DOM in React Native), so
it supports the GPX subset agentRide writes plus common variants, not all of
GPX.

## Alternatives considered

Parse GPX at runtime from assets: same parser, but slower start and no
inspection of what ships. A DOM/XML library: heavier for a fixed, simple
format.

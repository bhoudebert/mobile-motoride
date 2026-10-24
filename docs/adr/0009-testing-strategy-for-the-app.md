# 0009. Testing strategy: four layers, one gate

- Status: accepted
- Date: 2026-10-18

## Context

The app is ridden, not watched: a broken screen, a missed warning or a crash on Start is a safety problem, not a
cosmetic one. Unit tests of the core (ADR 0005) prove the logic, but not that the screens render it, that the
controls work, that a refusal or a missing network is handled, or that the app starts on a real phone. Two real
bugs were found only when the screens were driven by tests (a stale "Location is off" banner after Stop) or on a
phone (layers drawn as siblings of their source).

## Decision

Four layers, all required before something ships:

1. **Core unit tests** (`node --test`, `test/*.test.ts`): geometry, corners, instructions, navigator, approach,
   plus the real bundled roadbooks ridden end to end.
2. **UI tests** (`jest-expo` + Testing Library, `test/ui/*.test.tsx`): the real screens and hook against fakes of
   the native modules (MapLibre, location, speech). Every screen, state and control: idle, demo, GPS, permission
   refused, no fix, approach routed and not routed, off route, corner warnings spoken once, basemap switch and
   failure, camera follow and zoom limits, error boundary, unmount cleanup, long rides on every roadbook.
   Accessibility is tested too: contrast of every colour pair, 44 dp targets, a name on every button, live regions.
3. **Bundle check**: `expo export` must build the JavaScript bundle (catches imports, assets, syntax Metro rejects).
4. **Device smoke test** (`npm run smoke:device`): drives the installed app on a phone through `adb`: list, open,
   demo, corner warning, basemap switches, controls, stop, back; fails on a crash in the log or a layout problem
   (off screen, overlapping or tiny buttons) read from the real screen. Run before a release and after any native
   or layout change.

`npm run quality` runs layers 1 to 3 with coverage thresholds; CI runs the same. Layer 4 needs a phone and is a
release step (`docs/TESTING.md`).

## Consequences

A regression in logic, rendering, controls, accessibility or bundling fails the gate before review. The fakes can
drift from the real modules, which is why layer 4 exists and why native behaviour (real GPS, real tiles, real
speech) is still tested by hand on a road. UI tests add a dev dependency stack (jest, jest-expo, Testing Library)
and a few seconds to the gate.

## Alternatives considered

Detox or Maestro end to end on an emulator in CI: valuable, heavy to run and to keep stable for one maintainer;
the smoke script covers the same flow on a real phone. Snapshot tests: they fail on every harmless change and
catch little. Core tests only: leaves the screens unguarded.

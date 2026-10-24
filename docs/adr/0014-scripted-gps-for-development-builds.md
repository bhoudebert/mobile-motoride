# 0014. Scripted GPS for development builds

- Status: accepted
- Date: 2026-10-18

## Context

The device smoke test (ADR 0009) drove the demo, which rides the line by itself. Everything that matters on a road
needs a GPS position: the approach to the start, going off route, the wrong way, skipping a point, danger zones. A real
phone cannot be given a fake position from a script without a mock-location app, and the emulator is not part of the
setup. So those flows were proven only against fakes in Jest, never on a real screen with a real map.

## Decision

In **development builds only** (`__DEV__`), the app listens for `mobilemotoride://replay/<scenario>` and starts a GPS
ride fed by a script of fixes (`src/core/replay.ts`) in place of the location service. The same hook, navigator,
routing and screen run; only the source of positions differs. Scenarios hold their last position so the screen
settles and can be read. Release builds do not install the listener. The smoke test sends the link and reads the
result.

## Consequences

The GPS path is exercised on the real phone, with the real map, the real Valhalla and the real layout, without
moving. It does not exercise the phone's GPS itself, the permission dialog, or speed and heading noise: those stay for
the road. Positions are scripted from the roadbook, so a scenario that needs a feature the roadbook lacks does
nothing. One more small code path in development; none in release.

## Alternatives considered

A mock-location app and `appops`: another app to install and trust, and slow to script. The Android emulator with
`geo fix`: not set up, heavy. A hidden screen in the app: reachable in release. Environment variables read at build
time: a rebuild per scenario.

# 0011. Danger zones, not camera positions

- Status: accepted
- Date: 2026-10-18

## Context

The roadbook file carries fixed speed cameras. Laws on warning riders of cameras differ by country: some forbid
announcing a camera's position and allow only generic danger zones, some forbid warning apps in the vehicle at
all, some are tolerant of fixed cameras. The author rides in Belgium, France and neighbours. No legal review has
been done for this project, and this is not legal advice.

## Decision

The app presents a camera only as a **danger zone**: a warning before a stretch, "Danger zone", with a distance.
It never says "camera" or "radar", never shows the camera's position on the map, and never announces a mobile
camera (the file has none). The feature is a setting, `DANGER_ZONES`, on in development, and **a release gate**:
before a build is shared with anyone, the rule of each country the app is offered in is checked and the feature is
switched off where it is not clearly allowed.

## Consequences

The warning is useful and the least exposed form of it. It does not make the feature legal everywhere: that
is the gate. A country switch (by position) can be added once the rules are known.

## Alternatives considered

Showing camera positions and limits as other apps do outside France: more useful, and unlawful in some places.
No cameras at all: safest, but the rider asked for them.

# 0006. Dangerous corners from track geometry

- Status: accepted
- Date: 2026-10-18

## Context

The app must warn before dangerous corners. Proprietary
map data would add a licence and a cost. A roadbook already carries the exact line the rider will follow.

## Decision

Detect corners from the **roadbook line itself**: resample every 10 m, compute
the radius from three points 20 m apart, group tight stretches into corners,
classify by minimum radius, and derive an advisory speed from a comfortable
lateral acceleration. Thresholds are specified in
`openspec/specs/corner-warnings`.

## Consequences

Works offline, with no data licence, and exactly on the planned road. It sees
only the corners of the planned line (not side roads), cannot know camber,
surface or visibility, and depends on the GPX line being dense and accurate.
Advisory speeds are guidance, not a safety guarantee; the UI must say so.

## Alternatives considered

OSM `maxspeed:advisory` tags and curvature of the whole road network:
sparse tags, heavy data. A commercial hazard feed: licence and cost. Machine
learning on rider telemetry: no data yet; revisit with real rides.

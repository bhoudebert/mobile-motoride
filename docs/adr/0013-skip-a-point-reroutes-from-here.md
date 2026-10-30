# 0013. Skipping a point reroutes from where the rider is

- Status: accepted
- Date: 2026-10-18

## Context

A roadbook is a plan. On the road, the plan meets reality: a road is closed, a better one is found. The rider needs
to change the plan without stopping the ride for long and without a laptop, as often as they like.

## Decision

The rider can **skip the next route point**. The app routes from where they are to the point after it, drops the
stretch between, and goes on with the roadbook. It reuses the rejoin machinery (ADR 0012): one request to the public
Valhalla service, a join point on the original roadbook, approach and roadbook as one line, a straight-line fallback.
Only route points (`kind: waypoint`) can be skipped; planned service stops lie on the route and are left alone. It
takes two taps, works only below 10 km/h, and can be undone for 15 seconds (7.5 since the undo moved into the skip square), because the app asks nothing of a rider
who is riding (`openspec/project.md`).

## Consequences

A closed road costs two taps and a few seconds. The new route is Valhalla's, which may choose the closed road again:
the rider can skip again, as often as needed, and the app has no way to know a road is closed. Skipping drops the
stops of the abandoned stretch. The file format gains an optional `kind` on stops, additive in version 1.

## Alternatives considered

Rerouting to the same point avoiding the current road: needs a way to name the road to avoid, which the rider
cannot do on the move. Free editing of the roadbook on the phone: too much interaction for a bike. Skipping a
stretch of line by distance: harder to say and to check than "the next point".

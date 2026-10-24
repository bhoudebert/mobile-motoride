# 0008. Approach to the start with the public Valhalla service

- Status: accepted
- Date: 2026-10-18

## Context

A roadbook is a line that starts somewhere. The rider is rarely there: they leave from home. Without a way to the
start the app can only say "Off route". Routing a way needs a routing engine; the app has no backend (ADR 0004),
and agentRide already plans with the public Valhalla instance of FOSSGIS e.V. on the motorcycle profile.

## Decision

On Start, away from the line, request one route from the rider to the roadbook's first point from
`valhalla1.openstreetmap.de` (motorcycle costing, a contact-style User-Agent, a 10 s timeout) and ride
**approach + roadbook as one line**. Corner detection, maneuvers, instructions, bearing and warnings are computed
on the combined line, so they need no second code path. Without a route (no network, timeout, error) fall back to
a straight line to the start with the off-route flag disabled on it.

## Consequences

Guidance to the start with no new engine and a single request per ride. It needs the network and a shared public
service under fair use, so it is one request per Start, never per fix. There is no rerouting yet: leaving the
approach flags "Off route" like the roadbook. A backend or a self-hosted Valhalla (ADR 0004) is the way out if the
public service is not enough.

## Alternatives considered

Straight line only: honest but not navigation. Bundled routing graph on the phone: heavy. Rerouting continuously:
more requests and a state machine; later, once the approach is proven on the road.

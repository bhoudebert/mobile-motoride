# 0026. Complete an imported GPX with public services

- Status: accepted
- Date: 2026-10-19

## Context

A GPX has a line and perhaps stops, nothing else. A rider who brings a route from another app should get the speed
limit sign, the roundabout exits and, where the law allows, the camera warnings that an agentRide roadbook gives
(ADR 0025). The owner wants no backend (ADR 0004).

## Decision

The app does what agentRide does, once, at import, from the phone: it thins the line to a point about every 30 m,
asks Valhalla's `trace_attributes` (map matching, in pieces of about 45 km) for each road's limit, class, density,
country and roundabout flags, and lays the answer back on the imported line by distance and nearest point (the matched
shape is not the line sent). Limits follow agentRide's rules (posted, else the legal default by country and region,
capped on minor roads, 50 at most in a built-up area), so a completed GPX and an agentRide roadbook read the same.
Cameras come from Overpass, along the line every 600 m, with the mirrors and waits agentRide uses because the public
servers shed load; a failed stretch is reported, never silently dropped. The result is kept with the roadbook; a
failure leaves the GPX as it was, flagged to be tried again from the list. The rules live in `core/enrich.ts` (pure) and
the network in `services/enrich.ts`.

## Consequences

An imported GPX is as useful as an agentRide roadbook, with no server of ours, and the camera policy by country
(ADR 0021) applies to it through the countries it now has. The rules are a copy of agentRide's: a change to one must
reach the other until they share a package. It uses two donated public services with no guarantee: a 190 km route took
2.5 minutes on a busy day, and many riders would need our own Valhalla and Overpass (ADR 0004 would then be revisited).

## Alternatives considered

Asking agentRide to do it: the point is to need no agentRide. A backend that completes routes: the owner does not want
one. Doing it at ride time: no network on the road, and a long wait at the start.

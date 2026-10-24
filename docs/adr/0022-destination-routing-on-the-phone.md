# 0022. Destination routing on the phone

- Status: accepted
- Date: 2026-10-19

## Context

Every ride so far comes from an agentRide roadbook. A rider also wants to go somewhere, now, without planning a loop.

## Decision

The phone builds a roadbook for the trip: Nominatim (OpenStreetMap's search service) finds the place, the public
Valhalla service (the one of ADR 0008) routes it for a motorcycle from the phone's position, and the result is a
`Roadbook` like any other (line, a start and a finish), prepared by the same core. The search runs only when the
rider submits it, not on each keystroke, with an identifying User-Agent: that is what Nominatim's usage policy asks
of an app (no autocomplete, one request at a time). The roadbook is not saved. Speed limits, cameras and junction
guidance are not in it: they come from agentRide's tracing, which this route does not go through; the app shows
"unknown" for the limit and still gives turns and corner warnings, computed from the geometry.

## Consequences

Riding to a place works with no backend and no account, with the same guidance as a roadbook minus limits. It needs the
network for the search and the route, and depends on two donated public services with no SLA (as ADR 0008). A route
that is not a loop has no skippable points. Limits and roundabouts for such a route need either a tracing step in the
app or the backend of ADR 0004.

## Alternatives considered

A bigger geocoder (Google, Mapbox): keys and cost, and their terms forbid the open-data stack of ADR 0003. Search as
you type: breaks Nominatim's policy and would hammer a free service. Asking agentRide for the route: needs the
laptop, which is the point of not having it.

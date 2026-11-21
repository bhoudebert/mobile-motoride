# 0054. The phone routes through its server

- Status: accepted
- Date: 2026-11-21

## Context

The phone called the public Valhalla (`valhalla1.openstreetmap.de`) for every route: the way to a roadbook's start, the way back
after a skip or a missed turn and, since the Go To offers several ways (ADR 0053), three requests at once. The public server is a
community demo with no guarantee and a usage policy that does not expect an app in the stores. The rider's own server (agentRide)
runs its own Valhalla when the host chooses, but the phone could not reach it: that Valhalla is on the server's internal network.

## Decision

agentRide answers `POST /route` for the rider's token (agentRide ADR 0061). The phone asks it first and falls back to the public
service when the rider has no server, the server has no `/route` (an older agentRide: remembered until the app restarts), is busy,
down or silent for 6 seconds. A 422 from the server (no road between the places) is believed, not retried elsewhere. The request
and the answer are the ones the public service speaks, so the reading code is the same.

## Consequences

A rider with a server stops depending on the public Valhalla, and rides on the map of their host. A rider without one still uses the
public service as before; making that a hosted free tier is a later decision. The fallback sends a destination to the public service
when the rider's own cannot answer, as before. Zones to avoid will be one more field of the request.

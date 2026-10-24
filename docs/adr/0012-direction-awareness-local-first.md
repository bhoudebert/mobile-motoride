# 0012. Direction awareness: local first, a route when online

- Status: accepted
- Date: 2026-10-18

## Context

The rider will not always ride the roadbook as drawn: they set off facing the wrong way, miss a junction, take a
different road. A camera also watches only one direction of a road. The question was whether this needs a backend or
heavy computation, and whether the app's "predetermined" planning (agentRide, with a model) can serve it live.

It cannot and does not need to. The model plans a roadbook once, ahead of the ride, in agentRide. During the ride the
app does no inference: everything is geometry on the roadbook line and on the GPS fixes, a few arithmetic operations
per second on the phone.

## Decision

Direction awareness is computed on the phone from the roadbook line and the GPS heading:

- **Camera facing:** compare the rider's travel direction with the direction the camera watches.
- **Limit:** keep the last known limit across a gap.
- **Wrong way:** heading against the line's bearing, with a speed floor and 3 consecutive fixes.
- **Back to the route:** the target is a point of the line ahead of the rider; the instruction is the distance and
  the side, from bearings. This works offline.

Only one thing needs a service: a route **along real roads** from the rider to the target. The phone asks the public
Valhalla instance for it, once per episode, as it already does for the approach to the start (ADR 0008), and falls
back to the direction guidance without a connection.

## Consequences

Everything that protects the rider works with no network and no server. The road route needs the network and is the
only part that a self-hosted routing service (ADR 0004) would improve. Heading is unreliable below 10 km/h and
noisy at speed, hence the thresholds. Cameras without a bearing warn both ways: more warnings than needed, never
fewer. A routing graph on the phone would remove the last dependency, at the cost of hundreds of megabytes per region.

## Alternatives considered

A backend that follows the rider and reroutes: more moving parts, a server to run, the same answer. Rerouting only
by network: leaves the rider with nothing offline. A model deciding live: slow, costly and unnecessary for geometry.

# 0010. The roadbook file is the contract with agentRide

- Status: accepted
- Date: 2026-10-18

## Context

A GPX carries a line and stops, nothing more. The rider wants the speed limit shown at all times, a warning when
over it, and danger zones from the cameras. agentRide already knows the posted limits (OpenStreetMap through
Valhalla), the country defaults and the fixed cameras, but keeps only aggregates for limits and no export of
them. The app has no backend (ADR 0004) and no routing graph.

## Decision

agentRide exports a **roadbook file** (`docs/roadbook-format.md`, JSON, versioned) with the line, stops, a limit
per stretch and the cameras. The app reads it; the GPX remains a fallback without limits. Stretches refer to line
point indexes, so the file needs no length measure and survives any distance computation. The producer writes the
line it traced so the indexes hold.

## Consequences

The app needs no road data service for limits: the limit is on the file, offline. The roadbook is richer than
anything a GPX can say, and agentRide stays the single place that knows the roads. A roadbook already in the app
shows no limit until agentRide exports it again. The format is a public interface between two repositories: it
changes through a version number and `docs/roadbook-format.md`, with both specs updated.

## Alternatives considered

GPX extensions: valid, but other apps drop them and the limit per stretch is awkward as extensions on points.
Asking Valhalla from the phone for limits along the route: a request per ride on a public service, and no
limit offline. A backend serving roads: not built (ADR 0004).

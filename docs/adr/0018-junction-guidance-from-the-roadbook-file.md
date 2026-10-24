# 0018. Junction guidance comes from the roadbook file, drawn with plain views

- Status: accepted
- Date: 2026-10-18

## Context

A rider needs to know, before a roundabout, which exit to take, and on a wide road which lanes lead on: Navigation apps
show both as a small diagram. Neither can be found from the shape of the track alone: the number of exits and where they
lead, and the lanes of a road, are map data. The app is offline-first and has no server (ADR 0003); roadbooks come
from agentRide, which already queries OpenStreetMap for limits and cameras (ADR 0010).

## Decision

agentRide writes the junctions into the roadbook file as an optional `junctions` array (format version 1, optional
fields): a roundabout with the bearings of its exits and which one to take (the app numbers the exits by the side traffic keeps), and a lane guide with the lanes and the ones
to use. The app reads them, places them on the line and guides to them: an ordinal in the instruction, a diagram, and a
spoken line, each once per pass. The diagrams are drawn with ordinary views (circles, bars, text), not an image or an
SVG library, so no native rebuild is needed. For a ride routed live (approach, rejoin, skip), no junction is invented:
the diagram needs data we do not have, and a wrong exit is worse than none.

## Consequences

Guidance works offline and costs nothing at ride time. It exists only where agentRide has written it, so the app and
agentRide change together (the app first: a file without junctions works as before). Quality depends on OpenStreetMap
tagging: lanes and `turn:lanes` are often missing, in which case there is simply no lane guide. Valhalla's own
maneuvers (it counts roundabout exits and gives lanes) could fill in live routes later.

## Alternatives considered

Detecting roundabouts from the track's geometry in the app: gives a ring but not the number of exits nor where they
lead, so the ordinal would be a guess. Calling a routing service for the whole roadbook at ride time: needs the
network, which the app avoids. An SVG library: nicer curves, but a native dependency and a rebuilt dev client for a
diagram that plain views draw well enough.

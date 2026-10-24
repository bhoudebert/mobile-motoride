# 0023. Offline basemap as a map saved around the roadbook

- Status: accepted (replaces the offline paragraph of ADR 0007)
- Date: 2026-10-19

## Context

ADR 0007 left offline as a later step and dismissed MapLibre's offline packs because OpenFreeMap is a donation-funded
service not meant for bulk downloads. The rider rides out of coverage and wants the basemap there. The alternatives
cost a lot: a regional PMTiles extract needs its own style, fonts and sprites and a place to host files; a
self-hosted tile server needs a backend (ADR 0004).

## Decision

Use MapLibre's offline packs, but only for what one rider would load anyway: the area of one roadbook (its bounding
box plus 3 km), from zoom 8 up to the highest level that keeps the pack within 4,000 tiles (never above 14, the
highest the data has). That is one or two thousand tiles for a day loop, about what a rider scrolling the same area would
fetch, not a bulk download of a region. The rider asks for it before the ride, one roadbook and one basemap at a time;
the pack carries the style, fonts and symbols, so nothing else is needed. A saved pack stops the reachability check from
dropping the basemap.

## Consequences

The basemap works offline for the roadbooks the rider prepared, with no backend and no new service. Storage grows by
tens of megabytes per roadbook; a rider can remove them. A roadbook too long for the cap is not saved; a corridor
instead of a box would cut the size but is not in MapLibre's API. OpenFreeMap's attribution stays on screen. If the
service objects to this use, the fallback is the PMTiles route above.

## Alternatives considered

A regional PMTiles extract: the right long-term answer for heavy use, a lot of work for the first step. Packs of whole
countries: bulk downloading. Bundling tiles in the app: size and staleness.

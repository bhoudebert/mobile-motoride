# 0007. OpenFreeMap as an optional basemap

- Status: accepted (its offline paragraph is replaced by ADR 0023)
- Date: 2026-10-18

## Context

The tile-free map (the roadbook line on paper) is enough to follow a roadbook, but the rider also wants roads, place
names and landmarks around it. ADR 0003 left the tile provider open and ruled out the public OSM tile servers.
A keyed provider (MapTiler, Stadia) puts an API key in the APK and a quota or bill behind it.

## Decision

Offer a basemap from **OpenFreeMap** (`tiles.openfreemap.org`): vector tiles from OpenStreetMap, no API key, no
account, with fonts and sprites hosted, usable commercially with attribution. Two styles, `positron` (light) and
`liberty` (colour). The basemap is a layer under the roadbook, never a dependency: it is switched Off, Light or
Colour from the ride screen, and a failure to load it falls back to Off. `EXPO_PUBLIC_MAP_STYLE_URL` overrides the
Light style.

## Consequences

Roads and names with no key and no cost, in a few lines of code. It needs the network, and OpenFreeMap is a
donation-funded service with fair use and no SLA. For heavy use or riding out of coverage the next step is offline
vector tiles: a regional PMTiles extract on the device, or a self-hosted tile server behind the future backend
(ADR 0004). Attribution (OpenStreetMap contributors, OpenFreeMap) must stay visible while a basemap is shown.

## Alternatives considered

MapTiler or Stadia: polished, but a key in the APK and quotas. Public OSM raster tiles: forbidden for apps at
scale by the tile usage policy. MapLibre offline packs on OpenFreeMap: bulk downloading is not what the service is
for. Self-hosted PMTiles now: right for offline, but it needs the extract, storage and a download path first.

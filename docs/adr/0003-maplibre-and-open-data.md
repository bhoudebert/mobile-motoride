# 0003. MapLibre and open data

- Status: accepted
- Date: 2026-10-18

## Context

Commercial map SDKs (HERE, Google Maps) are licensed per use. agentRide is built
on open data (OpenStreetMap, Valhalla). Licensing and per-user cost of a
commercial map SDK would weigh on a hobby-to-product app.

## Decision

Render with **MapLibre Native** (`@maplibre/maplibre-react-native`), style URL
from `EXPO_PUBLIC_MAP_STYLE_URL`. Routes come from roadbooks (GPX); later
routing uses Valhalla or GraphHopper. No commercial map SDK.

## Consequences

No licence fee for the SDK; tile hosting is our choice and our cost. The
public OSM tile servers are not allowed for an app, so a provider is needed
before release. Turn-by-turn and traffic are ours to build.

## Alternatives considered

HERE SDK, Google Maps SDK, Mapbox: polished, but proprietary and priced per
use. OSM raster tiles directly: forbidden by the tile usage policy at scale.

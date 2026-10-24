# 0036. Look for a place along the route, on demand

- Status: accepted
- Date: 2026-10-22

## Context

A rider on a loop wants a bakery or a viewpoint without giving up the roadbook: the road is the point of the ride, the stop is a
detour. Fuel is different (ADR 0035): it is always wanted, so it is fetched when a roadbook opens and kept. A bakery is wanted now,
for the next hour, and not worth asking for along 190 km on a chance.

## Decision

- A search is asked **when the rider chooses a kind**, for the part of the roadbook between the rider and 60 km ahead (about two
  Overpass queries), through the same client, `fetchPois` and table of filters as the fuel stations.
- The result is **not kept**: it depends on where the rider is, and the next search asks again. It is all or nothing, like fuel.
- A place is **shown, not routed to**. Choosing one marks it, centres the map on it and keeps a chip with the distance ahead; the roadbook
  stays the active route. Riding to the place is riding off the route, and the guidance to rejoin it (ADR 0012) does the rest. This
  keeps one route and one set of rules, and avoids a second navigation inside the ride.
- The kinds are a closed list (`PLACE_KINDS`) of seven, chosen for what a rider on a motorcycle stops for. A new kind is one row in
  `POI_FILTERS` and one name in each language.

## Consequences

- The privacy policy already says that the coordinates of the route go to Overpass; a search sends the coordinates of the next 60 km, a
  point every kilometre, when the rider chooses it.
- No turn-by-turn to the place: the rider sees where it is and rides there. A later step can offer a route to it (Valhalla, ADR 0022) and
  hand the roadbook back afterwards.
- Opening hours are not read, so a bakery may be shut.

## Alternatives considered

- **Routing to the place and replacing the ride.** It loses the roadbook, or needs a second route held beside it; the ride's state
  (skips, recording, share) would have to follow.
- **Fetching every kind along the whole route when a roadbook opens.** Seven kinds on 190 km is thirty-five queries on a public
  server for places that are mostly not wanted.
- **A free text search along the route.** Nominatim has no search along a line; the closed list is also quicker to use with gloves.

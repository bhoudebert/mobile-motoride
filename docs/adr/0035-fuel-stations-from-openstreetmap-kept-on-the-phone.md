# 0035. Fuel stations from OpenStreetMap, kept on the phone

- Status: accepted
- Date: 2026-10-22

## Context

A loop of 190 km on a tank of 200 is a day that ends badly if the only station on the way is shut or missed. Riders ask for the
fuel on the map, the distance to the next one, and a word before a long stretch. OpenStreetMap has the stations, and the app
already asks Overpass for the cameras along a route (ADR 0026), with the mirrors and the retries it needs. The rides are in
places with little network, so what was found must be kept.

## Decision

- The stations are asked for along the roadbook's line, a point every kilometre in pieces of 40, with a radius of 1.5 km, through the
  Overpass client that the cameras use (moved to `src/services/overpass.ts`). The query is built from a table of filters per kind of
  place, `POI_FILTERS`, so another kind of place along a route (a bakery, a viewpoint) is one more row.
- The answer is **all or nothing**: when a piece cannot be asked, there is no list. A list with a hole says "no fuel for 90 km"
  where there is a station, which is worse than saying nothing.
- Found places are kept for 30 days in a file per roadbook and kind (`pois/<kind>-<roadbook>.json`), read before the network is.
- Where the stations lie along the route is computed in the core: each is snapped to the line (`alongRoute`), and the rules
  (next station, longest stretch without fuel, when to speak) are pure functions that Node tests.
- The words are spoken by the voice in Full and in Alerts mode (a long stretch without fuel is a warning, like a corner). The
  range of the tank, 100 to 400 km, is set by the rider on the fuel card and kept in AsyncStorage like the other settings.
- The pump on the map is a PNG (`assets/pump.png`) drawn for both looks; the pump on the chip is drawn with views like the other icons.

## Consequences

- Cameras and stations share one Overpass client, one set of mirrors and one policy about partial answers.
- The roadbook's line leaves the phone, thinned, for the public Overpass servers once a month per roadbook; the privacy policy and
  the store's data-safety answers say so.
- A station that closed is still shown until the list expires; the app does not know opening hours (OpenStreetMap has them for some,
  and reading them is a later step).
- The list is for the roadbook as it was opened; a skip or a reroute on the ride does not ask again.

## Alternatives considered

- **A fuel layer in the map style.** The map would show pumps but the app could not know the distance to the next one, or speak.
- **Asking again at every ride.** Simple, and fails on the mountain road where the network is gone.
- **Partial lists with a warning.** A rider reads the chip, not the warning.

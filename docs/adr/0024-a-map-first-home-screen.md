# 0024. A map-first home screen

- Status: accepted
- Date: 2026-10-19

## Context

The first screen was a titled list of bundled roadbooks. Now a rider can also go to a place and the app has history to
offer. A list under the app's name says "a catalogue", while a rider at the bike wants to see where they are and say
where to. Navigation apps open on the map with a search and the recent places underneath, and that is
what the owner asked for.

## Decision

The home screen is the map (the same basemap and MapLibre as the ride screen) centred on the rider, with a bottom
panel holding the "Where to?" search, a Roadbooks control and the recent rides, and a menu at the top left. The
app's name is not printed on screen: the splash and the launcher carry it, and the app is called MotoRide. The list of
roadbooks stays, as a screen opened from the home screen. Recent rides (places and roadbooks, at most 8) are kept with
AsyncStorage, the store the voice mode already uses (ADR 0019). A ride returns to the screen it was opened from.
The look keeps the palette of the splash (moss, paper, the yellow of the dashes, the rust of the dot) with rounder
shapes and larger targets than the roadbook list had, since this screen is used at the bike.

## Consequences

The app opens a map and asks for the location at launch rather than at the first ride, and a rider who refuses still
has everything but their marker. More work at start (one position request, one map). The app's name changes to
MotoRide on the phone (launcher label); the package identifier stays, so installs and data carry over.

## Alternatives considered

Keeping the list as home with a search button: the least work, and the least like a navigator. A map under the list: a
list the size of the bundled roadbooks does not fit under a map, and hides the map when it matters. A tab bar: more
chrome for three destinations that a panel and a menu reach.

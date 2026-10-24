# Offline Basemap Specification

## Purpose

Keep the basemap under the roadbook when there is no network on the road, by saving the map around a roadbook on the phone before the ride (ADR 0023).

## Requirements

### Requirement: Save the map around a roadbook

Before a ride starts, with a basemap (Light or Colour) shown, the ride screen SHALL offer "Save the map for offline". Choosing it SHALL download the map tiles, fonts and symbols of the shown basemap for the area of the roadbook (its bounding box, 3 km wider on each side) at the zoom levels 8 to the highest that keeps the download within 4,000 tiles (never above 14), and show its progress as a percentage. A roadbook whose area does not fit 4,000 tiles at zoom 10 SHALL NOT be saved and the screen SHALL say it is too long to save. A failed download SHALL be said and can be tried again. The offer SHALL NOT appear while a ride runs, nor when the basemap is off.

#### Scenario: Save a loop

- **WHEN** the rider chooses "Save the map for offline" on a 120 km loop
- **THEN** the progress is shown, then "Map saved for offline"

#### Scenario: A very long roadbook

- **WHEN** the area of a roadbook needs more than 4,000 tiles at zoom 10
- **THEN** the screen says it is too long to save the map and offers nothing to tap

### Requirement: Use the saved map without the network

A map saved for a roadbook and a basemap SHALL be shown when the network is not reachable, and the screen SHALL NOT fall back to the roadbook line alone nor say the basemap is unavailable for it. Without a saved map, a basemap that cannot be reached SHALL fall back to the roadbook line as before (spec ride-navigation).

#### Scenario: No network with a saved map

- **WHEN** a map is saved for the roadbook and the phone has no network
- **THEN** the basemap is still drawn under the line

### Requirement: Remove a saved map

A saved map SHALL show "Remove" next to its state, which frees its space and returns the offer to save it again. Saved maps SHALL be kept between launches.

#### Scenario: Remove

- **WHEN** the rider removes the saved map
- **THEN** it is deleted and "Save the map for offline" shows again

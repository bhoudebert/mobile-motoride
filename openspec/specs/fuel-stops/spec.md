# Fuel Stops Specification

## Purpose

Show where the fuel is along a roadbook, how far the next station is, and warn before a stretch longer than the tank (ADR 0035).

## Requirements

### Requirement: Stations along the route

The system SHALL find the fuel stations within 1.5 km of a roadbook's line (OpenStreetMap, through Overpass, as the cameras are found,
ADR 0026) when its ride screen opens, and SHALL draw each on the map with a pump icon. The stations found are kept on the phone for 30
days, so that the next ride on the same roadbook needs no network. The list is all or nothing: when a stretch of the route could not be
asked, no station is shown and the rider is told so, never a list with a hole in it. Not having the stations SHALL NOT stop or delay a
ride.

#### Scenario: Stations on the map

- **WHEN** the rider opens a roadbook with three stations along it and the network works
- **THEN** three pump icons are on the map

#### Scenario: Back on the same roadbook

- **WHEN** the rider opens that roadbook again within 30 days, with no network
- **THEN** the same three pump icons are on the map

### Requirement: The next station

The ride screen SHALL show, inside its panel above the distance left (not among the chips on the map, which the map needs), a pump and the distance to the next station along the route, "No fuel ahead" when there is
none left, "No fuel" when the route has none, and "Fuel ?" when they could not be loaded. A station just passed (within 100 m) is
still the next. Pressing it SHALL open the fuel stops: the number of stations on the way, the longest stretch without fuel from
where the rider is, the next stations with their name or brand ("Fuel station" when they have none), their distance and how far off
the route they lie, and the tank range. A stretch longer than 80 % of the range SHALL be marked as a warning on the card. When the stations
could not be loaded the card SHALL say so and offer Try again.

#### Scenario: Next station

- **WHEN** the next station along the route is 10 km ahead
- **THEN** the chip says 10.0 km and is named "Next fuel stop in 10.0 km. Open the fuel stops"

### Requirement: The tank range

The rider SHALL set the range of the tank on the fuel card, among 100, 150, 200, 250, 300, 350 and 400 km, 200 km by default, one
tap changing it to the next. The choice SHALL be kept between launches.

#### Scenario: Changing the range

- **WHEN** the rider is on the fuel card with the default range of 200 km and taps the range
- **THEN** it becomes 250 km, then 300, 350, 400, 100 and 150 in turn, and the choice is still there at the next launch

### Requirement: A word before a long stretch

When the next station is within 3 km and the stretch after it (to the following station, or to the finish when there is none) is longer
than 60 % of the range, the system SHALL say it once: "Fuel stop in 2.5 km. The next one is 90 km after it." or, for the last one,
"Last fuel stop in 2.5 km. 112 km to the finish.", in the language in use. It is said in the Full and Alerts voice modes and not in Off
(spec voice-guidance). A station followed by another soon, or by the finish soon, SHALL NOT be announced.

#### Scenario: A long stretch after the station

- **WHEN** the range is 100 km, and the rider is 2.5 km before a station that is followed by 90 km without fuel
- **THEN** the sentence above is said once, and not again at the next position

### Requirement: What leaves the phone

Looking for the stations sends the coordinates of the roadbook's line, thinned to a point every kilometre, to the public Overpass servers,
once for each roadbook and month. Nothing else is sent, and no account or identifier goes with it. The privacy policy says so.

#### Scenario: Looking for stations

- **WHEN** the app looks for the fuel stations of a roadbook for the first time this month
- **THEN** the coordinates of the line, one point a kilometre, go to the public Overpass servers once for that roadbook and month, with no account or identifier

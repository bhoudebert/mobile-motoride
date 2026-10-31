# Roadbook Import Specification

## Purpose

Turn a GPX file made by agentRide into a roadbook the app can ride, and offer
the roadbooks the rider brings in.

## Requirements

### Requirement: Read GPX

The system SHALL read a GPX 1.0 or 1.1 document: the name and description from `metadata` (or the first `trk`/`rte` name), the stops from `wpt` (or `rtept` when there is no `wpt`), and the line from `trkpt` (or `rtept` when there is no `trkpt`). `lat` and `lon` SHALL be accepted in either attribute order. Points outside valid latitude or longitude, or without both, SHALL be ignored. A document yielding fewer than two line points SHALL be refused with an error naming the problem.

#### Scenario: A track and its stops

- **WHEN** a GPX holds 4,000 `trkpt` and 7 `wpt`
- **THEN** the roadbook has a 4,000-point line and 7 stops in file order

#### Scenario: A route only

- **WHEN** a GPX holds only `rtept` points
- **THEN** they are used as both the line and the stops

### Requirement: Roadbook totals

The system SHALL compute the roadbook's length as the sum of great-circle distances between consecutive line points, and SHALL tell a loop (first and last point within 500 m) from a one-way trip.

#### Scenario: A loop and a one-way trip

- **WHEN** a line whose first and last points are 300 m apart and another whose are 5 km apart
- **THEN** the first is a loop and the second a one-way trip, each with its length as the sum of great-circle distances between consecutive points

### Requirement: No roadbook ships with the app

The app SHALL ship no roadbook (ADR 0044). The list SHALL hold only what the rider brought in from a file or fetched from their server (spec roadbook-library). With none, the list SHALL say there is none yet and how to get one. The rider SHALL see each roadbook with name, length and loop or one-way, and SHALL open one to ride it.

#### Scenario: Open a roadbook

- **WHEN** the rider taps a roadbook in the list
- **THEN** the ride screen opens on that roadbook's line, ready to start

#### Scenario: A new install

- **WHEN** the app is opened with nothing kept and no server
- **THEN** the list says "No roadbook yet. Import a file to start."

### Requirement: The roadbook file

The system SHALL read a `motoride-roadbook` file of version 1 as specified in `docs/roadbook-format.md`: the line from its encoded polyline, the stops, the speed-limit stretches and the cameras. It SHALL refuse a file of another format, of a version above 1, without a line of two points, or that is not JSON, with an error naming the problem, and SHALL ignore fields it does not know. Optional parts that are missing or malformed SHALL be dropped without refusing the file. `npm run bundle:roadbooks` SHALL bundle a `.motoride.json` file in preference to the GPX of the same ride.

#### Scenario: A file from a newer agentRide

- **WHEN** a file says version 2
- **THEN** it is refused with "version 2 is newer than this app understands"

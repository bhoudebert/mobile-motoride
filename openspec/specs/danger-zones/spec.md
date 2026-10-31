# Danger Zones Specification

## Purpose

Warn the rider before a stretch known for fixed speed enforcement, in the way the law of the country allows (ADR 0021,
which replaces the "zones only" rule of ADR 0011).

## Requirements

### Requirement: Zones from the roadbook file

The system SHALL read the cameras of the roadbook file and place each on the line at the nearest point, ignoring any camera more than 40 m from the line (another road). Two cameras within 150 m of each other SHALL make one zone. A zone SHALL keep the bearing its cameras face, when the file gives one, the limit of its camera and the country of the line where it lies (from the `countries` of the file).

#### Scenario: Two cameras close together

- **WHEN** a roadbook file lists two cameras 100 m apart, one 20 m and one 60 m from the line
- **THEN** the first is placed on the line, the second, more than 40 m away, is ignored, and a zone keeps the bearing, the limit and the country of its camera

### Requirement: A policy by country

What may be said about a camera SHALL depend on the country (docs/danger-zones-by-country.md), with three policies: **exact** (its place and distance may be given: Belgium, Luxembourg, the Netherlands, Spain, Italy and the United Kingdom), **zones** (only a danger zone that does not give the place away: France) and **off** (nothing: Germany and Switzerland). A country that is not in the table, or a roadbook that does not say its countries, SHALL be **off**. The policy that applies SHALL be the stricter of the camera's country and the country the rider is in at that moment, so a rider in France is not told where a Belgian camera is, and a rider in Germany is told nothing; a warning held back by a stricter country SHALL be given once the rider is in a country that allows it, if the camera is still ahead. The policy SHALL apply to everything that tells of a camera: the warning on screen, the voice, the distance, and the markers on the map.

#### Scenario: A border

- **WHEN** a camera lies 300 m after the Belgian border and the rider comes from Germany
- **THEN** nothing is said in Germany, and once the rider is in Belgium the camera is warned of with its distance

#### Scenario: Unknown country

- **WHEN** a roadbook has cameras but no countries
- **THEN** no camera is warned of

### Requirement: Only the traffic the camera watches

A camera with a bearing faces approaching traffic: it watches vehicles travelling in the opposite direction to the bearing. A zone SHALL be warned only when the rider's direction of travel is within 90 degrees of that direction. The rider's direction SHALL be the GPS heading when the rider is moving at 10 km/h or more and the heading is known, otherwise the direction of the roadbook line at the zone. A zone whose cameras have no bearing SHALL be warned in both directions, since a camera whose direction is only forward or backward along an OpenStreetMap way cannot be placed on the route.

#### Scenario: The other carriageway

- **WHEN** a camera faces east (bearing 90) and the rider travels east
- **THEN** no warning is raised; travelling west, it is

### Requirement: Exact warning

Where the policy is exact, the system SHALL warn once per camera when it is within 600 m ahead and the rider is not off route, and re-arm it after it is passed. The warning SHALL read "SPEED CAMERA" with the distance and the camera's limit when it has one, SHALL be spoken as "Speed camera, 500 metres", and the map SHALL mark the camera. The warning SHALL sit under the instruction bar like a corner warning, and a corner warning takes the place of a camera warning when both are due.

#### Scenario: Approaching a camera in Belgium

- **WHEN** the rider is 550 m before a camera in Belgium
- **THEN** "SPEED CAMERA, 550 m ahead · 70 km/h" is shown and "Speed camera, 550 metres" is spoken once, and not again until the camera has been passed

### Requirement: Danger zone

Where the policy is zones, the system SHALL NOT use the words camera or radar, SHALL NOT count down to the camera and SHALL NOT mark it on the map. It SHALL warn once, as the rider enters the zone, "DANGER ZONE" with the distance left in the zone, spoken as "Danger zone for 2 kilometres", and clear it when the rider leaves it. The zone SHALL be at least as long as French practice asks for the road (protocol of 28 July 2011): 300 m in a built-up area (limit 50 or less), 2 km on an ordinary road, 4 km on a motorway (limit 100 or more), the kind being read from the limit of the road at the camera, else the camera's, else ordinary. The camera SHALL lie inside the zone and never at its middle: its place in the zone is a share between a quarter and three quarters of its length that comes from the camera's own coordinates, so that it is the same on each ride and cannot be deduced from the zone.

#### Scenario: A French zone

- **WHEN** the rider enters a zone in France on an ordinary road
- **THEN** "DANGER ZONE" shows with about 2 km to go and "Danger zone for 2 kilometres" is spoken once, with no distance to any camera

### Requirement: Off switch and release gate

The feature SHALL be a setting that can be off, and with it off nothing SHALL be warned or drawn. The switch SHALL only be able to take warnings away: it SHALL NOT allow what the country's policy forbids. Before a build is shared, the table of countries SHALL be checked again (docs/TESTING.md, release checklist), and Italy and the United Kingdom confirmed.

#### Scenario: The feature is switched off

- **WHEN** the rider switches danger zones off in the settings
- **THEN** nothing is warned or drawn, and switching on never allows what the country's policy forbids

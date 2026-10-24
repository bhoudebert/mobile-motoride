# Speed Limits Specification

## Purpose

Show the speed limit of the road at all times, and tell the rider, without needing to read, when they are
above it.

## Requirements

### Requirement: Limits from the roadbook file

The system SHALL read from the roadbook file (`docs/roadbook-format.md`) the limit of each stretch of the line, and SHALL turn each stretch, given as line point indexes, into a distance range along the line. A stretch whose indexes are outside the line, reversed or empty SHALL be ignored, and the rest of the file SHALL still be used. A roadbook from a GPX has no limits.

### Requirement: The limit at the rider

For each fix the system SHALL give the limit of the stretch the rider is on, whether it is posted or assumed, and the next different limit ahead within 800 m with its distance. Where no stretch covers the rider, the limit SHALL be the last known one, marked assumed, so the sign does not go blank on a gap in the data. The limit SHALL be unknown, never zero or invented, only before the first known stretch, when the roadbook has no limits at all, and while on an approach to the start or back to the route (ADR 0008, ADR 0012) that precedes the first known stretch.

#### Scenario: A gap in the data

- **WHEN** the rider passes the end of a 80 stretch and the next stretch starts 300 m later
- **THEN** the sign keeps reading 80, marked assumed, until the next stretch begins

#### Scenario: Entering a slower road

- **WHEN** the rider is on a 80 stretch and a 50 stretch starts 300 m ahead
- **THEN** the limit reads 80 and the next limit reads 50 in 300 m

### Requirement: The limit is always on screen

The ride screen SHALL show the limit at all times, while riding, in the demo and before the ride starts, in the HUD next to the rider's speed, as a round sign (white disc, red ring, black number) with a grey dashed sign and a question mark when unknown. An assumed limit SHALL be drawn the same way with a small mark that tells it is assumed. The next limit ahead SHALL be shown under the sign.

### Requirement: Over the limit

The rider SHALL be over the limit when the GPS speed exceeds the limit by more than 2 km/h. While over, the sign SHALL turn solid red with a white number, the speed figure SHALL sit on a solid red badge (red text would not be readable on the HUD), and the phone SHALL vibrate once when the rider goes over, at most once every 10 seconds. A screen reader SHALL be told "Over the speed limit". Nothing SHALL be spoken, so the voice stays for corners and turns. With an unknown limit or an unknown speed the rider is never over.

#### Scenario: Going over

- **WHEN** the limit is 50 and the GPS speed goes from 49 to 56 km/h
- **THEN** the sign turns red, the phone vibrates once, and when the speed returns to 51 the sign returns to white

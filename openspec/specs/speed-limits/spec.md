# Speed Limits Specification

## Purpose

Show the speed limit of the road at all times, and tell the rider, without needing to read, when they are
above it.

## Requirements

### Requirement: Limits from the roadbook file

The system SHALL read from the roadbook file (`docs/roadbook-format.md`) the limit of each stretch of the line, and SHALL turn each stretch, given as line point indexes, into a distance range along the line. A stretch whose indexes are outside the line, reversed or empty SHALL be ignored, and the rest of the file SHALL still be used. A roadbook from a GPX has no limits.

#### Scenario: A bad stretch

- **WHEN** a roadbook file has three limit stretches, one whose indexes are outside the line
- **THEN** that stretch is ignored, the other two become distance ranges along the line, and a roadbook from a GPX has no limits

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

#### Scenario: Before the ride starts

- **WHEN** the ride screen is open and the rider has not started
- **THEN** the limit is shown as a round sign, a grey dashed sign with a question mark when unknown, with a small mark when assumed, and the next limit ahead under it

### Requirement: Over the limit

The rider SHALL be over the limit when the GPS speed exceeds the limit by more than 2 km/h. While over, the sign SHALL turn solid red with a white number, the speed figure SHALL sit on a solid red badge (red text would not be readable on the HUD), and the phone SHALL vibrate once when the rider goes over, at most once every 10 seconds. A screen reader SHALL be told "Over the speed limit". Nothing SHALL be spoken, so the voice stays for corners and turns. With an unknown limit or an unknown speed the rider is never over.

#### Scenario: Going over

- **WHEN** the limit is 50 and the GPS speed goes from 49 to 56 km/h
- **THEN** the sign turns red, the phone vibrates once, and when the speed returns to 51 the sign returns to white

### Requirement: A limit on the way back to the route

On a route made to rejoin the roadbook or to reach a route point, the sign SHALL show the limit of the roadbook where the route joins it, marked assumed, instead of no limit, until a limit of the road the rider is on is known.

#### Scenario: Riding the way back

- **WHEN** the rider follows a rebuilt route towards a point of the roadbook whose limit is 90
- **THEN** the sign shows 90 as an assumed limit

### Requirement: The limit of the road the rider is on, found live

When the rider is off the roadbook, or on a way to it whose limit is only assumed, the sign SHALL show the limit of the road under them, asked of the public map matching service from a trail of their last positions (at most every 8 seconds and 80 m, never while a request is pending), as a posted limit when the road has one and as the legal default of the country, marked assumed, when it does not. A limit older than 90 seconds SHALL no longer be shown. Without a connection or an answer the sign SHALL keep what it had (the assumed limit of the roadbook where the way joins it), and SHALL say nothing more. On the roadbook the limits of the roadbook SHALL be the only ones used.

#### Scenario: Riding another road

- **WHEN** the rider is off route on a road posted 70 and the service answers
- **THEN** the sign shows 70, and goes red when the rider is more than 2 km/h over it

#### Scenario: Back on the roadbook

- **WHEN** the rider is back on the roadbook
- **THEN** the sign shows the limit of the roadbook again, and no request is made

#### Scenario: No answer

- **WHEN** the service does not answer
- **THEN** the sign keeps the assumed limit it had, with no message

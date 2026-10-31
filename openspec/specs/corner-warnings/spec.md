# Corner Warnings Specification

## Purpose

Find the corners of the roadbook line that call for a lower speed, and warn
the rider early enough to act.

## Requirements

### Requirement: Detect corners on the line

The system SHALL resample the line every 10 m, compute for each sample the radius of the circle through the points 20 m before, at, and 20 m after it, and mark samples with a radius under 120 m. Consecutive marked samples turning the same way, with gaps under 30 m, SHALL form one corner. A corner turning less than 30 degrees in total SHALL be discarded as noise. Each corner SHALL report its start and end distance along the line, its minimum radius, its direction (left or right) and its total angle.

#### Scenario: A hairpin

- **WHEN** the line makes a half-circle of 15 m radius
- **THEN** one corner is reported, direction matching the turn, minimum radius near 15 m, angle near 180 degrees

#### Scenario: GPS jitter on a straight

- **WHEN** points of a straight road jitter sideways by 3 m
- **THEN** no corner is reported

### Requirement: Severity and advisory speed

A corner SHALL be a `hairpin` when its minimum radius is below 25 m and it turns at least 100 degrees; otherwise `sharp` when its minimum radius is below 60 m and it turns at least 45 degrees; otherwise a `bend`. The angle condition keeps the junction turns and the single-vertex kinks of a sparse GPX line from being announced as reversals. Its advisory speed SHALL be the square root of 3 m/s² times its minimum radius, converted to km/h and rounded down to a multiple of 5, never below 10.

#### Scenario: A 90 degree turn at a junction

- **WHEN** the line turns 90 degrees with a 15 m radius
- **THEN** the corner is `sharp`, not `hairpin`

### Requirement: Warn in time

While riding, the system SHALL warn once per corner of severity `hairpin` or `sharp` when the corner's start is within the look-ahead distance: the current speed times 8 s, at least 150 m and at most 600 m. The warning SHALL carry the severity, direction, distance and advisory speed. After the corner's end is passed the warning SHALL be armed again, so a loop ridden twice warns twice. A bend SHALL NOT raise a warning in version 1. No warning SHALL be raised while off route.

#### Scenario: Approaching a hairpin at 60 km/h

- **WHEN** the rider at 60 km/h is 130 m before a hairpin
- **THEN** one warning is raised, and none again until the hairpin has been passed

### Requirement: Say it

The ride screen SHALL show the warning as a large banner and SHALL speak it (for example "Hairpin left, 150 metres, 30"), without input and without the network. The app SHALL present advisory speeds as guidance, not as a safety guarantee.

#### Scenario: A hairpin ahead, no network

- **WHEN** the rider approaches a hairpin left 150 m ahead with an advisory speed of 30 and the phone has no network
- **THEN** the ride screen shows a large banner and the app says "Hairpin left, 150 metres, 30" aloud, and the advisory is presented as guidance, not as a guarantee

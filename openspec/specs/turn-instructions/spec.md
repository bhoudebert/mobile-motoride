# Turn Instructions Specification

## Purpose

Tell the rider what comes next on the roadbook line, in the words of a GPS: how far
straight, then which way to turn. The roadbook is only a line, so turns are found
from its geometry.

## Requirements

### Requirement: Maneuvers from the line

The system SHALL treat as a maneuver each corner (see corner-warnings) that turns at least 55 degrees and either is a hairpin or spans at most 90 m along the line. Gentler or longer curves are part of the road and SHALL NOT be announced as maneuvers. A maneuver SHALL be placed at the middle of its corner, be `left` or `right`, and be a U-turn when it turns at least 150 degrees.

#### Scenario: A junction turn

- **WHEN** the line turns 90 degrees within 25 m
- **THEN** it is a maneuver; a 90 degree sweep over 150 m is not

### Requirement: The instruction

For each fix the system SHALL give one instruction from the next maneuver not yet passed. While it is 500 m or more away the instruction SHALL read `Straight <distance>`; closer, `Left in <distance>`, `Right in <distance>` or `U-turn in <distance>`. When no maneuver remains it SHALL read `Straight <distance>` to the finish until 500 m, then `Finish in <distance>`. When the following maneuver is at most 300 m after the next, the instruction SHALL also carry `then left` or `then right`. A maneuver SHALL count as passed 15 m after its middle. Distances SHALL be rounded to 10 m below 1 km and shown in kilometres with one decimal above.

#### Scenario: Far from the turn

- **WHEN** the next maneuver is a left turn 1,240 m ahead
- **THEN** the instruction reads "Straight 1.2 km"

#### Scenario: Close to the turn

- **WHEN** the next maneuver is a left turn 150 m ahead and a right turn follows 200 m later
- **THEN** the instruction reads "Left in 150 m" with "then right"

### Requirement: Wrong way and rejoining are instructions too

The instruction SHALL also read "U-turn, wrong way" while the rider goes the wrong way, and "Rejoin the route, <distance>, <direction>" while off route (spec ride-navigation), the direction being one of ahead, ahead left, left, behind left, behind, behind right, right, ahead right relative to the rider's heading, or a compass point when the heading is unknown. The glyph SHALL be a U-turn arrow for the first, and an arrow turned towards the target for the second.

### Requirement: Shown at the top

The ride screen SHALL show the instruction at the top in large type with an arrow, and SHALL replace it with `Off route` and the distance to the line while the rider is off route. A corner warning SHALL appear under it, never over it.

### Requirement: Bearing along the line

The system SHALL give the bearing of the line at the rider's progress, so the rider marker and the camera point the way the roadbook goes, not the way a noisy GPS heading says.

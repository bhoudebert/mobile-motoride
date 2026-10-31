# Junction Guidance Specification

## Purpose

Show the rider, before it comes, which exit to take at a roundabout and which lanes to be in on a wide road, as a
diagram that can be read at a glance (ADR 0018).

## Requirements

### Requirement: Junctions from the roadbook file

The system SHALL read the `junctions` of the roadbook file (docs/roadbook-format.md) and place each on the line by its
point index. A **roundabout** entry carries the bearings of its exits relative to the way the rider enters, in any order, which one the
roadbook takes, and optionally which side traffic keeps (right by default). The system SHALL number the exits as traffic meets them: starting from the entry, counterclockwise where traffic keeps right, so the first exit is the first on the right and a road straight back is the last, and clockwise where it keeps left. A **lanes** entry carries the number of lanes, which
of them (counted from the left, from 0) lead on along the roadbook, and optionally the arrow each lane carries. A
junction that is not understood (a bad index, an exit number outside the exits, lanes to use outside the lanes, fewer
than two lanes) SHALL be dropped and the rest of the file kept. A roadbook without junctions SHALL guide as before.

#### Scenario: A roundabout and a bad lanes entry

- **WHEN** a roadbook file has a roundabout with three exits, traffic keeping right, and a lanes entry with one lane
- **THEN** the roundabout is placed on the line with its exits numbered from the first on the right, and the lanes entry, fewer than two lanes, is dropped while the rest of the file is used

### Requirement: Say which exit, in words

When a roundabout is ahead, the instruction at the top SHALL name the exit as an ordinal: "2nd exit" with "Roundabout" and the distance under it (its whole sentence, "Roundabout, 2nd exit", is what a screen reader and the log get), and a roundabout with a single exit from the rider's side ("1st exit") SHALL still be named. The
distance SHALL count down in the same steps as other instructions. A roundabout SHALL be announced once, at 300 m, and
spoken: "At the roundabout, take the second exit". Ordinals SHALL be spelled first to twelfth, then 13th, 14th.

#### Scenario: Third exit

- **WHEN** the rider is 250 m before a roundabout and the roadbook leaves it by its third exit
- **THEN** the top reads "3rd exit", "Roundabout · in 250 m", and "At the roundabout, take the third exit" is spoken once

### Requirement: Show the roundabout

From 300 m before a roundabout until the rider has left it, the screen SHALL show a diagram: the ring, a spoke for
each exit in its true direction, the entry at the bottom, the exits numbered in the order they are met, and the exit
to take highlighted (filled and larger) with the others muted. The diagram SHALL be readable without colour alone: the
exit to take SHALL carry its number in a filled disc, the others only an outline. It SHALL stay clear of the map controls and
the bottom panel, and SHALL be hidden from screen readers (the instruction says the same in words).

#### Scenario: Approaching a roundabout

- **WHEN** the rider is 300 m before a roundabout whose second exit is to take
- **THEN** a diagram shows the ring, a spoke for each exit in its true direction, the entry at the bottom, and the second exit filled, larger and numbered in a disc, while a screen reader gets the same in the instruction

### Requirement: Show the lanes

A lane guide SHALL exist only for a road with more than one lane in the rider's direction where the lane matters; an ordinary road with one lane each way SHALL show nothing, and so SHALL a road where every lane leads on.

From 600 m before a lane guide until the rider has passed it, the screen SHALL show the lanes of the road as bars side
by side, the left lane on the left, the lanes to take highlighted and the others muted, each carrying its arrow when the file
gives one. The top bar SHALL say it in words, short enough to fit beside the settings button: "Keep left" over "Lanes 1 and 2", "Keep right", "Lanes 2 and 3" over "of 4" for lanes that are not a left or right block, "Left lane" or "Right lane" for one lane. The spoken form is the whole sentence: "Keep left, lanes 1 and 2", "Stay in lanes 2 and 3 of 4", "Keep in the right lane". It SHALL be spoken once, at 600 m. When a roundabout and a lane guide are due together, the roundabout SHALL be shown
and the lanes follow once it is behind.

#### Scenario: Four lanes, the two on the left

- **WHEN** the rider is 500 m before a road of four lanes where only the two on the left lead on
- **THEN** four bars are shown, the left two highlighted, and "Keep left" over "Lanes 1 and 2" is shown in the top bar and "Keep left, lanes 1 and 2" was spoken once

### Requirement: Not when lost

A junction SHALL NOT be shown, announced or spoken to a rider who is off route, in the approach to the roadbook, or going the wrong way; a rider who rejoins the line before a junction SHALL be guided to it as usual, and it SHALL be announced once per pass of the line so a loop ridden twice announces twice.

#### Scenario: Off route before a junction

- **WHEN** the rider is off route and reaches the place of a roundabout
- **THEN** it is not shown, announced or spoken; and a loop ridden twice announces its roundabout twice

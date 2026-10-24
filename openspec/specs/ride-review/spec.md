# Ride Review Specification

## Purpose

Look back at a ride: where it went and how fast, what the bike did in the corners and under braking, and replay it, from the GPX the phone
kept (spec ride-recording, ADR 0034).

## Requirements

### Requirement: Open a ride from My rides

Each ride in My rides SHALL offer **Review**, which opens the review of that ride; Back SHALL return to My rides. A ride whose file cannot
be read, or that holds fewer than two points, SHALL say so instead of showing an empty review. Nothing leaves the phone: the review is
computed on the phone from the GPX file.

#### Scenario: Review a ride

- **WHEN** the rider presses Review on a ride in My rides
- **THEN** the review of that ride opens, with its map, its figures and its replay

### Requirement: The figures of a ride

The review SHALL show, from the track: the distance, the duration, the time moving (stops longer than a minute do not count), the average
speed while moving, the top speed, and the climb and descent when the GPS gave altitudes. When the ride was recorded with the lean and braking
gauges on, it SHALL also show the peak lean to each side, the highest lateral G, the hardest braking G and the hardest acceleration G, in
the units of the gauges (spec instruments). A figure the file does not hold SHALL NOT be shown, never as 0.

#### Scenario: A ride without the gauges

- **WHEN** a ride was recorded with the lean and braking gauges off
- **THEN** the review shows distance, durations, speeds and climb, and no lean or G

### Requirement: The map of the ride

The review SHALL draw the track on the map, in four colours by speed (under 40, 40 to 70, 70 to 100 and over 100 km/h) with a legend, the
map framing the whole track. When the gauges were on it SHALL mark the point of the peak lean and the point of the hardest braking on the map, and offer each as
a button named with its value that jumps the replay to that point. The map follows the look in use (spec appearance).

#### Scenario: Peaks on the map

- **WHEN** a ride has a peak lean of 38° to the left and a braking of 0.7 G
- **THEN** the map marks where each happened, and two buttons say "Peak lean 38° L" and "Hardest braking 0.70 G"

### Requirement: Profiles

The review SHALL show the speed along the ride and, when the GPS gave altitudes, the altitude along the ride, as two compact profiles over the
distance, with the place of the replay marked on them.

### Requirement: Replay

The review SHALL replay the ride: a marker moving along the track, with Play and Pause, a speed of replay (×10, ×30, ×100, ×300, changed
by one control), and a bar to jump anywhere by touching or dragging it. The replay SHALL show at the marker the time of day, the speed, the altitude, and the
lean and braking when the file holds them. Stops longer than 30 seconds SHALL be shortened to 30 seconds in the replay so that a lunch
break does not stop it. At the end the replay SHALL stop on the last point, and Play SHALL start again from the beginning.

#### Scenario: Replay at ×30

- **WHEN** the rider presses Play at ×30 on a two-hour ride
- **THEN** the marker follows the track and reaches the end after about four minutes, the readout changing as it goes

### Requirement: Rides stay usable elsewhere

The GPX a ride is saved as SHALL stay the one contract of a ride: the review reads the same file that is shared, with its `motoride:`
extensions, and any other tool that reads GPX reads it too (agentRide's review among them). The figures of the review are computed by pure
functions that take the points, so the same figures can be computed elsewhere, for example by a server that keeps rides (ADR 0028).

# Ride Recording Specification

## Purpose

Keep what was really ridden, whether the roadbook was finished or not, so the rider can share it later, for instance with agentRide to review the ride (ADR 0027).

## Requirements

### Requirement: Record a GPS ride

While a ride on the phone's GPS runs (not a demo and not a scripted ride), the app SHALL record the track: the position, the time, the speed and, when the GPS gives it, the altitude of the fixes, leaving out fixes with an accuracy worse than 50 m and, when the rider is standing still, the ones within 5 m of the last kept. A pause SHALL NOT end the recording: the ride is one ride from Start to End. The recording SHALL be written to the phone about once a minute while it runs, so that a closed or crashed app loses at most that minute.

#### Scenario: A pause

- **WHEN** the rider pauses for a coffee and resumes
- **THEN** the track is one ride, with the pause in it

### Requirement: Save it as it is

When the ride ends, by End, by leaving the ride, or because the app was closed, the track SHALL be saved as a GPX file whatever the state of the ride: finished or not. It SHALL be marked completed when the rider reached the end of the roadbook, stopped early when not, and recovered when it was found after the app was closed without ending it. A track of less than 50 m or fewer than two points SHALL NOT be kept. The file SHALL be a GPX 1.1 with a track of the fixes and, in the metadata, the roadbook it followed (its name and identifier, and where it came from when it came from agentRide, with that program's own number for it), the state, the start and end times and the distance. The rider SHALL be told, once, where to find it.

#### Scenario: Stopped early

- **WHEN** the rider ends a ride after 12 km of a 120 km roadbook
- **THEN** a GPX of those 12 km is saved, marked stopped early, with the roadbook's name

#### Scenario: App closed

- **WHEN** the app was killed during a ride and is opened again
- **THEN** the track up to the last write is saved as a recovered ride

### Requirement: Keep the readings of the gauges

When lean or braking is on and the phone is calibrated (spec instruments), each point of the track SHALL also carry the lean, the lateral G, the braking G and the smoothed turning rate at that moment. The GPX SHALL write the altitude as the point's standard elevation and the sensor readings as extensions in the application's own namespace, which another program ignores, and its metadata SHALL carry the climb when the track has altitudes and the peak lean to the left and to the right when it has lean readings. The list of rides SHALL say them under the ride's line, as "Climb 412 m · Lean 38° L · 41° R", and say nothing for a ride that has none. A ride made without the gauges SHALL be saved as before.

#### Scenario: A ride with lean on

- **WHEN** the rider ends a ride made with lean on and the phone calibrated
- **THEN** the GPX has a lean, a lateral G, a braking G and a turning rate on each point, and My rides shows the peak leans

### Requirement: My rides

The menu SHALL open the list of recorded rides, newest first, each with the roadbook's name, the date, the distance, the duration and its state. The rider SHALL be able to share a ride's GPX file through the phone's share sheet (which also saves it to the phone, a cloud folder or another app), and delete it after a question. With none, the list SHALL say where they come from.

#### Scenario: Share

- **WHEN** the rider taps Share on a recorded ride
- **THEN** the phone's share sheet opens with the GPX file

### Requirement: Which roadbook it followed

The GPX SHALL say which roadbook the ride followed in a way another program can check: the roadbook's name and its identifier in this app, and, for a roadbook that came from agentRide, the program's own number for it with its name. An identifier alone SHALL NOT be enough to match, because numbers repeat from one library to another: a reader SHALL take a match only when the name agrees too.

#### Scenario: A number that means something else

- **WHEN** a reader finds roadbook number 7 named "Eifel loop" in a track and its own roadbook 7 is named "Pays des Collines"
- **THEN** it does not take them for the same

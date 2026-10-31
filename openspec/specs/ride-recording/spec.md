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

A ride SHALL NEVER be lost to a failed save. The checkpoint written while the ride ran SHALL be deleted only once the track is on the phone: when the save fails (the phone is full, a write is cut), the checkpoint SHALL be kept, put aside under its own name so that the next ride's checkpoint cannot replace it, and saved as a recovered ride at the next launch, and again at each launch until it is. A file the app could not fill SHALL NOT be left behind empty.

#### Scenario: The phone cannot write the track

- **WHEN** a ride ends and the track cannot be written
- **THEN** no ride is listed, the checkpoint is kept, and at the next launch the ride is saved as recovered and the rider is told

#### Scenario: A track without its summary

- **WHEN** a track is on the phone but its summary (the small file the list reads) is missing or unreadable, as when a save was cut between the two
- **THEN** the ride is listed all the same, its summary rebuilt from the GPX (the roadbook and where it came from, the state, the times, the distance, the climb and the peaks when the file says them, else worked out from the points) and written back, the track is not touched, and the ride can be shared; a file with fewer than two points is left alone and not listed

### Requirement: Keep the readings of the gauges

When lean or braking is on and the phone is calibrated (spec instruments), each point of the track SHALL also carry the lean, the lateral G, the braking G and the smoothed turning rate at that moment. The GPX SHALL write the altitude as the point's standard elevation and the sensor readings as extensions in the application's own namespace, which another program ignores, and its metadata SHALL carry the climb when the track has altitudes and the peak lean to the left and to the right when it has lean readings. The list of rides SHALL say them under the ride's line, as "Climb 412 m · Lean 38° L · 41° R", and say nothing for a ride that has none. A ride made without the gauges SHALL be saved as before.

#### Scenario: A ride with lean on

- **WHEN** the rider ends a ride made with lean on and the phone calibrated
- **THEN** the GPX has a lean, a lateral G, a braking G and a turning rate on each point, and My rides shows the peak leans

### Requirement: My rides

The menu SHALL open the list of recorded rides, newest first, each with the roadbook's name, the date, the distance, the duration and its state. The rider SHALL be able to share a ride's GPX file through the phone's share sheet (which also saves it to the phone, a cloud folder or another app), and delete it after a question that says what is lost. The actions of a ride SHALL be icons, not words (a chart for the review, a cloud with an arrow for sending, the share arrow, a bin), each a 48 dp target with the icon at 24 dp, 8 dp apart, with a disc behind it while pressed and a name for a screen reader; the review, the send and the share stand together and the bin alone at the other end of the row, out of reach of a slip. The place of the send is kept when it changes: a spinner while it goes, and, once the ride is on the server, a cloud with a check that is a status, not a button. The question that asks before a delete keeps its words: for a ride never sent to a server, "This ride is only on this phone. If you delete it, it is lost for good."; for one that was, "Delete it from this phone? It stays on your server." With none, the list SHALL say where they come from.

#### Scenario: Share

- **WHEN** the rider taps Share on a recorded ride
- **THEN** the phone's share sheet opens with the GPX file

### Requirement: Send it to the rider's server

When the rider has a server (spec server-features), a recorded ride SHALL be sendable to it, as the GPX exactly as kept on the phone (`PUT /rides/<ride id>` with the rider's token, agentRide's contract "Uploading a recorded ride"; the same id and file again is harmless, so a send that got no answer is simply sent again). The notice that says a ride was saved (or recovered) SHALL carry "Upload to server", and every ride in My rides that is not on the server SHALL offer the same, in case the rider missed it; nothing is offered without a server. On the server's answer (201 or 200) the ride SHALL be marked as on the server in its summary (`uploadedAt` and `serverRideId`), and the list SHALL say, under the ride's state, "On your server, sent <date>", or "Only on this phone" when a server is enrolled and the ride is not on it. A server that cannot be reached, refuses the phone, keeps 200 rides already, finds the ride too large, is asked too often, or does not know rides SHALL be told in words and the ride SHALL stay as it was, on the phone. Deleting a ride on the phone SHALL NEVER call the server, and a summary rebuilt from a GPX (spec above) does not know the ride was sent: it is offered again, which is harmless.

#### Scenario: Missed at the end of the ride

- **WHEN** a ride was saved and the notice has gone, and a server is enrolled
- **THEN** My rides shows "Only on this phone" and an "Upload to server" action on that ride; pressing it sends the ride and the row says "On your server, sent <date>"

#### Scenario: Deleting a ride that was never sent

- **WHEN** the rider deletes a ride that is only on the phone
- **THEN** the question says the ride is lost for good, and nothing is sent to the server

#### Scenario: The server is not there

- **WHEN** the rider sends a ride and the server cannot be reached
- **THEN** the screen says so and that the ride is still on the phone, and the ride is not marked as on the server

### Requirement: The rides of the server

When the rider has a server, My rides SHALL list the rides the server keeps (agentRide `GET /rides`) with those of the phone, so that a ride recorded on one phone shows on another: one row for each ride id (the same id is the same ride; it is the start time and the roadbook's slug, set by the phone that recorded it), newest first, each marked where it is: "Only on this phone", "On your server, sent <date>" (on both), or "Only on your server". The server is read when My rides opens and on a pull down, quietly: with no server, offline, or an answer that fails, the list SHALL be the phone's rides, with no error. When the server answers it is the truth about what it keeps: a ride the phone marks as sent that the server does not list is "Only on this phone" again and offers the send; without an answer the phone's own mark is used and no ride is added. A row for a ride only on the server shows what the server says (the roadbook's name, the date, the distance, the duration and, when it says them, the state, the climb and the peak leans).

A ride only on the server SHALL offer **Save to this phone** (its GPX, `GET /rides/<id>`, is kept exactly as the server holds it with its summary rebuilt from it and marked as on the server, so it is not sent again) and **Review**, which keeps it the same way and then opens its review. The row is then the one ride on both. Deleting on the phone SHALL NEVER call the server: a ride the server still keeps shows again as "Only on your server". Removing a ride from the server (`DELETE /rides/<id>`) SHALL be its own action, apart from the delete of the phone's, with its own question: "Remove it from your server? It stays on this phone." when the phone has it, and "This ride is only on your server. If you remove it, it is lost for good." when it does not; it never touches the phone's copy. A server that does not answer is told in words and changes nothing.

#### Scenario: A ride recorded on another phone

- **WHEN** the rider opens My rides on a phone that has not recorded a ride the server keeps
- **THEN** the list has one row for it, "Only on your server", with its name, date, distance and duration, and Save to this phone and Review

#### Scenario: Both places

- **WHEN** a ride is on the phone and on the server
- **THEN** the list has one row for it, marked "On your server, sent <date>"

#### Scenario: Deleted on the phone

- **WHEN** the rider deletes on the phone a ride the server keeps
- **THEN** nothing is sent to the server and the ride shows again as "Only on your server"

#### Scenario: No way to the server

- **WHEN** the phone is offline or the server does not answer
- **THEN** My rides lists the phone's rides and shows no error

### Requirement: Which roadbook it followed

The roadbook is what the app rode on: a ride that has no agentRide origin (a roadbook imported from a GPX, or a route to a place) SHALL simply carry no origin, in its summary and its GPX, and is listed and shared like any other; a summary rebuilt from a GPX that names no roadbook has an empty roadbook identifier and takes its name from the GPX. The GPX SHALL say which roadbook the ride followed in a way another program can check: the roadbook's name and its identifier in this app, and, for a roadbook that came from agentRide, the program's own number for it with its name. An identifier alone SHALL NOT be enough to match, because numbers repeat from one library to another: a reader SHALL take a match only when the name agrees too.

#### Scenario: A number that means something else

- **WHEN** a reader finds roadbook number 7 named "Eifel loop" in a track and its own roadbook 7 is named "Pays des Collines"
- **THEN** it does not take them for the same

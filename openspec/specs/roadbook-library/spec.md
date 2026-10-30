# Roadbook Library Specification

## Purpose

Let the rider bring roadbooks into the app themselves, from a GPX file of any route app or a roadbook file of agentRide, and keep them on the phone, with no server (ADR 0025).

## Requirements

### Requirement: Import a file

The app SHALL import a roadbook from a file in two formats, told apart by what the file holds and not by its name: a `motoride-roadbook` file (spec roadbook-import) and a GPX document. The rider SHALL be able to bring a file in by choosing it from the phone ("Import a roadbook" in the menu and on the roadbook list), by sharing it to the app or opening it with the app from another app, and by a link `mobilemotoride://import?url=<address>` that makes the app download the file at that address. A file that is neither, that cannot be read or downloaded, or that holds no line of two points SHALL be refused with a message that says why and leaves everything as it was. An address that is not http or https SHALL be refused.

#### Scenario: A GPX shared from another app

- **WHEN** the rider shares a GPX file of 800 points and 3 waypoints to the app
- **THEN** the ride opens on a roadbook of that line with those stops

#### Scenario: Not a roadbook

- **WHEN** the rider picks a photo or a text file
- **THEN** the app says it is not a roadbook or a GPX file and stays where it was

### Requirement: Keep what was imported

An imported roadbook SHALL be kept on the phone, as the same roadbook the app reads, until the rider deletes it, and SHALL survive restarts and updates of the app. Importing the same route again (same line and name) SHALL replace the earlier copy, not add a second. The roadbook list SHALL show the imported roadbooks first, marked as imported, then the bundled ones, and SHALL offer to delete an imported one after asking; a bundled roadbook cannot be deleted. Opening an imported roadbook SHALL put it in the recent rides like any other. A file kept on the phone that can no longer be read SHALL be left out of the list, not crash it.

#### Scenario: Same file twice

- **WHEN** the rider imports the same GPX twice
- **THEN** the list has it once

#### Scenario: Delete

- **WHEN** the rider deletes an imported roadbook and confirms
- **THEN** it is gone from the list and from the phone

### Requirement: A refreshed roadbook replaces its old copy

A roadbook file that carries an `origin` with an app, a roadbook number and a name SHALL replace the kept roadbook with the same app, number AND name, in place, keeping its local id so the rides recorded on it stay linked. The same number under another name is another library's roadbook and SHALL be kept as a new one. A file with no origin, and a GPX, SHALL behave as before (the same name and line replace). When both files carry `generatedAt` and the incoming one is older than the kept one, the app SHALL NOT replace it: the newer copy stays, opens, and a message says the older file was not imported. The same time, or no time, replaces.

#### Scenario: The route changed

- **WHEN** the rider imports a file of origin agentRide, number 7, name "Loop", then a refreshed file of the same origin with another route
- **THEN** the list has one "Loop", with the new route and the id of the first

#### Scenario: Same number, other name

- **WHEN** a kept roadbook is agentRide 7 "Loop" and the rider imports agentRide 7 "Coast"
- **THEN** the list has both

#### Scenario: An older file

- **WHEN** the kept copy was generated on 20 October and the rider imports the same roadbook generated on 10 October
- **THEN** the kept copy is unchanged, it opens, and a message says a newer version is already kept

### Requirement: Complete an imported GPX

A roadbook that comes in with no speed limits and no countries (a GPX) SHALL be completed once, at import, with what public services know of its roads (ADR 0026): the speed limit of each stretch (the posted one, else the legal default of the country, capped on minor roads and 50 at most in a built-up area), the country of each stretch, the roundabouts with their exits, and the fixed speed cameras along it. The line SHALL be sent thinned to about one point in thirty metres, in pieces for a long route, and matched to the roads; what comes back SHALL be laid on the imported line. While it runs the screen SHALL show that it is working with a percentage. The result SHALL be kept with the roadbook and ridden like an agentRide roadbook, with the camera policy of the country (spec danger-zones). A roadbook file that already has limits or countries SHALL NOT be sent.

#### Scenario: A GPX of a loop through France and Belgium

- **WHEN** the rider imports a GPX of such a loop with the network on
- **THEN** after a few seconds the ride opens with a speed limit along the whole line, its countries and its roundabouts

### Requirement: When the services cannot complete it

When the roads cannot be matched, or the services cannot be reached, the roadbook SHALL still be imported and kept, as it was, with a message that says why and that it can be tried again; the list SHALL offer "Add speed limits and cameras" on it until it succeeds. When only the cameras cannot be had (the services shed load; the app tries a mirror and waits before giving up) the limits, countries and roundabouts SHALL be kept, the message SHALL say the cameras are missing, and the offer SHALL stay. An imported GPX that has not been completed SHALL be ridden with the guidance computed from its geometry (turns and corner warnings), the speed limit unknown and no camera warning (spec danger-zones).

#### Scenario: No network

- **WHEN** the rider imports a GPX with no network
- **THEN** it is kept, its ride opens, a message says it was imported without speed limits, and the list offers to add them

### Requirement: Each tile shows its route

Each roadbook of the list SHALL have the shape of its route drawn faintly behind its name and figures (north up, in proportion, a few dozen points of the line), not a plain background. The drawing SHALL not be read by a screen reader and SHALL NOT make the text harder to read.

#### Scenario: The shape behind the tile

- **WHEN** the list of roadbooks is shown
- **THEN** each tile carries the drawn shape of its own line

# Ride Navigation Specification

## Purpose

Follow a roadbook with the phone's GPS and keep the rider informed without
asking for input.

## Requirements

### Requirement: Progress along the line

For each fix the system SHALL snap the rider to the roadbook line and report the distance ridden, the distance remaining, and the distance to the next stop. Snapping SHALL search forward from the last known position within a window, so a loop that passes the same place twice is not confused, and SHALL fall back to a full search only when the rider is off route.

#### Scenario: A loop crossing itself

- **WHEN** a loop passes the same junction at 10 km and at 80 km and the rider is on the second pass
- **THEN** the distance ridden reads about 80 km, not 10 km

### Requirement: Next stop

The system SHALL report the next stop not yet passed, its name and its distance along the line. A stop SHALL count as passed when the progress goes beyond its position along the line.

### Requirement: Off route

The system SHALL flag the rider as off route when the distance to the line exceeds 50 m for three consecutive fixes, and SHALL clear the flag at the first fix within 50 m. In version 1 the app SHALL show the flag and the distance to the line; it SHALL NOT reroute.

#### Scenario: A single noisy fix

- **WHEN** one fix is 80 m away and the next two are within 15 m
- **THEN** the rider is never flagged off route

### Requirement: Controls clear of the camera

Every screen SHALL keep its first control and its first line of text below the system area at the top (the status bar on Android,
the notch or Dynamic Island on iOS), so none is hidden behind the camera or too close to be reached.

#### Scenario: An iPhone with a Dynamic Island

- **WHEN** the ride screen is shown on an iPhone whose system area is 59 points high
- **THEN** the instruction bar starts 8 points below that area

### Requirement: Ride screen

The ride screen SHALL show the map with the roadbook line, the rider's position following the heading, speed, distance remaining and the next stop, and SHALL keep the screen on. It SHALL need no input while riding and SHALL show a plain-language notice when location permission is refused.

### Requirement: Track only with permission

The map SHALL follow the rider (location puck, camera tracking) only once foreground location permission is granted, never while the permission dialog is open or after a refusal, because the native location layer fails without it. A JavaScript error on the ride screen SHALL show its message and a way back to the list instead of closing the app.

#### Scenario: First Start

- **WHEN** the rider taps Start and the permission dialog appears
- **THEN** the map does not track the position until the rider allows location

### Requirement: Location while riding

The app SHALL request foreground location with high accuracy at 1 s intervals during a ride. Background location SHALL be added with the foreground service in a later change; until then the ride screen SHALL say it must stay open.

### Requirement: Look

The app SHALL use the roadbook look of agentMotoride: paper background, ink text, moss panels, rust for hairpins and signal yellow for sharp corners, with Space Grotesk and JetBrains Mono. The route SHALL be drawn in moss with a paper casing, hairpins in rust, sharp corners in signal yellow and stops in moss. Text on a rust or ink banner SHALL be paper, on a signal banner ink, so every banner stays readable in sunlight.

### Requirement: Map without tiles

The roadbook SHALL be followable with no tile provider and no network: the map draws the roadbook line, the stops and the corner markers on a plain paper-coloured background whenever the basemap is Off or cannot load.

### Requirement: Optional basemap

The ride screen SHALL offer a Map button that cycles the basemap through Light, Colour and Off, starting on Light. Light and Colour SHALL show roads, place names and landmarks from OpenFreeMap (OpenStreetMap data, no key) under the roadbook; the roadbook line, arrows, corner markers, stops and rider SHALL stay on top and readable. While a basemap is shown the screen SHALL display its attribution ("© OpenStreetMap contributors, OpenFreeMap") just above the row of chips (Find, weather, fuel), clear of the gauges, so that it can be read. When the basemap style fails to load, or cannot be reached, the screen SHALL fall back to Off and say so, and nothing else on the ride screen SHALL depend on it. Reachability SHALL be checked with one small request (HEAD, 6 second limit) each time a basemap is chosen, because a style kept in the cache loads offline without any failure to report. A style URL given in `EXPO_PUBLIC_MAP_STYLE_URL` SHALL replace the Light style.

#### Scenario: No network

- **WHEN** the phone has no connection and the rider opens a roadbook
- **THEN** the map falls back to the plain background, the roadbook line is drawn, and instructions and warnings work as usual

### Requirement: Direction on the line

The line SHALL carry arrows along it pointing the way of the roadbook, and the rider SHALL be shown as a marker pointing along the line.

### Requirement: Camera and controls

While riding the camera SHALL follow the rider, turned along the line. Touching the map SHALL stop the following. The ride screen SHALL offer zoom in, zoom out, a recenter button that resumes following, and an overview button that fits the whole roadbook, north up.

### Requirement: Demo ride

The ride screen SHALL offer a demo that rides the roadbook at 100 km/h without GPS, from 700 m before the first hairpin or sharp corner, so instructions, warnings and the map can be seen without riding. The demo SHALL use the same navigator as a real ride and SHALL be labelled as a demo.

The demo SHALL be pausable: a Pause button SHALL freeze the position, the instruction, the sign and the warnings exactly as they are, so the screen can be read or inspected, and Resume SHALL continue from the same place, never from the start. Stop SHALL end a paused demo, and the next demo SHALL start from its beginning, not paused.

#### Scenario: Reading a warning

- **WHEN** a corner warning is on screen in the demo and the rider taps Pause
- **THEN** nothing on the screen changes until Resume, which carries on from the same point

#### Scenario: Demo near a corner

- **WHEN** the rider taps Demo
- **THEN** the position moves along the line, the instruction counts down, and the first corner warning is raised and spoken

### Requirement: Approach to the start

When the rider taps Start and the first fix is more than 150 m from the roadbook line, the app SHALL guide the rider to the start of the roadbook before the roadbook itself. It SHALL route from the rider's position to the roadbook's first point on the motorcycle profile of the public Valhalla service, and ride the approach and the roadbook as one line, so instructions, corner warnings, the bearing and the camera work on the approach exactly as on the roadbook. The rider SHALL see "To the start" with the distance to it while on the approach, and the approach SHALL be drawn dashed apart from the roadbook line. The first fix SHALL be used at once: the camera SHALL follow the rider from the moment the approach is ready, never show the roadbook overview of a place the rider is not at.

When the first fix is within 150 m of the roadbook line the app SHALL join the roadbook at the nearest point and not route.

#### Scenario: Riding to the start

- **WHEN** the rider taps Start 12 km from the roadbook's start
- **THEN** the top instruction reads "Straight …" or "Left in …" along the routed approach, the HUD reads "To the start · 12 km", and the roadbook takes over at its first point

#### Scenario: Already on the roadbook

- **WHEN** the rider taps Start 40 m from the line, 30 km into a loop
- **THEN** no approach is routed and progress starts at 30 km

### Requirement: No connection

When the approach cannot be routed within 10 seconds, the app SHALL fall back to a straight line from the rider to the start, say so ("No route to the start, straight line"), show the distance, never flag the rider off route while on that line, and hand over to the roadbook as the rider reaches it. Nothing else on the ride screen SHALL depend on the network.

### Requirement: Readable and operable

Every control SHALL be a button with an accessible name (a screen reader says "Zoom in", not "plus"), and a target of at least 48 by 48 dp. Every text and background pair used on screen SHALL reach a contrast ratio of at least 4.5:1 (3:1 for text of 24 dp or more), so the screen stays readable in sunlight. The instruction, the corner banner and the status banners SHALL be live regions so a screen reader announces their changes. Text drawn straight on the map, such as the attribution, SHALL have its own background.

#### Scenario: Reading a control aloud

- **WHEN** a screen reader focuses the button that zooms in
- **THEN** it reads "Zoom in" as a button

### Requirement: Wrong way

While on the roadbook and moving at 10 km/h or more, when the GPS heading is known and differs from the direction of the line by more than 120 degrees for 3 consecutive fixes, the rider SHALL be told they are going the wrong way: the instruction SHALL read "U-turn, wrong way" and a U-turn arrow SHALL show, until the heading is right again. At the start of a roadbook the same rule tells a rider who faces away from it to turn round. Nothing SHALL be said below 10 km/h, where a GPS heading is not reliable.

#### Scenario: Setting off the wrong way

- **WHEN** the rider is on the line at the start and rides 15 km/h in the direction opposite to the roadbook for 3 seconds
- **THEN** the top instruction reads "U-turn, wrong way"

### Requirement: Back to the route

When the rider is off route, the app SHALL work out the point of the roadbook to rejoin: the nearest point of the line, 150 m further along it, never behind the rider's progress. At once, with no network, the instruction SHALL read the distance to it and the direction to ride relative to the rider's heading ("Rejoin the route, 450 m, ahead left"), with an arrow turned the same way. When the phone is online the app SHALL ask the public Valhalla service once for a route from the rider to that point (ADR 0012), at most once every 30 seconds while off route and only when the rider has moved 50 m since the last request, and on success SHALL ride that route and then the rest of the roadbook as one line, with instructions, corner warnings and the camera working on it as on the approach, shown dashed, and the HUD reading "Back to the route". Without a route it SHALL keep the direction guidance, and SHALL NOT flag the rider off route on it. The part of the roadbook already ridden SHALL be dropped, so the distance remaining is true.

#### Scenario: Missed junction

- **WHEN** the rider takes a wrong turn and is 300 m off the line
- **THEN** the instruction gives the distance and the side to rejoin, and, online, the route replaces it within a few seconds

### Requirement: Scripted GPS in development builds

A development build SHALL accept the deep link `mobilemotoride://replay/<scenario>` and, on the ride screen, start a GPS ride that takes its fixes from a short script instead of the phone's GPS, so the whole GPS path (locating, approach, instructions, off route, wrong way, skip, danger zones) can be driven on a real phone without moving. The scenarios SHALL be: `ride` (on the roadbook, riding), `approach` (parked 3 km from the start), `offroute` (on the line, then parked 250 m off it, at the first place along the roadbook where the side is clear of the line), `wrongway` (on the line, riding against it), `skip` (parked on the line, ready to skip), `startfrom` (parked 3 km from the start, going to the third route point without asking), `join` (parked 300 m beside the road between the second and third route points, where the join card is shown) and `zone` (550 m before the first danger zone). Each scenario SHALL hold its last position, so the screen settles. A scenario that the roadbook cannot play (`zone` without cameras) SHALL do nothing. A release build SHALL NOT listen for the link: the scripted GPS SHALL be unreachable outside development.

#### Scenario: Parked far from the start

- **WHEN** the link `mobilemotoride://replay/approach` is opened on a roadbook's ride screen
- **THEN** the ride starts without a permission dialog, the way to the start is routed, and the HUD reads "To the start"

### Requirement: A key to the map

The ride screen SHALL have a Key button that opens a card explaining every mark on the map, each with a sample drawn as it is on the map: the roadbook line and its arrows (the way to ride), the dashed line (the way to the next point), the route point, the hairpin, the sharp corner, the rider and the basemap button. The wording SHALL be plain and say what to do ("Hairpin: slow right down"). The map controls SHALL step aside while the Key is open.

### Requirement: A quiet map

Corner marks SHALL be drawn only when the map is zoomed in far enough to tell them apart (zoom 11 and over), so that the roadbook and its route points read first on the overview. Route points SHALL be drawn larger than corner marks, with a pale ring.

### Requirement: Pictures, not words, on the map buttons

The buttons over the map and the panel (the whole roadbook, follow me, the map, the key, the voice, the gauges, Find) SHALL be round and carry a picture, not a word, so that they take the same
small room in every language; each keeps its accessible name in the language in use (spec languages), and the map and the voice buttons say in it which map and which voice mode is on. The voice button's picture SHALL
change with the mode (full, alerts, muted). The chips that say something (the weather, the fuel) keep their short text.

#### Scenario: A picture and a name

- **WHEN** the rider is riding with the voice on Alerts
- **THEN** the voice button shows the picture of alerts and is named "Voice: alerts only. Tap to change"

### Requirement: Time left and arrival

Under the distance remaining the panel SHALL show, on one short line, the time left and the time of arrival ("2h07 · 16:42"; "45 min · 5:12 PM" in English), in the language in use. The time comes from the
distance remaining at the pace of the ride so far (a running average of the speed while moving, over about two minutes, kept between 29 and 108 km/h); before the rider has moved, or while standing at the
start, it is 58 km/h. The distance remaining keeps the whole name ("122 km left, about 2h07, arriving at 4:42 PM").

#### Scenario: Before the start

- **WHEN** the ride screen opens on a 122 km roadbook and the rider has not moved
- **THEN** the line under "122 km" reads "2h07" and a time of arrival

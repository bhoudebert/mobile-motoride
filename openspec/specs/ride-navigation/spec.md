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

#### Scenario: Passing a stop

- **WHEN** the rider's progress goes beyond the position of the first stop along the line
- **THEN** that stop is passed and the next stop, with its name and its distance along the line, is reported

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

#### Scenario: Location refused

- **WHEN** the rider opens a ride and refuses location permission
- **THEN** a plain-language notice says so, the map still shows the roadbook line, and the screen stays on

### Requirement: Track only with permission

The map SHALL follow the rider (location puck, camera tracking) only once foreground location permission is granted, never while the permission dialog is open or after a refusal, because the native location layer fails without it. A JavaScript error on the ride screen SHALL show its message and a way back to the list instead of closing the app.

#### Scenario: First Start

- **WHEN** the rider taps Start and the permission dialog appears
- **THEN** the map does not track the position until the rider allows location

### Requirement: Location while riding

The app SHALL request foreground location with high accuracy at 1 s intervals during a ride. Background location SHALL be added with the foreground service in a later change; until then the ride screen SHALL say it must stay open.

#### Scenario: A GPS ride

- **WHEN** the rider starts a ride on the GPS
- **THEN** the app requests foreground location with high accuracy at 1 s intervals, and the ride screen says it must stay open until background location exists

### Requirement: Look

The app SHALL use the roadbook look of agentMotoride: paper background, ink text, moss panels, rust for hairpins and signal yellow for sharp corners, with Space Grotesk and JetBrains Mono. The route SHALL be drawn in moss with a paper casing, hairpins in rust, sharp corners in signal yellow and stops in moss. Text on a rust or ink banner SHALL be paper, on a signal banner ink, so every banner stays readable in sunlight.

#### Scenario: A banner in sunlight

- **WHEN** a hairpin banner in rust and a sharp-corner banner in signal yellow are shown
- **THEN** the text on the rust banner is paper, on the signal banner ink, and the route is drawn in moss with a paper casing

### Requirement: Map without tiles

The roadbook SHALL be followable with no tile provider and no network: the map draws the roadbook line, the stops and the corner markers on a plain paper-coloured background whenever the basemap is Off or cannot load.

#### Scenario: No basemap

- **WHEN** the basemap is Off or cannot load
- **THEN** the roadbook line, the stops and the corner markers are drawn on a plain paper-coloured background and the roadbook can still be followed

### Requirement: Optional basemap

The ride screen SHALL offer a Map button that cycles the basemap through Light, Colour and Off, starting on Light. Light and Colour SHALL show roads, place names and landmarks from OpenFreeMap (OpenStreetMap data, no key) under the roadbook; the roadbook line, arrows, corner markers, stops and rider SHALL stay on top and readable. While a basemap is shown the screen SHALL display its attribution ("© OpenStreetMap contributors, OpenFreeMap") just above the row of chips (Find, weather, fuel), clear of the gauges, so that it can be read. When the basemap style fails to load, or cannot be reached, the screen SHALL fall back to Off and say so, and nothing else on the ride screen SHALL depend on it. Reachability SHALL be checked with one small request (HEAD, 6 second limit) each time a basemap is chosen, because a style kept in the cache loads offline without any failure to report. A style URL given in `EXPO_PUBLIC_MAP_STYLE_URL` SHALL replace the Light style.

#### Scenario: No network

- **WHEN** the phone has no connection and the rider opens a roadbook
- **THEN** the map falls back to the plain background, the roadbook line is drawn, and instructions and warnings work as usual

### Requirement: Direction on the line

The whole roadbook line SHALL carry small arrows pointing the way of the roadbook, and the rider SHALL be shown as a marker pointing along the line. While the rider is on the roadbook the app SHALL also make the way clear where the road is ridden out and back, doubles back or crosses itself (ADR 0046): the part already ridden SHALL be drawn pale and the part ahead in the colour of the line, with a hard step at the rider; and the 3 km just ahead of the rider SHALL be drawn again on top of everything on the line, in a brighter colour with a white outline and bold white chevrons about every 56 px that point the way of the ride and grow with the zoom, so that where two passes lie on the same road only the one to ride now shows its chevrons and its colour. The stretch SHALL start at the rider (rounded down to 50 m, so the map is not updated on every fix), stop 3 km on or at the end of the roadbook, and SHALL NOT show before Start, on the approach or at the end. The part ridden and the stretch SHALL follow the rider's progress along the roadbook, not along the approach. The Key SHALL say that the bright stretch with white chevrons is the way to ride and that the ridden part turns pale.

#### Scenario: A road ridden out and back

- **WHEN** the rider rides a stretch of road that the roadbook rides again, the other way, later
- **THEN** the next 3 km are bright with white chevrons pointing the way of this pass, and the other pass, which lies under them, is not drawn over them

#### Scenario: A road that loops back

- **WHEN** the rider has ridden the first half of a roadbook that crosses itself
- **THEN** the first half is drawn pale and the second half in the colour of the line, and the bright stretch is on the second half

#### Scenario: Before Start

- **WHEN** the ride screen is open and the rider has not started
- **THEN** the line is in one colour with its small arrows and there is no bright stretch

### Requirement: Start and finish

The ride screen SHALL mark the two ends of the roadbook on the map, so that the rider sees at once, on the whole roadbook opened from the list, where it begins and where it ends: a **start** mark (a green disc with a white arrow) at its first point and a **finish** mark (a dark disc with a checkered flag) at its last. When the roadbook is a loop (its two ends within 500 m) there SHALL be one mark for both, unlike the other two (the checkered flag inside a green ring), at its first point. The marks SHALL be drawn above the route points and the line, below the rider, white-edged so that they read on the light and the dark look, and SHALL stay on the map during the ride. The Key SHALL show the three of them with a plain word each ("Start", "Finish", "Start and finish").

#### Scenario: A road from one place to another

- **WHEN** a roadbook that is not a loop is opened
- **THEN** the map shows the start mark at its first point and the finish mark at its last

#### Scenario: A loop

- **WHEN** a roadbook whose two ends are 200 m apart is opened
- **THEN** the map shows one mark, the start and finish one, at its first point, and no separate start or finish

### Requirement: Camera and controls

The column of map buttons SHALL stand on the right above the panel and SHALL never reach the instruction bar or the skip square: when the room between the bar and the panel is shorter than the column (a short phone, a taller panel), the buttons SHALL lie in two columns instead.

While riding the camera SHALL follow the rider, turned along the line. Touching the map SHALL stop the following. The ride screen SHALL offer zoom in, zoom out, a recenter button that resumes following, and an overview button that fits the whole roadbook, north up.

#### Scenario: Touching the map

- **WHEN** the rider is riding with the camera following and touches the map
- **THEN** the following stops, and the recenter button resumes it, while the overview button fits the whole roadbook, north up

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

#### Scenario: The approach cannot be routed

- **WHEN** the approach cannot be routed within 10 seconds
- **THEN** the app says "No route to the start, straight line", shows the distance, never flags the rider off route on that line, and hands over to the roadbook at the start

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

When the rider is off route, the app SHALL work out the point of the roadbook to rejoin: the nearest point of the line, 150 m further along it, never behind the rider's progress. At once, with no network, the instruction SHALL read the distance to it and the direction to ride relative to the rider's heading ("Rejoin the route, 450 m, ahead left"), with an arrow turned the same way. When the phone is online the app SHALL ask the public Valhalla service once for a route from the rider to that point (ADR 0012), at most once every 30 seconds while off route and only when the rider has moved 50 m since the last request (at once again when the rider is 150 m from where the last was made, and after 5, 10 and then every 15 seconds while no route was found, whatever the rider's movement), and on success SHALL ride that route and then the rest of the roadbook as one line, with instructions, corner warnings and the camera working on it as on the approach, shown dashed, and the HUD reading "Back to the route". Without a route it SHALL keep the direction guidance (an arrow always towards the point to reach, never none), SHALL NOT flag the rider off route on it, and SHALL ask for the route again as above. The part of the roadbook already ridden SHALL be dropped, so the distance remaining is true.

#### Scenario: Missed junction

- **WHEN** the rider takes a wrong turn and is 300 m off the line
- **THEN** the instruction gives the distance and the side to rejoin, and, online, the route replaces it within a few seconds

#### Scenario: Back on the road before the rejoin point

- **WHEN** the rider, given a way back to a point 150 m further along, meets the road of the roadbook again before that point
- **THEN** the whole roadbook is ridden again from there: the line is green with its white chevrons, the instruction and the speed limit are those of the roadbook, and nothing shows the rider as off route or on a dashed way back

#### Scenario: Dashes only before the ride has begun

- **WHEN** the rider is on the roadbook line
- **THEN** it is never drawn as the dashed way to the start; the dashes belong to the approach to the start of a ride that has not begun, and to a way back that has not been reached

### Requirement: Scripted GPS in development builds

A development build SHALL accept the deep link `mobilemotoride://replay/<scenario>` and, on the ride screen, start a GPS ride that takes its fixes from a short script instead of the phone's GPS, so the whole GPS path (locating, approach, instructions, off route, wrong way, skip, danger zones) can be driven on a real phone without moving. The scenarios SHALL be: `ride` (on the roadbook, riding), `approach` (parked 3 km from the start), `offroute` (on the line, then parked 250 m off it, at the first place along the roadbook where the side is clear of the line), `wrongway` (on the line, riding against it), `skip` (parked on the line, ready to skip), `startfrom` (parked 3 km from the start, going to the third route point without asking), `join` (parked 300 m beside the road between the second and third route points, where the join card is shown) and `zone` (550 m before the first danger zone). Each scenario SHALL hold its last position, so the screen settles. A scenario that the roadbook cannot play (`zone` without cameras) SHALL do nothing. A release build SHALL NOT listen for the link: the scripted GPS SHALL be unreachable outside development.

#### Scenario: Parked far from the start

- **WHEN** the link `mobilemotoride://replay/approach` is opened on a roadbook's ride screen
- **THEN** the ride starts without a permission dialog, the way to the start is routed, and the HUD reads "To the start"

### Requirement: A key to the map

The ride screen SHALL have a Key button that opens a card explaining every mark on the map, each with a sample drawn as it is on the map: the roadbook line and its arrows (the way to ride), the dashed line (the way to the next point), the route point, the hairpin, the sharp corner, the rider and the basemap button. The wording SHALL be plain and say what to do ("Hairpin: slow right down"). The map controls SHALL step aside while the Key is open.

#### Scenario: Opening the Key

- **WHEN** the rider presses the Key button
- **THEN** a card explains the line and its arrows, the dashed line, the route point, the hairpin, the sharp corner, the rider and the basemap button, each with a sample drawn as on the map, and the map controls step aside

### Requirement: A quiet map

Corner marks SHALL be drawn only when the map is zoomed in far enough to tell them apart (zoom 11 and over), so that the roadbook and its route points read first on the overview. Route points SHALL be drawn larger than corner marks, with a pale ring.

#### Scenario: The overview

- **WHEN** the whole roadbook is shown at zoom 9
- **THEN** corner marks are not drawn, the route points are, larger and with a pale ring, and from zoom 11 the corner marks appear

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

### Requirement: The compass

While riding, the ride screen SHALL show a round compass chip in the row of chips, beside the traffic chip (and alone when traffic is not offered): a needle pointing to the north of the screen, which turns along the rider's heading, and the short name of the point the rider faces (N, NE, E, SE, S, SW, W, NW; in French N, NE, E, SE, S, SO, O, NO), each point covering 45 degrees centred on it. Its name for a screen reader SHALL be the whole sentence ("Heading: north-east"). It SHALL NOT show before Start, and it SHALL do nothing when pressed. There SHALL be only one compass, and the map's own compass SHALL be off: upright the chip stands in the row of chips by the traffic chip; held sideways (ADR 0045) the same chip stands at the top right of the map, with the notices between it and the skip square at the top left.

#### Scenario: Riding east

- **WHEN** the rider rides facing east
- **THEN** the chip reads "E", its needle points left and it is named "Heading: east"

#### Scenario: Sideways

- **WHEN** the phone is held sideways while riding
- **THEN** the compass chip is at the top right of the map and not in the row of chips

#### Scenario: Before Start

- **WHEN** the ride screen is open and the rider has not pressed Start
- **THEN** there is no compass chip

### Requirement: Landscape on the ride screen

The phone SHALL be free to turn on the ride screen, and only there: every other screen SHALL stay upright, and the app SHALL lock the phone upright again as soon as the ride screen closes (ADR 0045). A sideways screen is short, so the map SHALL be kept clear. Held sideways, the ride screen SHALL put everything the rider reads in a column at the left, a third of the width and between 260 and 340 dp, the full height: at its head the instruction and the warning of the next corner as **one card** (the instruction with its glyph, "Right in 150 m, then left"; when a corner warning is on, the card turns yellow, or rust for a hairpin, and reads the corner first, "SHARP RIGHT", "110 m · ride at 30 km/h", then the instruction), under it the speed, the limit and the distance left, and at its foot Back, Pause and End, always in reach and never folded away; the column SHALL NOT scroll, everything in it fitting the screen. The corner warning SHALL NOT also be drawn on the map. The other notices (a camera or zone ahead, paused, locating, a route being found, the map or the location off) SHALL stay on the map as one short line at its top; the status bar SHALL be hidden and the top SHALL keep no margin, the camera being at a side; the skip square SHALL stand at the top left of the map, above the left gauges, smaller, and the notices SHALL lie between it and the compass; the gauges SHALL be shared between the left and the right side of the map, never one tall stack; the chips and the map buttons SHALL stand at the bottom of the map, the buttons in two rows of four, nothing covering another. On an iPhone the sides SHALL leave room for the cut-out. Cards (sheets) SHALL keep covering the screen and scroll. A phone that cannot turn, or an older build without the module, SHALL stay upright and work as before.

#### Scenario: Turning the phone on the ride

- **WHEN** the ride screen is open and the phone is turned sideways
- **THEN** the panel is a column on the left, the map fills the rest with only its buttons, chips, gauges, compass and the skip square on it, and Start (or Back and End) can be pressed

#### Scenario: A corner ahead, sideways

- **WHEN** the phone is sideways and a sharp right is 110 m ahead
- **THEN** the card at the head of the column is yellow and reads "SHARP RIGHT" and the distance and speed, with the instruction under it, and no yellow notice is drawn on the map

#### Scenario: Leaving the ride

- **WHEN** the rider goes back to the list with the phone sideways
- **THEN** the list is upright

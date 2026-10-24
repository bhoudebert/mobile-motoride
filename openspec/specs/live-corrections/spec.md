# Live Corrections Specification

## Purpose

Let the rider change the roadbook during the ride: skip the next point when the road is blocked or a better one is
found, as often as needed, with a new route from where they are.

## Requirements

### Requirement: Route points and service stops

A roadbook file SHALL tell the route points of the loop (`kind: "waypoint"`, the default) from planned service stops such as fuel and cafés (`kind: "stop"`). Only route points can be skipped. A service stop lies on the route and SHALL be left alone by skipping.

### Requirement: Skip the next point

While riding with GPS, the rider SHALL be able to skip the next route point: the one the roadbook is heading for. Skipping SHALL send the rider to the route point after it, the target, by a new route from where they are, abandoning the stretch of the roadbook in between together with its stops, limits, zones and corners. The roadbook after the target SHALL be unchanged. Starting a roadbook from a chosen point (spec ride-control) is the same operation done before the ride. Skipping SHALL be possible as often as the rider wants, each time from the position and the ride they have then. When there is no route point after the next one, nothing SHALL be offered: the last point cannot be skipped.

#### Scenario: A blocked road

- **WHEN** the rider heading for point 2 finds the road blocked and skips it
- **THEN** the app routes from the rider to point 3, the HUD reads "To 3. Cassel", and point 2 and the stretch up to point 3 are gone

#### Scenario: Skipping twice

- **WHEN** the rider skips point 2 and, on the new route, skips point 3
- **THEN** a new route is made from where they are to point 4

### Requirement: Two taps, and only when stopped

Skipping SHALL ask for a confirmation naming the point skipped and the target, and SHALL be refused while the GPS speed is 10 km/h or more ("Stop to skip"); with an unknown speed it SHALL be allowed. A confirmation SHALL cancel itself after 10 seconds. The app asks nothing of a rider who is riding.

### Requirement: The new route

The route SHALL be requested from the public Valhalla service, once per skip, as for the approach (ADR 0008, ADR 0012), and ridden with the rest of the roadbook as one line, dashed, with instructions, corner warnings, danger zones and the speed limit working on it. Without a route within 10 seconds the app SHALL fall back to a straight line to the target and say so, as for the approach. The new ride SHALL be announced aloud ("Skipping 2. Mont des Cats, heading for 3. Cassel") and shown as "To 3. Cassel" until the target is reached.

### Requirement: Undo

For 15 seconds after a skip the rider SHALL be able to undo it, restoring the ride as it was and the point skipped. Undo SHALL need no network.

#### Scenario: A mistaken skip

- **WHEN** the rider skips a point by mistake and taps Undo within 15 seconds
- **THEN** the previous ride returns and the skipped point is the next one again

### Requirement: Not in the demo

The demo ride SHALL NOT offer skipping.

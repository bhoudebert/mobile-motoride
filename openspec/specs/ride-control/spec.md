# Ride Control Specification

## Purpose

Let the rider pause a ride, take it up again, end it without ending it by accident, and start a roadbook from any
of its points.

## Requirements

### Requirement: Pause and resume

While a ride is on, a Pause button SHALL hold it: the GPS SHALL be let go, no instruction, warning, voice or vibration
SHALL be produced, and the screen SHALL keep what it showed, marked "Ride paused". Resume SHALL carry on with the same
ride, with the progress, the skipped points and the warnings already given as they were. A rider who has moved while
paused SHALL be treated as on any fix: on the line they go on, off it they are guided back (spec ride-navigation).

#### Scenario: A coffee stop

- **WHEN** the rider pauses at a café, rides on the pillion's phone call for twenty minutes, and resumes
- **THEN** the ride is the same one, with the same remaining distance and next point, and the first fix decides whether the rider is on the route or is guided back to it

### Requirement: The map keeps the room while riding

While a ride or a demo is on, the buttons Back, Pause or Resume, and End, and the line that says the ride is shared (spec live-share), SHALL be folded away so the map has the room; the speed, the limit, the distance, the next point and the skip button stay. A grabber, a small horizontal line at the top of the bottom panel (its touch target at least 48 dp high, named "Show the ride buttons"), SHALL show that the panel can be pulled up: a swipe up on the panel, or a tap on the grabber, SHALL bring the buttons back, and a swipe down on the panel or a tap on the grabber SHALL fold them again. A vertical drag of at least 36 dp, steeper than 1.5 to 1, counts as a swipe; a tap or a sideways drag does nothing. The buttons SHALL slide out of the bottom of the panel and back in about a fifth of a second, not appear or vanish at once. A screen reader SHALL be offered expand and collapse on the grabber. The buttons SHALL fold again by themselves 8 seconds after they were brought (a tap on Pause or Resume starts the 8 seconds again), when a card opens, and when the ride ends. Before a ride (Back, Demo, Start) every button SHALL be on screen and there SHALL be no grabber. The phone's own Back button SHALL keep acting as Back whether the buttons are folded or not.

#### Scenario: A rider glancing at the map

- **WHEN** a ride is on and the rider does not touch the screen
- **THEN** only the grabber line shows at the top of the panel, and a swipe up on the panel shows Back, Pause and End for eight seconds

### Requirement: End the ride, with a question

Ending a ride that uses the GPS SHALL ask first once the ride has begun, that is once the rider is being followed: "End the ride?", saying that the progress on the roadbook is lost, with "Keep riding" and "End ride". Going Back to the list during such a ride SHALL ask the same question ("Leave this ride?"). Before the ride has begun, while the app is locating the rider, asking where to join or finding the way, nothing is lost: End, Back and the phone's Back button SHALL act at once. Ending SHALL release the GPS, the voice and the screen lock, and return to the roadbook as before the ride. Ending a demo SHALL need no question, since nothing is lost.

### Requirement: Join the roadbook where the rider is

When the rider taps Start and the first fix is within 150 m of the roadbook line, the ride SHALL begin at once at the nearest point of the line, as before. When it is farther, the app SHALL ask where to join before it routes anything, with a card that states the choices and has one obvious default:

- **Go to the nearest next point**: the first route point ahead of the rider's nearest point on the roadbook (the last point when the rider is past them all). The card SHALL name it, say how far it is in a straight line, and say which points it skips ("Skips Start, Point 1").
- **Go to the start**: the first route point, with its straight-line distance. When the nearest next point is the start, only this choice and the other points SHALL be offered.
- **Choose another point**: the list of the route points with their distance from the start of the roadbook, five whole rows at a time. Planned service stops SHALL NOT be listed.
- **Cancel**: no ride.

Going to a point SHALL send the rider from where they are to that point by a new route (ADR 0008, ADR 0012), as for a skip, and SHALL drop every route point before it, with the stretch and everything on it; the roadbook after the point SHALL be unchanged. A rider within 150 m of the chosen point SHALL not be routed: the ride starts there at once. Without a route within 10 seconds the app SHALL fall back to a straight line to the point, and say so. The card SHALL not be offered to a rider on the line, in the demo, or in a scripted ride other than `join`.

#### Scenario: Setting off in the middle of the loop

- **WHEN** the rider is 400 m from the road between Point 2 and Point 3 and taps Start
- **THEN** the card offers "Go to Point 3, 4.2 km away, skips Start, Point 1, Point 2", and one tap routes there and drops those points

#### Scenario: Setting off at home

- **WHEN** the rider is 3 km from the start, which is also the nearest point of the roadbook, and taps Start
- **THEN** the card offers "Go to the start" and "Choose another point"

### Requirement: Naming the point the rider goes to

Whenever the rider is sent to a named point (a skip, a join), the approach SHALL be called by its name: the
HUD "To <name>", the straight-line instruction "Straight to <name>", the fallback notice "No road route to <name>".

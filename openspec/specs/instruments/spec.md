# Instruments Specification

## Purpose

Show the rider a few live readings on the ride screen, from the GPS and from the phone's own motion sensors, each one
switched on or off by the rider (ADR 0031). They are informative: nothing in the navigation, the warnings or the voice
depends on them.

## Requirements

### Requirement: Readings on the ride screen

During a ride on the real GPS, and in the demo and replays, the system SHALL show a small column of readings at the left of the map, below the
instruction bar and clear of the warning banners (the room of a corner banner, about 100 dp, is kept free under the bar), never over the next turn or the controls. The readings are:

- **Compass**: the heading in degrees and its point (N, NE, E, SE, S, SW, W, NW), from the GPS course while the rider moves faster
  than 10 km/h (spec ride-navigation), and the last known one when slower; "–" before there is one.
- **Altitude** in metres, and the **climb** (the height gained since the start, counting a rise only once it exceeds 3 m, so
  GPS noise does not add up); "–" when the GPS gives no altitude.
- **Slope** in percent, the height change over the last 150 m ridden, signed (+ climbing, − descending), shown only while
  moving faster than 10 km/h and once 100 m have been ridden since the start or since a stop; "–" otherwise.
- **Lean angle** in degrees, left or right, with the peak left and right of this ride, and the **lateral G**.
- **Braking and acceleration G**: the longitudinal force, positive when braking.

The readings SHALL be smoothed so they can be read at a glance, SHALL NOT animate, SHALL use the ride screen's colours and
SHALL be named for a screen reader ("Lean 23 degrees left").

#### Scenario: Riding north-east uphill

- **WHEN** the rider heads 47° at 60 km/h and climbs 4 m over 100 m
- **THEN** the compass shows "NE 47°" and the slope shows "+4 %"

### Requirement: Switches

The system SHALL offer a **Gauges** control on the ride screen's buttons that opens a card with a switch for the whole
column and one for each reading (compass, altitude and climb, slope, lean, braking), kept between launches. By default the column is on with the
compass, altitude and slope, and lean and braking off. Turning a reading off SHALL remove it at once; turning the column off SHALL leave no reading on screen, and
SHALL stop the motion sensors. The card SHALL keep the ride running behind it, and the map controls SHALL step aside while it is open like for the
other cards.

#### Scenario: Lean off

- **WHEN** the lean switch is off
- **THEN** no lean reading is on screen and the motion sensors are not listened to for it

### Requirement: Lean and G from the phone's sensors

The system SHALL compute lean, lateral G and braking G from the phone's accelerometer and gyroscope and the GPS speed, with no
sensor placed on the bike. With the phone fixed to the bike (handlebar, tank or dashboard, screen facing the rider), the lean is
the angle whose sine is the speed times the turning rate about the bike's upright axis, divided by 9.81 m/s²; the lateral G is
its tangent. The braking G is the acceleration along the bike's forward axis, positive when braking, with the road's slope taken off (the slope reading of the last 150 m, capped at 35 %, none while it is unknown), so that a steady climb or descent is not read as a force. Left leans are positive.
Below 5 m/s the lean and the lateral G SHALL be shown as 0 (a slow turn is the steering, not the lean) and a lean beyond 70° SHALL be capped.

The reading is indicative: it depends on the mount and on the sensors of the phone, and SHALL be labelled as such where the
rider turns it on.

#### Scenario: A steady corner

- **WHEN** the bike turns at 20 m/s with a turning rate about its upright axis of 0.31 rad/s
- **THEN** the lean is 39° and the lateral G 0.82

#### Scenario: A steady climb

- **WHEN** the bike climbs a 10 % slope at a steady speed
- **THEN** the braking G is 0, not 0.10 of acceleration

### Requirement: Calibration

Lean and braking need the bike's axes in the phone's frame, so the card SHALL offer **Calibrate**: with the bike upright and
the phone in its mount, the rider taps it, and the system lets the tap's shake settle for 0.6 s, then keeps the phone still for 1.5 s, reads the direction of gravity, and
derives the upright, forward and right axes of the bike from it (the forward axis is the side of the phone opposite its screen
projected onto the level, or the top of the phone when the screen faces up). It SHALL refuse a calibration made while the phone is moving ("Hold the phone still") and SHALL show
whether the phone is calibrated and when it was. The calibration SHALL be kept between launches. Until the phone is calibrated, a
lean or braking reading that is switched on SHALL show "Calibrate" instead of a value, and pressing it SHALL open the card.
The card SHALL also offer **Reset peaks**; peaks start again for each ride.

#### Scenario: Moved while calibrating

- **WHEN** the phone is shaken while Calibrate runs
- **THEN** nothing is saved and "Hold the phone still" is shown

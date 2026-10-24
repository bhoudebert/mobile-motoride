# Background Navigation Specification

## Purpose

Keep guiding the rider when the screen is off or another app is in front (ADR 0020): a phone in a pocket or a tank bag locks itself, and a navigator that stops then is useless on a ride.

## Requirements

### Requirement: Keep riding with the screen off

While a ride with the real GPS is running, the system SHALL keep the app alive and locating when the screen turns off or another app is shown, so that spoken turns, corner warnings and danger zones carry on. It SHALL do so with an Android foreground service, which shows a notification for as long as the ride runs. The notification SHALL say what is happening ("Riding <roadbook name>") and tapping it SHALL return to the ride. A demo and a scripted GPS SHALL NOT start the service.

#### Scenario: The phone locks during a ride

- **WHEN** a GPS ride is running and the screen turns off
- **THEN** the ride keeps receiving positions and speaking, and the notification stays

### Requirement: Stop when the ride stops

The service and its notification SHALL stop as soon as the ride ends, is paused, or the rider goes back to the list or leaves the ride screen, and SHALL never outlive the ride: the GPS is released exactly as before (ADR 0015). Resuming after a pause SHALL start it again.

#### Scenario: End the ride

- **WHEN** the rider ends the ride
- **THEN** the notification disappears and the GPS is released

### Requirement: Ask only for what is needed

The service SHALL need no more than the permission to use the location while the app is in use, which the ride already asks for. If the service cannot start, the ride SHALL carry on in the foreground as before, and the rider SHALL not be blocked.

#### Scenario: The service cannot start

- **WHEN** the phone refuses the foreground service
- **THEN** the ride works with the screen on, as before

### Requirement: The notification can be seen

On Android 13 and later the system SHALL be asked once for the permission to show notifications when a GPS ride starts, since without it the notification of the service is hidden. A refusal SHALL NOT stop the ride or the service.

#### Scenario: Notifications refused

- **WHEN** the rider refuses notifications
- **THEN** the ride and its foreground service still run

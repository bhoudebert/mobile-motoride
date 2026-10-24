# 0015. Pause lets go of the GPS and keeps the ride

- Status: accepted
- Date: 2026-10-18

## Context

A rider stops for a coffee, fuel, a phone call. "Stop" used to end the ride, losing the progress, the skipped points and
the route chosen on the way. The rider also needs a way to end a ride that cannot be done by one stray tap on a bike.

## Decision

**Pause** unsubscribes from the GPS (and stops the voice and the vibration) and keeps everything else: the ride, its
navigator with its progress and the warnings already given, the history for Undo. **Resume** subscribes again and the
first fix decides, as on any fix, whether the rider is on the line or has to be guided back. **End** asks first (GPS
rides only) and then clears everything. Starting from a chosen point reuses the join of a skip (ADR 0013), done
before the ride.

## Consequences

A pause costs no battery for the GPS and loses nothing. A long pause needs no special case: the rider who moved is off
route or on it, and the existing rules apply. The question before End is one more tap in an emergency stop, by design.

## Alternatives considered

Keeping the GPS on while paused and ignoring it: simpler, but drains the battery and risks warnings on resume from stale
state. Ending on Stop and saving the ride to resume later: persistence we do not have (ADR 0004). No question: one wrong
tap would end a four-hour ride.

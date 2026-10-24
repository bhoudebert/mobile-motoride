# Voice Guidance Specification

## Purpose

Tell the rider what to do, out loud, so the eyes can stay on the road, and let the rider choose how much is said (ADR 0019).

## Requirements

### Requirement: Three voice modes

The system SHALL offer three modes of voice, chosen by the rider on the ride screen and kept between launches, **Full** by default:

- **Full**: every spoken message: turns, roundabout exits and lanes, corner warnings, danger zones, wrong way, leaving and rejoining the route, skipping a point, arrival, and the fuel stops (spec fuel-stops).
- **Alerts**: only what warns: corner warnings, danger zones, and a long stretch without fuel (spec fuel-stops). No turn instruction, junction guidance or status message.
- **Off**: nothing is spoken.

The vibration for riding over the speed limit SHALL NOT depend on the mode. The control SHALL show the mode and change it with one tap, in the order Full, Alerts, Off; it SHALL be named with the mode ("Voice: Full. Tap to change"). Changing the mode SHALL speak its name ("Voice: full guidance", "Voice: alerts only") unless the new mode is Off, and SHALL silence what is being said when the new mode is Off. A message that the mode keeps quiet SHALL be dropped, not kept to be said when the mode changes.

#### Scenario: Alerts only

- **WHEN** the mode is Alerts and a turn, a roundabout and a hairpin come one after the other
- **THEN** only the hairpin is spoken

### Requirement: The music is lowered while the voice speaks

While a message is spoken the system SHALL ask Android to lower other audio (music, a podcast, a call's audio is not touched) by taking
the audio focus for a short while ("transient, may duck"), and SHALL give the focus back when the last message of a series is done, stopped
or has failed, so that the music returns to full volume. Several messages in a row keep the focus until the last one ends, and a message
cut off by the next does not give it back under the new one. A voice that never says it is done SHALL NOT leave the music low: after 30 seconds
the focus is given back. The music is never stopped or paused by the voice. On a phone or a build without the means to ask, the voice speaks as before.

#### Scenario: Music under a turn

- **WHEN** music is playing and a turn is spoken
- **THEN** the music is lowered while the turn is said and back to full volume afterwards

### Requirement: Say the turns

In Full, the system SHALL announce each turn twice: once at about 500 m, "In 500 metres, turn left" (the distance rounded to 50 m, "make a U-turn" for a U-turn), and once close to it, "Turn left" (or "Turn left, then turn right" when another turn follows within 300 m), with "close" meaning about six seconds ahead, between 60 and 200 m. A rider who is already within the close distance when the turn comes up SHALL hear only the close message. Each message SHALL be said once per pass of the turn, and again on the next pass of a loop. A turn inside a roundabout that has its own guidance SHALL NOT be announced.

#### Scenario: A left turn on a country road

- **WHEN** the rider rides towards a left turn at 60 km/h
- **THEN** "In 500 metres, turn left" is said once at about 500 m, and "Turn left" once at about 100 m

### Requirement: Say what went wrong

In Full, the system SHALL say, once each time it happens: "Wrong way, make a U-turn" when the rider has been going against the line for a few fixes (spec ride-navigation), "You have left the route" when the rider goes off route, "Back on the route" when the rider is on the line again after being off it, and "You have arrived" when the rider reaches the end of the roadbook. Skipping a point SHALL keep its spoken confirmation ("Skipping Cassel, heading for Bailleul") in Full only.

### Requirement: One voice at a time

At most one message SHALL be spoken for each position update. When several are due, the order SHALL be: corner warning, danger zone, wrong way and route status, junction, turn; the others SHALL be said on a following update, when still relevant, never lost for having been due together. A new message SHALL cut what is being said.

# 0019. Three voice modes, kept on the phone

- Status: accepted
- Date: 2026-10-18

## Context

The app spoke only warnings (corners, danger zones, junctions): a rider who looks at the road needs the turns said too.
But a rider who rides a familiar road, or with a helmet speaker for a call, wants less, and a rider who is alone on a
twisty road may want only the warnings of danger. The choice must survive closing the app: asking again at every
ride is a chore.

## Decision

Three modes: Full (everything), Alerts (corner warnings and danger zones only), Off. A control on the ride screen
cycles them; the choice is kept with AsyncStorage, the standard key-value store of React Native, which needs a native
module and so a rebuilt dev client (a one-off). The navigator raises every message as an event whatever the mode; the
hook that speaks them drops what the mode keeps quiet, so a mode never changes what the navigator knows (a turn
announced while muted is not announced again when the voice comes back). Spoken turns: once at about 500 m and once
close to the turn, with at most one message per position update and a fixed order of priority.

## Consequences

The voice is a rider's decision, not a build flag. One more native dependency. Spoken status messages (wrong way,
off route) need the voice to be useful on a bad day, and are off in Alerts: a rider who wants only danger accepts that.
The language is English (`en-GB`) for now, as the instructions on screen are.

## Alternatives considered

A boolean mute: too coarse, the warnings of danger are the point of the app. Per-category switches: more control than
a rider on a motorbike will set up, three modes cover the real choices. Keeping the choice in memory only: no
native module, but asked again at every launch.

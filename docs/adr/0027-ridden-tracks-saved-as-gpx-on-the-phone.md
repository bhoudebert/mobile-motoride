# 0027. Ridden tracks are saved as GPX on the phone

- Status: accepted
- Date: 2026-10-19

## Context

A rider wants the ride they made, finished or not, kept and shareable, for instance to hand to agentRide's `rides
review`, which places the notes on a recorded track. The owner wants no backend (ADR 0004) and a GPX is what every other
program reads.

## Decision

Record the fixes of a GPS ride in the app (leaving out poor and stationary ones), write a checkpoint about once a
minute, and save a GPX 1.1 in the app's document folder when the ride ends or, if the app was closed, at the next
launch. A small sidecar JSON per ride holds what the list needs (roadbook, times, distance, state) so the list never
reads a multi-megabyte track. Sharing is the phone's share sheet (expo-sharing), which covers saving, cloud and other apps.
The GPX metadata carries a `motoride:ride` element with the roadbook's name and identifier here and, for a roadbook
that agentRide exported, `source="agentRide"`, its own number for it and its name. The app's identifiers are slugs with a
hash of the line, agentRide's are plain numbers local to one library, so a match needs the name to agree as well and
neither is a global key.

## Consequences

Every GPS ride leaves a file on the phone without the rider doing anything, which uses storage (about 2 MB for 5 hours)
and holds precise location history: it stays on the phone, is deleted by the rider, and leaves only by their own share. A
demo is not recorded. Recording lasts as long as the foreground service keeps the app alive (ADR 0020).

## Alternatives considered

Asking the rider to start a recording: they will forget. Uploading rides to a server: no backend, and location privacy.
A global id for roadbooks: needs a registry or a UUID in agentRide's database, which is a bigger change than the name
check for the same safety against a collision.

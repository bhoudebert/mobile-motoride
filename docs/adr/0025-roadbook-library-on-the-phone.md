# 0025. A roadbook library on the phone, filled by the rider

- Status: accepted
- Date: 2026-10-19

## Context

The app rode only the roadbooks bundled in it, so a new roadbook meant a new build. Riders who have never heard of
agentRide have GPX files from the route apps they already use, and the owner wants no backend (ADR 0004).

## Decision

The phone keeps a library: one JSON file per roadbook in the app's document folder (expo-file-system), holding the
roadbook exactly as the app reads it, so a roadbook from a GPX and one from an agentRide file are the same thing once
imported. Import has four entry points that end in one function: a file picker, the Android share and "open with"
intents for GPX and JSON files, a link `mobilemotoride://import?url=...` that downloads the file (what agentRide or a
script can send to a phone), and nothing else. The format is recognised from the content. A roadbook's identity is a
short hash of its name and line, so the same route imported again replaces itself. Files are read tolerantly and a file
that cannot be read is skipped. A GPX gives geometry only; adding limits, countries, junctions and cameras to it from
public services is a later step (spec roadbook-library, ROADMAP).

## Consequences

No server, no account, and a rider can bring any route. The link import needs the file to be reachable from the phone
(the laptop on the same network, or a link the rider has). An imported GPX has no speed limits or camera warnings until
the completion step exists. Library files live on the phone only: no sync, no backup other than the phone's.

## Alternatives considered

Keeping the library in AsyncStorage: its total size is limited to a few megabytes on Android, and a roadbook is 100 to
250 KB. A database: more than a list of files needs. A backend library (ADR 0004's first candidate): the owner does not
want one, and the file is the contract with agentRide.

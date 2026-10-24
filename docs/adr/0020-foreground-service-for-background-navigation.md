# 0020. A foreground service keeps the ride alive with the screen off

- Status: accepted
- Date: 2026-10-19

## Context

A ride lasts hours with the phone in a pocket or a mount; the screen locks, another app comes to the front. Android
then stops or throttles a normal app, and the voice, the corner warnings and the danger zones go silent, which is
exactly when the rider cannot look at the screen.

## Decision

While a real GPS ride runs, start `expo-location`'s location updates as a foreground service
(`startLocationUpdatesAsync` with `foregroundService`), with a task that does nothing: its only job is to make Android
treat the app as doing user-visible work and keep it running. The positions still reach the app through the same
`watchPositionAsync` subscription as before, so the navigator, the voice and the warnings are unchanged. The service
starts and stops with that subscription (so with pause, end and leaving the screen). The permission stays "while in
use": the service is started from the foreground, so no background-location permission is needed.

## Consequences

One more native module (`expo-task-manager`) and two Android permissions (foreground service, foreground service
location), so a rebuilt dev client. A persistent notification during rides, which Android requires and the rider can
read. Battery use during a ride is higher, as for any navigator. No iOS behaviour is claimed yet.

## Alternatives considered

Background location permission and a task that receives the fixes: heavier permission, a scarier prompt, and the
fixes would have to be handed to the navigator from a task. A custom native foreground service: more code to own, for
the same effect. Keeping the screen on only (`expo-keep-awake`, as now): drains the battery and breaks when the rider
presses the lock button.

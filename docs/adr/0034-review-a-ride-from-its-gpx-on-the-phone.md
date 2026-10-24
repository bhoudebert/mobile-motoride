# 0034. Review a ride from its GPX, on the phone

- Status: accepted
- Date: 2026-10-22

## Context

The app records every ride as a GPX with altitude and, when the gauges are on, lean and G readings in `motoride:` extensions
(ADR 0027, ADR 0031). Nothing reads them back. The rider cannot see the ride again, and nobody can check the lean gauge against a real
ride, which is the only way to tune it. A rider who rents or owns a server (ADR 0028) will want the rides kept there too, but that
is a later step and must not change what a ride is.

## Decision

- The review reads the GPX file the phone already keeps; nothing new is stored and nothing is sent. `parseRideGpx` reads the
  points back (position, time, altitude and the `motoride:` readings), tolerant of tracks that lack them.
- The figures, the speed profile, the colouring of the track and the replay timeline are pure functions of the points in
  `src/core/review.ts`, tested by Node. A server could compute the same figures from the same file; nothing in them knows about the phone.
- The track is drawn on the map in four colours by speed, as a GeoJSON line per run of one speed class; the peaks are marked. Profiles are
  drawn with plain views, no chart library.
- The replay runs on the phone from a timeline in which a gap longer than 30 s counts as 30 s, so a stop does not stall it.
- Rides stay one file, shared as the same GPX (agentRide's `review` reads it, which a test keeps true), so a server that stores rides stores that file.

## Consequences

- Reading a long ride parses the whole file on the phone: a ride of several hours is a few thousand points, parsed in a fraction of a
  second; a very long one is thinned for the map and the profiles, never for the figures.
- The review of an older ride shows what that ride holds: no lean, no altitude, no error.
- Uploading rides to a server is a later decision and needs no change here.

## Alternatives considered

- **A chart library.** Heavy for two small profiles; plain views are enough and follow the look.
- **Storing the figures at the end of a ride.** The meta already holds a few; computing from the track keeps one source of truth and
  lets old rides and shared files be reviewed the same way.
- **Reviewing only on a server.** It would give nothing to a rider without one, which is most of them.

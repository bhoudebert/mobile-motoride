# 0040. Traffic comes from the rider's server, drawn as colour on the route

- Status: accepted
- Date: 2026-10-22

## Context

A rider wants to see where the traffic is slow ahead, to decide for themselves to use Skip or take another road. Real-time traffic
has no open source: it is a provider with a key and a quota. A key in the app is a key in every copy, and the publisher would
answer for everyone's use. agentRide chose the roads of the roadbook (avoiding what it should), so the app never reroutes by
itself: it informs and the rider decides. agentRide's ADR 0030 puts the TomTom key on the host's server.

## Decision

The app has no traffic key and never talks to a provider. When the rider's server (ADR 0029 pairs it) says in `/health` that it
has traffic, the ride screen shows a traffic chip and, every 5 minutes and every 10 km, sends here and every 10 km up to 60 km
ahead (7 points, latitude and longitude only) to `POST /traffic` with the token. The levels that come back (free, slow, heavy,
closed, unknown) colour the roadbook line amber or red around each jam point, give the chip its distance, and fill a card with a
switch (kept) and the credit. The roadbook, its guidance and its corner warnings never change.

## Consequences

Whoever hosts answers for their traffic source: by default open government data (agentRide ADR 0042: France for now, more countries on request), or TomTom with the host's own key if they choose it (ADR 0041). The app and the project carry no key. The server says in `/health` whether it has traffic and for which countries; the Server screen and the traffic card show it (spec server-features). Without a server nothing about
traffic exists in the app, which keeps the app free to use. The rider's server learns about where they ride, to a kilometre, which
live sharing (encrypted end to end) never lets it do: the guide and the privacy policy say so. A point every 10 km is an
indication, not a map of the traffic; a jam shorter than the spacing is seen only if a point falls in it. Colour is drawn with
two levels (amber, red) so it reads in sunlight. Not yet: the voice (a word before a jam) and incidents.

## Alternatives considered

A key in the app: extractable, and the publisher answers for every rider's use. Traffic tiles drawn over the map: precise to look at
but heavy to relay and no number to say or show on a chip. A service run by the project: a cost and a duty it does not want, and one
more place that knows where riders are. Rerouting around jams: it would undo agentRide's choice of roads, which the rider made.

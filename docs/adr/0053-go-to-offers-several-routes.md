# 0053. Go To offers several routes, ranked with the traffic of the rider's server

- Status: accepted
- Date: 2026-11-19

## Context

Go To (ADR 0022) gave one route. A rider going home wants the fastest, and a choice: motorway or not, shortest, and what
the traffic does to each, as in the navigation apps. ADR 0040 says the app never talks to a traffic provider: traffic comes from
the rider's server, as the levels of a few points.

## Decision

- **Three profiles, asked in parallel**: fastest (motorways allowed), without motorway (`use_highways: 0`), shortest
  (`shortest: true`). Each answer gives the line, the time and the distance of Valhalla's summary. A failed one is dropped; routes
  on nearly the same road are merged (about the same length, most of the line within 150 m).
- **Other roads fill the choice.** The three ways often follow the same road on a short trip (Coutiches to Tournai: 27 min, 20.8 km
  each on the public Valhalla). The fastest is also asked with `alternates: 2`; those roads are offered as "Another road" after the
  three ways, at most three routes in all (the same trip then offers 27 min / 20.8 km and 32 min / 38 km).
- **Ranked by time with traffic.** With a server that has a traffic source, up to 8 points per route over its first 60 km go to
  `/traffic`; a `slow` point stretches the time of the part of the route it stands for by 1.4, a `heavy` one by 2.5, a `closed` one
  makes the route last. The route with the least time is the default. Without traffic, it is the least time of the route.
- **The picker is a screen** after the search and before the ride: the map with all routes (selected thick and green, others thin
  and in another colour), a card each, Start. One route left: no picker.
- The ride itself is unchanged: the chosen line becomes the roadbook, as in ADR 0022.

## Consequences

- Three requests per place chosen. They go to the public Valhalla as ADR 0008 does; when the rider's server proxies its own
  Valhalla (agentRide, not yet) the app can use it without a change of design, and the cost for the public service falls to none.
- The traffic ranking is as coarse as ADR 0040's points (an indication), a jam between two points is not seen. It is a hint to
  choose with, and the rider chooses.
- The delay factors are estimates (1.4 and 2.5), not measured speeds; they are constants of the core to change in one place.
- Rerouting while riding does not offer choices. Avoiding a zone is a later change.

## Alternatives considered

Valhalla's `alternates`: different roads but no names and no guarantee about motorways. Re-ranking after the screen is shown: the
order would change under the rider's finger, so traffic is asked before the screen opens (with a short timeout). Asking traffic on
the first 60 km only is a limit of ADR 0040's endpoint (8 points).

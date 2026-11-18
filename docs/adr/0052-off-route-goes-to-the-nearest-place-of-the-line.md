# 0052. A rider far from the route goes to the nearest place of the line, forward

- Status: accepted (changes ADR 0051)
- Date: 2026-11-18

## Context

ADR 0051 sent a rider more than 500 m from the roadbook to the cheapest route _point_ not yet reached. A rider who missed the
start of an 80 km leg and rode 30 km on their own way kept being sent back to that start: the points are few, and the first
one not reached is a long way behind. The riders' way is better served by the nearest place of the line, which is what a
navigation app does when it recomputes.

## Decision

- **Beyond 500 m**, the target is a place of the roadbook's line (not a route point): the cheapest by straight distance,
  up to twice that behind the rider's heading, half as much again for a place already passed (before the last place the
  rider was on the line), and 10 % more at the very end of the line as a tie-breaker. On a loop that returns to its start,
  the last leg costs half as much again until reached, since it ends where the ride starts.
- The target is **kept** until another costs 60 % of it or less, so it does not hop on a loop or as the heading changes.
- The route points before the target count as **passed**; the next one met from it is named aloud and is the one the skip
  button offers to skip.
- The way back is asked for **at once** when the rider leaves the way back they were given, not after the 30 s wait.
- **Within 500 m** nothing changes (nearest point, 150 m further along).

## Consequences

- No point-to-point heuristic to explain: the target is where the line is nearest, preferring forward.
- Replaying the recorded rides of 8 November (`test/rejoin.test.ts`) gives one or two target changes per ride, instead of
  hops, and a skip offered all along.
- On a line that doubles back near itself, the nearest place may be on another leg than the one the rider is on; the rider
  can skip.

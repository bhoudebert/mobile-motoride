# 0051. A rider far from the route goes to the cheapest route point

- Status: accepted
- Date: 2026-11-08

## Context

ADR 0012 sent a rider who left the roadbook back to the nearest point of its line, 150 m further along. That is right for a
missed turn. It is wrong for a rider who chose their own way, for fuel or a detour: the nearest point of the line is behind
them, the app says to turn round, the arrow flips as the nearest point changes (on a loop that closes on itself it jumps
between the end and the start), and the route asked from Valhalla leads back where the rider came from. Replaying the rides
recorded on 1 and 8 November 2026 (`test/fixtures/rides`) showed a target frozen for 20 minutes while the rider was 6 km
away, and no skip offered, because the progress of a lost rider is the nearest point of the line, often the end of the loop.
ADR 0013's skip by itself (nearer a later point and heading to it) fired in none of those rides.

## Decision

- **Within 500 m of the line**, a missed turn: unchanged, the nearest point of the line 150 m further along.
- **Farther**, the rider is on their own way. The target is the route point not yet reached that is cheapest to go to: its
  straight-line distance, up to twice that when it lies behind the rider's heading. The next point wins unless a later one costs
  70 % of it or less; the finish is kept for last. Points before the target are dropped, as for a skip. This replaces the skip by itself
  of ADR 0013 (one mechanism, not two asking Valhalla at once).
- **Normal navigation on the way there**: the route from Valhalla is ridden as part of the roadbook, solid like it, with
  instructions, corner warnings and speed limits. Only a straight-line fallback stays dashed, since it is no road.
- **The heading goes to Valhalla** (`heading`, `heading_tolerance` 60) so the route starts in the direction of travel when the
  road allows; a U-turn happens only when it is much the nearest way.
- **The navigator reports `reachedM`**, the last place the rider was on the line, and the skip is computed from it while lost.
  The arrow follows the rider's heading while lost, not the direction of a far-off nearest point.

## Consequences

- A rider can leave for fuel and be sent on to the next point, not back to the start.
- The cost is a heuristic (a straight line, not a road distance). It can pick a point that is nearer as the crow flies but farther
  by road; the rider can skip again, and the route is asked again every 30 s from where they are.
- Tested by replaying the recorded rides through the navigator (`test/rejoin.test.ts`), and a hook test for the request.

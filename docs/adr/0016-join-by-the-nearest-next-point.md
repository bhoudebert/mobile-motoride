# 0016. Join the roadbook by the nearest next point, proposed not imposed

- Status: accepted
- Date: 2026-10-18

## Context

The first version of "start from a point" was a button in the HUD that looked like a label: nobody found it or understood
it. The rider's real need is simpler: set off from wherever they are, and have the app take them to the right place on
the roadbook, dropping what is behind them. Always sending them to the start of the roadbook, as before, is wrong when
they join the loop in the middle.

## Decision

Pressing Start away from the line opens a card with the answer already chosen: **go to the nearest next route point**,
skipping the ones before it. The rider can instead go to the start, choose any route point, or cancel. The card
appears only when it matters (farther than 150 m from the line) and only before the ride, when the rider is stopped.
The routing is the one of a skip (ADR 0013). The map gets a key and a quieter overview (corner marks only when zoomed
in) so its marks need no explaining by a person.

## Consequences

Joining mid-loop is one tap, and an unwanted join is one tap away from corrected. A rider at home still gets the start
as the first choice. The card is one more step before a ride from afar; a rider on the line sees none. The nearest
next point is the nearest on the line, not the nearest by road: a point on a parallel road may be proposed, and the rider
can choose another.

## Alternatives considered

Joining automatically with no question: one fewer tap, but a ride begun in the wrong half of the loop is annoying and
silent. A picker only: what we had. Keeping the start as the only default: wrong for a rider who joins on the way.

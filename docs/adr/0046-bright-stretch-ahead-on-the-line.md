# 0046. A bright stretch ahead and a pale ridden part on the line

- Status: accepted
- Date: 2026-10-31

## Context

The roadbook line was one colour with small grey arrows. Where a road is ridden out and back, or the roadbook crosses itself,
two passes lie on the same pixels with arrows pointing both ways, so the rider could not tell from the map which way to go.
A close look at the map of a real roadbook showed arrows alternating up and down along one road.

## Decision

Two things, both drawn on the map and neither taking room from the screen:

1. The part of the roadbook already ridden is drawn pale and the part ahead in the line's colour, with a hard step at the
   rider (a `line-gradient` on the line, which needs `lineMetrics` on its source). The style changes every thousandth of the
   roadbook.
2. The 3 km just ahead of the rider are cut from the line (`sliceLine`, in `src/core/lineStyle.ts`) and drawn again on top, in
   a brighter colour with a white outline and bold white chevrons (`assets/chevron.png`, made by `scripts/make-chevron.ts`).
   The slice starts at the rider rounded down to 50 m, so the source is replaced every 50 m and not on every fix. The whole line
   keeps its small arrows.

Neither is drawn before Start or on the approach.

## Consequences

Where two passes share a road, the one to ride now is the bright one with chevrons and the other one is under it. The bright
stretch is short, so a rider looking ahead beyond 3 km sees the plain line. Cost: a second small source updated every 50 m,
and a gradient expression updated every thousandth of the roadbook; both are small next to the 250 km line the map already
holds.

## Alternatives considered

Only bigger arrows along the whole line: at an overlap both passes still show, in both directions. Splitting the line into a
ridden and a remaining feature updated on every fix: it sends the whole line to the map every second. A halo on the arrows:
the arrow picture is a signed distance field that goes grey when small, so a plain picture with its own outline was drawn.

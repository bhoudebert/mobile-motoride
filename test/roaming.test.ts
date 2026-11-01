import assert from "node:assert/strict";
import { test } from "node:test";
import { backOnRoute, withApproach } from "../src/core/approach.ts";
import { unproject } from "../src/core/geo.ts";
import { limitAt } from "../src/core/limits.ts";
import { createNavigator } from "../src/core/navigator.ts";
import { prepareRoadbook } from "../src/core/roadbook.ts";
import { pointAt } from "../src/core/track.ts";
import { drawLine, fixAt, REF } from "./helpers/path.ts";
import type { LatLon } from "../src/core/types.ts";

// Roadbook: 4 km due east, route points every kilometre, 90 km/h all along.
const roadbook = () => {
  const line = drawLine([{ straight: 4000 }]);
  const at = (m: number) => line[Math.round(m / 5)]!;
  return prepareRoadbook({
    id: "t",
    name: "t",
    description: "",
    line,
    stops: [0, 1000, 2000, 3000, 4000].map((m, i) => ({ lat: at(m)[0], lon: at(m)[1], name: `P${i + 1}` })),
    limits: [{ from: 0, to: 4000, kmh: 90, posted: true }],
  });
};

/** A point `x` metres east and `y` metres north of the first point of the roadbook. */
const here = (x: number, y: number): LatLon => unproject([x, y], REF);

// A rider leaves the road at 1000 m, rides a parallel road 300 m north, and the app rebuilds the ride towards a
// point of the line 1150 m along. The parallel road meets the original road again at 1050 m: the rider is back on
// the path before the point the rebuilt route aims at.
test("back on the path before the rejoin point: no longer off route, riding the roadbook (green)", () => {
  const rb = roadbook();
  const rebuilt = withApproach(
    rb,
    [here(1000, 0), here(1000, 300), here(1150, 300), here(1150, 0)],
    false,
    1150,
    "route",
  );
  const nav = createNavigator(rebuilt);
  let t = 0;
  // Along the rebuilt route, then down onto the original road at 1050, 100 m before the rejoin point.
  const ridden: LatLon[] = [here(1000, 0), here(1000, 300), here(1100, 300), here(1100, 150), here(1100, 0)];
  let last = nav.update(fixAt(ridden[0]!, 60, t));
  for (const p of ridden.slice(1)) for (let k = 0; k < 6; k++) last = nav.update(fixAt(p, 60, (t += 1000)));
  // The rebuilt line no longer holds the road under the rider: the roadbook is ridden again from there.
  assert.equal(last.offRoute, true);
  assert.equal(backOnRoute(rb, rebuilt, ridden.at(-1)!), true);
  const again = createNavigator(rb).update(fixAt(ridden.at(-1)!, 60, t + 1000));
  assert.equal(again.offRoute, false);
  assert.equal(again.phase, "ride");
});

test("the speed limit is known on a rebuilt route, not only on the roadbook after it", () => {
  const rb = roadbook();
  const rebuilt = withApproach(
    rb,
    [here(1000, 0), here(1000, 300), here(1150, 300), here(1150, 0)],
    false,
    1150,
    "route",
  );
  const onApproach = limitAt(rebuilt, rebuilt.approachM / 2);
  assert.equal(onApproach.kmh !== null, true, "no limit on the way back to the route");
});

test("a skipped point or the approach to the start is not undone by meeting the road", () => {
  const rb = roadbook();
  const skipped = withApproach(rb, [here(1000, 0), here(1150, 0)], false, 1150, "route", "P3");
  const toStart = withApproach(rb, [here(-500, 0), here(0, 0)], false);
  assert.equal(backOnRoute(rb, skipped, here(1100, 0)), false);
  assert.equal(backOnRoute(rb, toStart, here(1100, 0)), false);
  assert.equal(backOnRoute(rb, rb, here(1100, 0)), false);
});

test("the rebuilt route keeps the route points that were not passed", () => {
  const rb = roadbook();
  const rebuilt = withApproach(rb, [here(1000, 0), here(1150, 0)], false, 1150, "route");
  const names = rebuilt.stops.map((s) => s.name);
  assert.deepEqual(names, ["P3", "P4", "P5"]);
  assert.ok(pointAt(rb.roadbook.line, rb.cumulativeM, 1150));
});

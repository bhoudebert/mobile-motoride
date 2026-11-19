import assert from "node:assert/strict";
import { test } from "node:test";
import {
  choicePoints,
  distinctRoutes,
  rankRoutes,
  trafficDelay,
  TRAFFIC_HEAVY_FACTOR,
  type RouteCandidate,
} from "../src/core/routeChoices.ts";
import type { TrafficLevel } from "../src/core/traffic.ts";
import { cumulativeDistances } from "../src/core/track.ts";
import { drawLine } from "./helpers/path.ts";

const length = (line: ReturnType<typeof drawLine>) => cumulativeDistances(line).at(-1)!;
/** A route along a road drawn by the turtle: `speedKmh` fixes its time. */
function route(kind: RouteCandidate["kind"], line: ReturnType<typeof drawLine>, speedKmh: number): RouteCandidate {
  const lengthM = length(line);
  return { kind, line, lengthM, timeS: Math.round(lengthM / (speedKmh / 3.6)) };
}

const direct = drawLine([{ straight: 20_000 }]);
const detour = drawLine([{ straight: 6000 }, { arc: 800, deg: 90, dir: "left" }, { straight: 8000 }]);

test("routes on the same road are shown once, under the name that comes first", () => {
  const out = distinctRoutes([
    route("shortest", direct, 70),
    route("fastest", direct, 90),
    route("noMotorway", direct, 70),
  ]);
  assert.deepEqual(
    out.map((r) => r.kind),
    ["fastest"],
  );
});

test("routes on different roads are all kept", () => {
  const out = distinctRoutes([route("fastest", direct, 100), route("noMotorway", detour, 60)]);
  assert.deepEqual(
    out.map((r) => r.kind),
    ["fastest", "noMotorway"],
  );
});

test("a route of about the same length that follows another road is kept", () => {
  const north = drawLine([{ straight: 3000 }, { arc: 1500, deg: 180, dir: "left" }, { straight: 3000 }]);
  const south = drawLine([{ straight: 3000 }, { arc: 1500, deg: 180, dir: "right" }, { straight: 3000 }]);
  assert.equal(distinctRoutes([route("fastest", north, 70), route("shortest", south, 70)]).length, 2);
});

test("the points asked of the traffic are at most 8, over the first 60 km, 2 to 10 km apart", () => {
  const far = drawLine([{ straight: 100_000 }], 50);
  const pts = choicePoints(far);
  assert.ok(pts.length <= 8 && pts.length >= 6, `${pts.length} points`);
  const short = choicePoints(drawLine([{ straight: 5000 }]));
  assert.ok(short.length >= 2 && short.length <= 3, `${short.length} points on 5 km`);
  assert.ok(short.every((p) => p.spanM <= 5000));
});

test("a jam adds to the time the part of the route it stands for, a closed point is flagged", () => {
  const r = route("fastest", direct, 72); // 20 m/s: 1000 s
  const pts = choicePoints(direct);
  const levels: TrafficLevel[] = pts.map(() => "free");
  assert.deepEqual(trafficDelay(r, pts, levels), { delayS: 0, closed: false });
  levels[1] = "heavy";
  const heavy = trafficDelay(r, pts, levels);
  assert.equal(heavy.delayS, Math.round((pts[1]!.spanM / 20) * (TRAFFIC_HEAVY_FACTOR - 1)));
  levels[2] = "closed";
  assert.equal(trafficDelay(r, pts, levels).closed, true);
});

test("the route with the least time comes first, and a jam on the fastest puts another first", () => {
  const fast = route("fastest", direct, 100);
  const slow = route("noMotorway", detour, 60);
  assert.equal(rankRoutes([fast, slow], null)[0]!.kind, "fastest");
  const pts = choicePoints(direct);
  const jam = { points: pts, levels: pts.map(() => "heavy" as const) };
  const free = { points: choicePoints(detour), levels: choicePoints(detour).map(() => "free" as const) };
  const ranked = rankRoutes([fast, slow], [jam, free]);
  assert.equal(ranked[0]!.kind, "noMotorway");
  assert.ok(ranked[1]!.delayS > 0 && ranked[1]!.totalS > ranked[1]!.timeS);
});

test("a closed route comes last while another is open", () => {
  const fast = route("fastest", direct, 100);
  const slow = route("noMotorway", detour, 60);
  const pts = choicePoints(direct);
  const closed = { points: pts, levels: pts.map((_, i) => (i === 1 ? ("closed" as const) : ("free" as const))) };
  const ranked = rankRoutes([fast, slow], [closed, null]);
  assert.equal(ranked[0]!.kind, "noMotorway");
  assert.equal(ranked[1]!.closed, true);
  assert.equal(rankRoutes([fast], [closed])[0]!.kind, "fastest");
});

test("traffic of one route unknown leaves its time as it is", () => {
  const fast = route("fastest", direct, 100);
  assert.equal(rankRoutes([fast], [null])[0]!.delayS, 0);
});

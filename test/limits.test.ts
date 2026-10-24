import assert from "node:assert/strict";
import { test } from "node:test";
import { withApproach } from "../src/core/approach.ts";
import { isOver, limitAt, NEXT_LIMIT_LOOKAHEAD_M, UNKNOWN_LIMIT } from "../src/core/limits.ts";
import { createNavigator } from "../src/core/navigator.ts";
import { parseRoadbookFile } from "../src/core/roadbookFile.ts";
import { prepareRoadbook } from "../src/core/roadbook.ts";
import { pointAt } from "../src/core/track.ts";
import { drawLine, fixAt } from "./helpers/path.ts";
import { encodePolyline, roadbookFile } from "./helpers/polyline.ts";
import type { LatLon, PreparedRoadbook } from "../src/core/types.ts";

// 3 km east with a point every 5 m: 601 points.
const straight = () => drawLine([{ straight: 3000 }]);
const prep = (extra: Record<string, unknown>, line: LatLon[] = straight()): PreparedRoadbook =>
  prepareRoadbook(parseRoadbookFile(roadbookFile(line, extra)));

const LIMITS = [
  { from: 0, to: 200, kmh: 50, posted: true, road: "D 954" },
  { from: 200, to: 400, kmh: 80, posted: false },
  { from: 400, to: 600, kmh: 90, posted: true },
];

test("a roadbook file gives its line, stops, limits and cameras", () => {
  const line = straight();
  const rb = parseRoadbookFile(
    roadbookFile(line, {
      name: "Pays",
      description: "122 km",
      stops: [{ lat: line[0]![0], lon: line[0]![1], name: "Start" }],
      limits: LIMITS,
      cameras: [{ lat: line[100]![0], lon: line[100]![1], kmh: 70, direction: "forward" }],
    }),
  );
  assert.equal(rb.name, "Pays");
  assert.equal(rb.id, "pays");
  assert.equal(rb.line.length, line.length);
  assert.equal(rb.stops[0]!.name, "Start");
  assert.equal(rb.limits!.length, 3);
  assert.deepEqual(rb.limits![0], { from: 0, to: 200, kmh: 50, posted: true, road: "D 954" });
  assert.equal(rb.cameras![0]!.kmh, 70);
});

test("a roadbook file's stops named by coordinates are tidied", () => {
  const rb = parseRoadbookFile(
    roadbookFile(straight(), {
      stops: [
        { lat: 50, lon: 3, name: "Start: 50.0,3.0", kind: "waypoint" },
        { lat: 50, lon: 3, name: "1. 50.6,3.6", kind: "waypoint" },
        { lat: 50, lon: 3, name: "pause: Café", kind: "stop" },
      ],
    }),
  );
  assert.deepEqual(
    rb.stops.map((s) => s.name),
    ["Start", "Point 1", "pause: Café"],
  );
});

test("a file that is not a roadbook file is refused with a reason", () => {
  assert.throws(() => parseRoadbookFile("nope"), /not JSON/);
  assert.throws(() => parseRoadbookFile("[]"), /not a motoride-roadbook/);
  assert.throws(() => parseRoadbookFile(JSON.stringify({ format: "gpx", version: 1 })), /not a motoride-roadbook/);
  assert.throws(() => parseRoadbookFile(JSON.stringify({ format: "motoride-roadbook" })), /no version/);
  assert.throws(
    () => parseRoadbookFile(JSON.stringify({ format: "motoride-roadbook", version: 2, line: "" })),
    /version 2 is newer than this app understands/,
  );
  assert.throws(() => parseRoadbookFile(JSON.stringify({ format: "motoride-roadbook", version: 1 })), /no line/);
  assert.throws(() => parseRoadbookFile(roadbookFile([[50, 3]])), /1 point\(s\)/);
});

test("broken optional parts are dropped and the file is kept", () => {
  const line = straight();
  const rb = parseRoadbookFile(
    roadbookFile(line, {
      unknownField: { anything: true },
      stops: [{ lat: 999, lon: 3 }, { lat: 50, lon: 3, name: "ok" }, "junk"],
      limits: [
        { from: 10, to: 10, kmh: 50 },
        { from: 20, to: 10, kmh: 50 },
        { from: -1, to: 5, kmh: 50 },
        { from: 0, to: 99999, kmh: 50 },
        { from: 0, to: 5, kmh: 0 },
        { from: 0, to: 5, kmh: 500 },
        { from: 0.5, to: 5, kmh: 50 },
        { from: 0, to: 5 },
        { from: 5, to: 9, kmh: 50 },
      ],
      cameras: [{ lat: "x", lon: 3 }, { lat: 50, lon: 3, kmh: -1, direction: "sideways" }, null],
    }),
  );
  assert.equal(rb.stops.length, 1);
  assert.deepEqual(rb.limits, [{ from: 5, to: 9, kmh: 50, posted: false }]);
  assert.equal(rb.cameras!.length, 1);
  assert.equal(rb.cameras![0]!.kmh, null);
  assert.equal(rb.cameras![0]!.direction, null);
});

test("an optional part that is not a list is ignored", () => {
  const rb = parseRoadbookFile(roadbookFile(straight(), { limits: "x", cameras: 5, stops: {} }));
  assert.deepEqual(rb.limits, []);
  assert.deepEqual(rb.cameras, []);
  assert.deepEqual(rb.stops, []);
});

test("stretches become distance ranges along the line", () => {
  const rb = prep({ limits: LIMITS });
  assert.equal(rb.limitSegments.length, 3);
  const [a, b, c] = rb.limitSegments;
  assert.equal(a!.startM, 0);
  assert.ok(Math.abs(a!.endM - 1000) < 5);
  assert.ok(Math.abs(b!.startM - a!.endM) < 0.01, "consecutive stretches meet");
  assert.ok(Math.abs(c!.endM - 3000) < 10);
});

test("the limit at the rider, posted or assumed, and the next different one", () => {
  const rb = prep({ limits: LIMITS });
  const first = limitAt(rb, 500);
  assert.equal(first.kmh, 50);
  assert.equal(first.posted, true);
  assert.equal(first.road, "D 954");
  assert.equal(first.next?.kmh, 80);
  assert.ok(Math.abs(first.next!.distanceM - 500) < 5);
  const second = limitAt(rb, 1200);
  assert.equal(second.kmh, 80);
  assert.equal(second.posted, false);
  assert.equal(second.next?.kmh, 90);
  assert.equal(limitAt(rb, rb.limitSegments[1]!.startM).kmh, 80, "a boundary belongs to the next stretch");
});

test("the next limit is shown only within 800 m, and not when it is the same", () => {
  const rb = prep({
    limits: [
      { from: 0, to: 300, kmh: 50 },
      { from: 300, to: 600, kmh: 50 },
    ],
  });
  assert.equal(limitAt(rb, 100).next, null);
  const far = prep({ limits: LIMITS });
  assert.ok(NEXT_LIMIT_LOOKAHEAD_M < 1000);
  assert.equal(limitAt(far, 100).next, null, "the next limit starts 900 m ahead");
});

test("across a gap the last known limit is held, marked assumed; unknown only before the first stretch", () => {
  const rb = prep({ limits: [{ from: 300, to: 400, kmh: 70, posted: true }] });
  const before = limitAt(rb, 1200);
  assert.equal(before.kmh, null, "nothing is known yet");
  assert.equal(before.next?.kmh, 70);
  const inside = limitAt(rb, 1700);
  assert.equal(inside.kmh, 70);
  assert.equal(inside.posted, true);
  assert.equal(inside.carried, false);
  const after = limitAt(rb, 2900);
  assert.equal(after.kmh, 70);
  assert.equal(after.posted, false);
  assert.equal(after.carried, true);
  assert.equal(after.next, null);
});

test("a gap between two stretches keeps the first limit until the second begins", () => {
  const rb = prep({
    limits: [
      { from: 0, to: 100, kmh: 80, posted: true },
      { from: 160, to: 300, kmh: 50, posted: true },
    ],
  });
  const gap = limitAt(rb, 650);
  assert.equal(gap.kmh, 80);
  assert.equal(gap.carried, true);
  assert.equal(gap.posted, false);
  assert.equal(gap.next?.kmh, 50);
  assert.equal(limitAt(rb, 900).kmh, 50);
});

test("no limits at all: unknown, never zero", () => {
  const rb = prep({});
  assert.deepEqual(limitAt(rb, 500), UNKNOWN_LIMIT);
  assert.equal(limitAt(rb, 500).kmh, null);
});

test("over the limit means more than 2 km/h above it, with a known limit and speed", () => {
  const ms = (kmh: number) => kmh / 3.6;
  assert.equal(isOver(ms(50), 50), false);
  assert.equal(isOver(ms(52), 50), false);
  assert.equal(isOver(ms(52.5), 50), true);
  assert.equal(isOver(ms(90), 50), true);
  assert.equal(isOver(null, 50), false);
  assert.equal(isOver(ms(90), null), false);
});

test("the navigator reports the limit, the speed and whether the rider is over", () => {
  const rb = prep({ limits: LIMITS });
  const nav = createNavigator(rb);
  const at = (m: number, kmh: number, time: number) =>
    nav.update(fixAt(pointAt(rb.roadbook.line, rb.cumulativeM, m), kmh, time));
  let s = at(300, 49, 0);
  assert.equal(s.speedLimit.kmh, 50);
  assert.equal(Math.round(s.speedKmh!), 49);
  assert.equal(s.over, false);
  s = at(330, 56, 1000);
  assert.equal(s.over, true);
  s = at(360, 51, 2000);
  assert.equal(s.over, false);
  s = at(1100, 70, 3000);
  assert.equal(s.speedLimit.kmh, 80);
  assert.equal(s.over, false);
});

test("a fix without a speed is never over, and the speed is null", () => {
  const rb = prep({ limits: LIMITS });
  const s = createNavigator(rb).update({
    ...fixAt(pointAt(rb.roadbook.line, rb.cumulativeM, 300), 0, 0),
    speedMps: null,
  });
  assert.equal(s.speedKmh, null);
  assert.equal(s.over, false);
  assert.equal(s.speedLimit.kmh, 50);
});

test("on the approach the limit is unknown, then the roadbook's takes over", () => {
  const rb = prep({ limits: LIMITS });
  const approach: LatLon[] = drawLine([{ straight: 1500 }]).map(([lat, lon]) => [lat, lon - 0.0213]);
  const joined = withApproach(rb, approach, false);
  const nav = createNavigator(joined);
  const early = nav.update(fixAt(pointAt(joined.roadbook.line, joined.cumulativeM, 400), 50, 0));
  assert.equal(early.phase, "approach");
  assert.equal(early.speedLimit.kmh, null);
  const onRoad = nav.update(fixAt(pointAt(joined.roadbook.line, joined.cumulativeM, joined.approachM + 300), 50, 1000));
  assert.equal(onRoad.phase, "ride");
  assert.equal(onRoad.speedLimit.kmh, 50);
});

test("a GPX roadbook has no limits and no zones", () => {
  const rb = prepareRoadbook({ id: "g", name: "g", description: "", stops: [], line: straight() });
  assert.deepEqual(rb.limitSegments, []);
  assert.deepEqual(rb.zones, []);
  void encodePolyline;
});

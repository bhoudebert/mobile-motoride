import assert from "node:assert/strict";
import { test } from "node:test";
import { withApproach } from "../src/core/approach.ts";
import {
  angleDiff,
  compassDirection,
  HEADING_MIN_SPEED_MPS,
  relativeDirection,
  travelHeading,
} from "../src/core/heading.ts";
import { createNavigator } from "../src/core/navigator.ts";
import { parseRoadbookFile } from "../src/core/roadbookFile.ts";
import { prepareRoadbook } from "../src/core/roadbook.ts";
import { pointAt } from "../src/core/track.ts";
import { drawLine } from "./helpers/path.ts";
import { roadbookFile } from "./helpers/polyline.ts";
import type { Fix, LatLon, PreparedRoadbook } from "../src/core/types.ts";

// 4 km heading east.
const east = () => drawLine([{ straight: 4000 }]);
const prep = (extra: Record<string, unknown> = {}, line = east()): PreparedRoadbook =>
  prepareRoadbook(parseRoadbookFile(roadbookFile(line, extra)));
const at = (rb: PreparedRoadbook, m: number): LatLon => pointAt(rb.roadbook.line, rb.cumulativeM, m);
const fix = (p: LatLon, kmh: number, time: number, headingDeg?: number | null): Fix => ({
  lat: p[0],
  lon: p[1],
  speedMps: kmh / 3.6,
  accuracyM: 5,
  time,
  ...(headingDeg === undefined ? {} : { headingDeg }),
});

test("angleDiff wraps around north and is symmetric", () => {
  assert.equal(angleDiff(350, 10), 20);
  assert.equal(angleDiff(10, 350), 20);
  assert.equal(angleDiff(0, 180), 180);
  assert.equal(angleDiff(90, 90), 0);
  assert.equal(angleDiff(720, 10), 10);
});

test("a GPS heading counts only when known, valid and moving at 10 km/h or more", () => {
  assert.equal(travelHeading(90, 20 / 3.6), 90);
  assert.equal(travelHeading(360, 20 / 3.6), 0);
  assert.equal(travelHeading(90, 9 / 3.6), null);
  assert.equal(travelHeading(90, HEADING_MIN_SPEED_MPS), 90);
  assert.equal(travelHeading(-1, 20), null);
  assert.equal(travelHeading(null, 20), null);
  assert.equal(travelHeading(undefined, 20), null);
  assert.equal(travelHeading(400, 20), null);
  assert.equal(travelHeading(90, null), null);
});

test("relative directions in eight sectors, compass points for an unknown heading", () => {
  assert.deepEqual(
    [0, 45, 90, 135, 180, 225, 270, 315].map((b) => relativeDirection(b, 0)),
    ["ahead", "ahead right", "right", "behind right", "behind", "behind left", "left", "ahead left"],
  );
  assert.equal(relativeDirection(90, 90), "ahead");
  assert.equal(relativeDirection(0, 90), "left");
  assert.equal(compassDirection(0), "north");
  assert.equal(compassDirection(135), "south-east");
  assert.equal(compassDirection(359), "north");
});

test("a camera watches the traffic coming at it; cameras at one place keep both directions", () => {
  const line = east();
  const cam = (bearing: number | null, extra = {}) => ({
    lat: line[400]![0],
    lon: line[400]![1],
    kmh: 70,
    bearing,
    direction: null,
    ...extra,
  });
  assert.deepEqual(prep({ cameras: [cam(90)] }).zones[0]!.watched, [270]);
  assert.deepEqual(prep({ cameras: [cam(270)] }).zones[0]!.watched, [90]);
  assert.equal(prep({ cameras: [cam(null)] }).zones[0]!.watched, null);
  assert.equal(prep({ cameras: [cam(90, { direction: "both" })] }).zones[0]!.watched, null);
  assert.deepEqual(prep({ cameras: [cam(90), cam(270)] }).zones[0]!.watched, [270, 90]);
  assert.equal(prep({ cameras: [cam(90), cam(null)] }).zones[0]!.watched, null);
});

const zoneWarnings = (rb: PreparedRoadbook, headingDeg: number | null | undefined) => {
  const nav = createNavigator(rb);
  let n = 0;
  for (let m = 1000; m < 2200; m += 25) if (nav.update(fix(at(rb, m), 60, m, headingDeg)).zoneWarning) n++;
  return n;
};
const cameraAt2km = (bearing: number | null) => {
  const line = east();
  return prep({ cameras: [{ lat: line[400]![0], lon: line[400]![1], kmh: 70, bearing, direction: null }] });
};

test("a camera facing the rider warns; one facing the same way the rider goes does not", () => {
  // The line goes east. A camera facing west watches eastbound traffic.
  assert.equal(zoneWarnings(cameraAt2km(270), 90), 1);
  assert.equal(zoneWarnings(cameraAt2km(90), 90), 0);
});

test("without a GPS heading the direction of the line decides", () => {
  assert.equal(zoneWarnings(cameraAt2km(270), undefined), 1);
  assert.equal(zoneWarnings(cameraAt2km(90), undefined), 0);
  assert.equal(zoneWarnings(cameraAt2km(90), null), 0);
});

test("the phone's heading wins over the line: a rider going the other way is watched by the other camera", () => {
  assert.equal(zoneWarnings(cameraAt2km(90), 270), 1);
  assert.equal(zoneWarnings(cameraAt2km(270), 270), 0);
});

test("a camera with no bearing warns whichever way the rider goes", () => {
  assert.equal(zoneWarnings(cameraAt2km(null), 90), 1);
  assert.equal(zoneWarnings(cameraAt2km(null), 270), 1);
});

test("wrong way: three fixes against the line, moving, with a heading", () => {
  const rb = prep();
  const nav = createNavigator(rb);
  const ride = (m: number, kmh: number, t: number, heading: number | null) =>
    nav.update(fix(at(rb, m), kmh, t, heading));
  assert.equal(ride(500, 30, 0, 90).wrongWay, false);
  assert.equal(ride(500, 30, 1000, 270).wrongWay, false);
  assert.equal(ride(500, 30, 2000, 270).wrongWay, false);
  const wrong = ride(500, 30, 3000, 270);
  assert.equal(wrong.wrongWay, true);
  assert.equal(wrong.instruction.text, "U-turn, wrong way");
  assert.equal(wrong.instruction.kind, "uturn");
  assert.equal(ride(500, 30, 4000, 90).wrongWay, false, "the right heading clears it");
});

test("wrong way: nothing is said when slow, without a heading, or for a heading across the road", () => {
  const rb = prep();
  const nav = createNavigator(rb);
  for (let t = 0; t < 6; t++) assert.equal(nav.update(fix(at(rb, 500), 5, t * 1000, 270)).wrongWay, false);
  for (let t = 6; t < 12; t++) assert.equal(nav.update(fix(at(rb, 500), 30, t * 1000, null)).wrongWay, false);
  for (let t = 12; t < 18; t++) assert.equal(nav.update(fix(at(rb, 500), 30, t * 1000, 180)).wrongWay, false);
  for (let t = 18; t < 24; t++) assert.equal(nav.update(fix(at(rb, 500), 30, t * 1000, -1)).wrongWay, false);
});

test("wrong way: a standstill after being told keeps the instruction, the right heading ends it", () => {
  const rb = prep();
  const nav = createNavigator(rb);
  for (let t = 0; t < 3; t++) nav.update(fix(at(rb, 500), 30, t * 1000, 270));
  assert.equal(nav.update(fix(at(rb, 500), 0, 3000, 270)).wrongWay, true);
});

test("off route: the point to rejoin is ahead on the line, with the side to take", () => {
  const rb = prep();
  const nav = createNavigator(rb);
  const on = at(rb, 1000);
  nav.update(fix(on, 40, 0, 90));
  const away: LatLon = [on[0] + 0.0018, on[1]]; // about 200 m north of the line
  nav.update(fix(away, 40, 1000, 0));
  nav.update(fix(away, 40, 2000, 0));
  const lost = nav.update(fix(away, 40, 3000, 0));
  assert.equal(lost.offRoute, true);
  assert.ok(lost.rejoin);
  // 150 m past the nearest point of the line (the progress creeps a little with the speed of the fixes).
  assert.ok(lost.rejoin!.atM >= 1150 && lost.rejoin!.atM <= 1200, `rejoin at ${lost.rejoin!.atM}`);
  // Heading north, the target lies south-east: behind to the right.
  assert.match(lost.instruction.text, /^Rejoin the route, \d+ m, behind right$/);
  assert.equal(lost.instruction.kind, "rejoin");
  assert.ok(Math.abs((lost.instruction.relativeDeg ?? 0) - 150) < 20);
});

test("off route without a heading the direction is a compass point", () => {
  const rb = prep();
  const nav = createNavigator(rb);
  const on = at(rb, 1000);
  nav.update(fix(on, 40, 0));
  const away: LatLon = [on[0] + 0.0018, on[1]];
  nav.update(fix(away, 40, 1000));
  nav.update(fix(away, 40, 2000));
  const lost = nav.update(fix(away, 40, 3000));
  assert.match(lost.instruction.text, /south-east$/);
  assert.equal(lost.instruction.relativeDeg, null);
});

test("off route the target is never behind where the rider was on the line", () => {
  // Out and back over the same road: nearest points exist on both passes.
  const line = drawLine([{ straight: 2000 }, { arc: 2, deg: 180, dir: "left" }, { straight: 2000 }]);
  const rb = prepareRoadbook({ id: "t", name: "t", description: "", stops: [], line });
  const nav = createNavigator(rb);
  const back = pointAt(rb.roadbook.line, rb.cumulativeM, rb.totalM - 1000);
  nav.update(fix(back, 40, 0, 270));
  const away: LatLon = [back[0] + 0.0018, back[1]];
  nav.update(fix(away, 40, 1000));
  nav.update(fix(away, 40, 2000));
  const lost = nav.update(fix(away, 40, 3000));
  assert.ok(lost.rejoin!.atM > rb.totalM - 1000, `rejoin at ${lost.rejoin!.atM} of ${rb.totalM}`);
});

test("no rejoin and no wrong way while on the line", () => {
  const rb = prep();
  const s = createNavigator(rb).update(fix(at(rb, 500), 40, 0, 90));
  assert.equal(s.rejoin, null);
  assert.equal(s.wrongWay, false);
});

test("rejoining joins a route to the line at a later point and drops what was ridden", () => {
  const line = east();
  const stops = [
    { lat: line[0]![0], lon: line[0]![1], name: "Start" },
    { lat: line[400]![0], lon: line[400]![1], name: "Middle" },
    { lat: line[800]![0], lon: line[800]![1], name: "End" },
  ];
  const rb = prepareRoadbook(
    parseRoadbookFile(
      roadbookFile(line, {
        stops,
        limits: [
          { from: 0, to: 200, kmh: 50, posted: true },
          { from: 200, to: 800, kmh: 90, posted: true },
        ],
        cameras: [
          { lat: line[100]![0], lon: line[100]![1], kmh: 50, bearing: null, direction: null },
          { lat: line[500]![0], lon: line[500]![1], kmh: 90, bearing: null, direction: null },
        ],
      }),
    ),
  );
  const joinM = 1500;
  const here = at(rb, 1000);
  const detour: LatLon[] = [[here[0] + 0.001, here[1]], at(rb, joinM)];
  const joined = withApproach(rb, detour, false, joinM, "route");
  assert.equal(joined.approachTarget, "route");
  assert.equal(joined.joinM, joinM);
  assert.ok(Math.abs(joined.totalM - joined.approachM - (rb.totalM - joinM)) < 30);
  assert.deepEqual(
    joined.stops.map((s) => s.name),
    ["Middle", "End"].filter((n) => (n === "Middle" ? rb.stops[1]!.atM >= joinM - 1 : true)),
  );
  assert.equal(joined.limitSegments.length, 1, "the 50 stretch was ridden");
  assert.equal(joined.limitSegments[0]!.kmh, 90);
  assert.ok(Math.abs(joined.limitSegments[0]!.startM - joined.approachM) < 1);
  assert.equal(joined.zones.length, 1, "the camera at 500 m was passed; the one at 2500 m remains");
  assert.ok(Math.abs(joined.zones[0]!.atM - (joined.approachM + rb.zones[1]!.atM - joinM)) < 1);
  // Riding it: the rider starts on the approach, then is on the rest of the roadbook.
  const nav = createNavigator(joined);
  const s = nav.update(fix(detour[0]!, 40, 0));
  assert.equal(s.phase, "approach");
  assert.ok(s.remainingM < rb.totalM - joinM + joined.approachM + 20);
});

test("a straight-line way back to the route says so", () => {
  const rb = prep();
  const rider: LatLon = [at(rb, 1000)[0] + 0.01, at(rb, 1000)[1]];
  const joined = withApproach(rb, [rider], true, 1200, "route");
  const s = createNavigator(joined).update(fix(rider, 30, 0));
  assert.match(s.instruction.text, /^Straight to the route /);
  assert.equal(s.offRoute, false);
});

test("wrong way: 120 degrees off is the limit, headings across the road are not wrong", () => {
  const wrongAfterThree = (heading: number) => {
    const rb = prep();
    const nav = createNavigator(rb);
    let s = nav.update(fix(at(rb, 500), 30, 0, heading));
    for (let t = 1; t <= 3; t++) s = nav.update(fix(at(rb, 500), 30, t * 1000, heading));
    return s.wrongWay;
  };
  // The line goes east (90).
  assert.equal(wrongAfterThree(90 + 100), false, "100 degrees off");
  assert.equal(wrongAfterThree(90 + 119), false, "119 degrees off");
  assert.equal(wrongAfterThree(90 + 125), true, "125 degrees off");
  assert.equal(wrongAfterThree(90 + 160), true, "160 degrees off");
  assert.equal(wrongAfterThree((90 - 150 + 360) % 360), true, "150 degrees off the other side");
});

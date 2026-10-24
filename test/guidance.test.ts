import assert from "node:assert/strict";
import { test } from "node:test";
import { bearingDeg, haversineM } from "../src/core/geo.ts";
import { instructionAt } from "../src/core/instruction.ts";
import { createNavigator } from "../src/core/navigator.ts";
import { prepareRoadbook } from "../src/core/roadbook.ts";
import { demoStartM, simulatedFix } from "../src/core/simulate.ts";
import { bearingAt, pointAt } from "../src/core/track.ts";
import { drawLine, REF } from "./helpers/path.ts";
import type { LatLon, PreparedRoadbook } from "../src/core/types.ts";

const prep = (line: LatLon[]): PreparedRoadbook =>
  prepareRoadbook({ id: "t", name: "t", description: "", stops: [], line });

// East 1500 m, a left junction (90 degrees, 15 m radius), north 200 m, a right junction, east 1000 m.
const junctions = () =>
  prep(
    drawLine([
      { straight: 1500 },
      { arc: 15, deg: 90, dir: "left" },
      { straight: 200 },
      { arc: 15, deg: 90, dir: "right" },
      { straight: 1000 },
    ]),
  );

test("a junction turn is a maneuver, a long sweep is not", () => {
  const rb = junctions();
  assert.equal(rb.maneuvers.length, 2);
  assert.deepEqual(
    rb.maneuvers.map((m) => m.direction),
    ["left", "right"],
  );
  assert.ok(Math.abs(rb.maneuvers[0]!.atM - 1500 - 12) < 40);
  const sweep = prep(drawLine([{ straight: 500 }, { arc: 100, deg: 90, dir: "left" }, { straight: 500 }]));
  assert.equal(sweep.maneuvers.length, 0);
});

test("a hairpin is a U-turn", () => {
  const rb = prep(drawLine([{ straight: 500 }, { arc: 15, deg: 180, dir: "left" }, { straight: 500 }]));
  assert.equal(rb.maneuvers.length, 1);
  assert.equal(rb.maneuvers[0]!.uturn, true);
  assert.match(instructionAt(rb, rb.maneuvers[0]!.atM - 100).text, /^U-turn in 100 m$/);
});

test("far from a turn the instruction is straight, with the distance", () => {
  const rb = junctions();
  const at = rb.maneuvers[0]!.atM;
  const i = instructionAt(rb, at - 1240);
  assert.equal(i.kind, "straight");
  assert.equal(i.text, "Straight 1.2 km");
  assert.equal(i.then, null);
});

test("close to a turn it names the turn, and a close follower becomes 'then'", () => {
  const rb = junctions();
  const i = instructionAt(rb, rb.maneuvers[0]!.atM - 150);
  assert.equal(i.kind, "left");
  assert.equal(i.text, "Left in 150 m");
  assert.equal(i.then, "right");
  assert.equal(instructionAt(rb, rb.maneuvers[0]!.atM - 499).kind, "left");
  assert.equal(instructionAt(rb, rb.maneuvers[0]!.atM - 501).kind, "straight");
});

test("a maneuver is passed 15 m after its middle", () => {
  const rb = junctions();
  const m = rb.maneuvers[0]!;
  assert.equal(instructionAt(rb, m.atM + 10).kind, "left");
  const after = instructionAt(rb, m.atM + 16);
  assert.equal(after.kind, "right");
});

test("after the last turn: straight to the finish, then finish", () => {
  const rb = junctions();
  const last = rb.maneuvers[1]!.atM;
  assert.match(instructionAt(rb, last + 20).text, /^Straight (1\.0|980|990|970) ?(km| m)$/);
  const near = instructionAt(rb, rb.totalM - 300);
  assert.equal(near.kind, "finish");
  assert.equal(near.text, "Finish in 300 m");
});

test("bearing: east is 90, north is 0, along the line", () => {
  assert.ok(Math.abs(bearingDeg(REF, [REF[0], REF[1] + 0.01]) - 90) < 0.5);
  assert.ok(Math.abs(bearingDeg(REF, [REF[0] + 0.01, REF[1]]) - 0) < 0.5);
  const rb = junctions();
  assert.ok(Math.abs(bearingAt(rb.roadbook.line, rb.cumulativeM, 500) - 90) < 1);
  const afterLeft = bearingAt(rb.roadbook.line, rb.cumulativeM, rb.maneuvers[0]!.atM + 100);
  assert.ok(Math.abs(afterLeft - 0) < 3 || Math.abs(afterLeft - 360) < 3, `bearing ${afterLeft}`);
});

test("the navigator reports the instruction, the bearing and the rider placed on the line", () => {
  const rb = junctions();
  const nav = createNavigator(rb);
  const s = nav.update(simulatedFix(rb, 400, 20, 1000));
  assert.equal(s.instruction.kind, "straight");
  assert.ok(Math.abs(s.bearingDeg - 90) < 1);
  assert.ok(haversineM(s.position, pointAt(rb.roadbook.line, rb.cumulativeM, 400)) < 2);
});

test("while off route the position is the fix itself", () => {
  const rb = junctions();
  const nav = createNavigator(rb);
  const base = pointAt(rb.roadbook.line, rb.cumulativeM, 400);
  const far: LatLon = [base[0] + 0.001, base[1]];
  const fix = (time: number) => ({ lat: far[0], lon: far[1], speedMps: 10, accuracyM: 5, time });
  nav.update(fix(0));
  nav.update(fix(1000));
  const s = nav.update(fix(2000));
  assert.equal(s.offRoute, true);
  assert.deepEqual(s.position, far);
});

test("the demo starts 700 m before the first dangerous corner and rides on the line", () => {
  const rb = prep(drawLine([{ straight: 2000 }, { arc: 15, deg: 180, dir: "left" }, { straight: 500 }]));
  const first = rb.corners.find((c) => c.severity !== "bend")!;
  assert.ok(Math.abs(demoStartM(rb) - (first.startM - 700)) < 1);
  const straight = prep(drawLine([{ straight: 1000 }]));
  assert.equal(demoStartM(straight), 0);
  const fix = simulatedFix(rb, 100, 27.8, 5);
  assert.equal(fix.speedMps, 27.8);
  assert.ok(createNavigator(rb).update(fix).distanceToLineM < 1);
});

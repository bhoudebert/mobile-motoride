import assert from "node:assert/strict";
import { test } from "node:test";
import { withApproach } from "../src/core/approach.ts";
import { createNavigator } from "../src/core/navigator.ts";
import { parseRoadbookFile } from "../src/core/roadbookFile.ts";
import { prepareRoadbook } from "../src/core/roadbook.ts";
import { joinOptions, planSkip, startChoices } from "../src/core/skip.ts";
import { pointAt } from "../src/core/track.ts";
import { drawLine, fixAt } from "./helpers/path.ts";
import { roadbookFile } from "./helpers/polyline.ts";
import type { LatLon, PreparedRoadbook } from "../src/core/types.ts";

// 4 km east, a point every 5 m. Stops: Start 0, "1." 800 m, a café 1.5 km, "2." 2 km, "3." 3 km, Finish 4 km.
const line = drawLine([{ straight: 4000 }]);
const stop = (index: number, name: string, kind?: string) => ({
  lat: line[index]![0],
  lon: line[index]![1],
  name,
  ...(kind ? { kind } : {}),
});
const STOPS = [
  stop(0, "Start", "waypoint"),
  stop(160, "1. Mont", "waypoint"),
  stop(300, "pause: Café", "stop"),
  stop(400, "2. Cassel"),
  stop(600, "3. Bailleul", "waypoint"),
  stop(800, "Finish", "waypoint"),
];
const rb = (): PreparedRoadbook => prepareRoadbook(parseRoadbookFile(roadbookFile(line, { stops: STOPS })));
const at = (r: PreparedRoadbook, m: number): LatLon => pointAt(r.roadbook.line, r.cumulativeM, m);

test("a stop kind is read, and a stop without one stays a route point", () => {
  const read = parseRoadbookFile(roadbookFile(line, { stops: STOPS }));
  assert.deepEqual(
    read.stops.map((s) => s.kind),
    ["waypoint", "waypoint", "stop", undefined, "waypoint", "waypoint"],
  );
  const odd = parseRoadbookFile(roadbookFile(line, { stops: [{ lat: 50, lon: 3, name: "x", kind: "banana" }] }));
  assert.equal(odd.stops[0]!.kind, undefined);
});

test("the skip on offer drops the next route point for the one after, and ignores service stops", () => {
  const r = rb();
  const plan = planSkip(r, 100)!;
  assert.equal(plan.skipped.name, "1. Mont");
  assert.equal(plan.target.name, "2. Cassel", "the café between is not a point to go to");
  assert.ok(Math.abs(plan.joinM - 2000) < 10);
  assert.equal(planSkip(r, 1000)!.skipped.name, "2. Cassel", "the café is passed over, it never counts as next");
  assert.equal(planSkip(r, 1000)!.target.name, "3. Bailleul");
});

test("at the start the next point is the first one after Start", () => {
  const plan = planSkip(rb(), 0)!;
  assert.equal(plan.skipped.name, "1. Mont");
});

test("the last point cannot be skipped: nothing is offered for the finish, or after it", () => {
  const r = rb();
  assert.equal(planSkip(r, 2500)!.target.name, "Finish", "heading for the last but one, the finish is a target");
  assert.equal(planSkip(r, 3500), null, "heading for the finish");
  assert.equal(planSkip(r, 4000), null);
});

test("a roadbook with one route point or none offers nothing", () => {
  const few = prepareRoadbook(
    parseRoadbookFile(roadbookFile(line, { stops: [stop(0, "Start"), stop(800, "Finish")] })),
  );
  assert.equal(planSkip(few, 0), null);
  assert.equal(planSkip(prepareRoadbook(parseRoadbookFile(roadbookFile(line))), 0), null);
});

test("a skip is a join at the target: what lay before it is gone, and it is named", () => {
  const r = rb();
  const plan = planSkip(r, 100)!;
  const here = at(r, 100);
  const detour: LatLon[] = [[here[0] + 0.001, here[1]], at(r, plan.joinM)];
  const joined = withApproach(r, detour, false, plan.joinM, "route", plan.target.name);
  assert.equal(joined.approachName, "2. Cassel");
  assert.deepEqual(
    joined.stops.map((s) => s.name),
    ["2. Cassel", "3. Bailleul", "Finish"],
    "the skipped point and the café on the abandoned stretch are gone",
  );
  assert.ok(Math.abs(joined.stops[0]!.atM - joined.approachM) < 1);
  // The rider is on the way to the target; the next route point is the target itself.
  const next = planSkip(joined, 0)!;
  assert.equal(next.skipped.name, "2. Cassel");
  assert.equal(next.target.name, "3. Bailleul");
});

test("skipping again joins at the right place on the whole roadbook", () => {
  const r = rb();
  const first = planSkip(r, 100)!;
  const joined = withApproach(r, [at(r, 100)], true, first.joinM, "route", first.target.name);
  const second = planSkip(joined, 0)!;
  assert.equal(second.target.name, "3. Bailleul");
  const expected = r.stops.find((s) => s.name === "3. Bailleul")!.atM;
  assert.ok(Math.abs(second.joinM - expected) < 1, `joinM ${second.joinM} vs ${expected}`);
  const again = withApproach(r, [at(r, 120)], true, second.joinM, "route", second.target.name);
  assert.deepEqual(
    again.stops.map((s) => s.name),
    ["3. Bailleul", "Finish"],
  );
  assert.equal(planSkip(again, 0)!.target.name, "Finish");
  assert.equal(planSkip(again, again.approachM + 1500), null);
});

test("on the approach to the start, skipping Start goes to the first point", () => {
  const r = rb();
  const far: LatLon[] = [[at(r, 0)[0] + 0.02, at(r, 0)[1]]];
  const toStart = withApproach(r, far, true);
  const plan = planSkip(toStart, 10)!;
  assert.equal(plan.skipped.name, "Start");
  assert.equal(plan.target.name, "1. Mont");
  assert.ok(Math.abs(plan.joinM - r.stops[1]!.atM) < 1);
});

test("a skipped ride is ridden like any other: instructions, bearing and remaining distance hold", () => {
  const r = rb();
  const plan = planSkip(r, 100)!;
  const joined = withApproach(r, [at(r, 100)], true, plan.joinM, "route", plan.target.name);
  const nav = createNavigator(joined);
  const s = nav.update(fixAt(at(r, 100), 0, 0));
  assert.equal(s.phase, "approach");
  assert.ok(s.remainingM < r.totalM - plan.joinM + joined.approachM + 20);
  assert.ok(s.remainingM > r.totalM - plan.joinM - 5);
  assert.equal(s.nextStop?.name, "2. Cassel");
});

test("the points to start from are the route points in riding order, not the service stops", () => {
  const r = rb();
  const choices = startChoices(r);
  assert.deepEqual(
    choices.map((c) => c.name),
    ["Start", "1. Mont", "2. Cassel", "3. Bailleul", "Finish"],
  );
  assert.deepEqual(
    choices.map((c) => Math.round(c.atM / 100)),
    [0, 8, 20, 30, 40],
  );
  assert.deepEqual(startChoices(prepareRoadbook(parseRoadbookFile(roadbookFile(line)))), []);
});

test("a chosen start point drops every point before it, and the straight line is named after it", () => {
  const r = rb();
  const target = r.stops.find((s) => s.name === "3. Bailleul")!;
  const rider: LatLon = [at(r, 500)[0] + 0.01, at(r, 500)[1]];
  const joined = withApproach(r, [rider], true, target.atM, "route", target.name);
  assert.deepEqual(
    joined.stops.map((s) => s.name),
    ["3. Bailleul", "Finish"],
  );
  const s = createNavigator(joined).update(fixAt(rider, 0, 0));
  assert.match(s.instruction.text, /^Straight to 3\. Bailleul /);
  assert.equal(planSkip(joined, 0)?.target.name, "Finish");
});

const ahead = (r: PreparedRoadbook, m: number, metres = 300): LatLon => [at(r, m)[0] + metres / 111_000, at(r, m)[1]];

test("joining: the nearest next route point, what it skips, and how far", () => {
  const r = rb();
  const options = joinOptions(r, ahead(r, 1200))!; // beside the road between 1. Mont (800 m) and 2. Cassel (2 km)
  assert.equal(options.nearest.name, "2. Cassel");
  assert.deepEqual(options.skipped, ["Start", "1. Mont"]);
  assert.equal(options.first.name, "Start");
  assert.ok(options.nearest.distanceM > 700 && options.nearest.distanceM < 900, `${options.nearest.distanceM}`);
  assert.ok(options.first.distanceM > 1100 && options.first.distanceM < 1400);
});

test("joining a little past the start: the nearest next point is the one after it, and the start is skipped", () => {
  const r = rb();
  const options = joinOptions(r, ahead(r, 100))!;
  assert.equal(options.nearest.name, "1. Mont");
  assert.deepEqual(options.skipped, ["Start"]);
});

test("joining at or behind the start: the start is the nearest next point and nothing is skipped", () => {
  const r = rb();
  const behind: LatLon = [at(r, 0)[0], at(r, 0)[1] - 0.03];
  const options = joinOptions(r, behind)!;
  assert.equal(options.nearest.name, "Start");
  assert.deepEqual(options.skipped, []);
  assert.equal(options.first.name, "Start");
  assert.equal(joinOptions(r, ahead(r, 5))!.nearest.name, "Start", "5 m past it is not past it yet");
});

test("joining past the last point: the last point is the one to go to", () => {
  const r = rb();
  const beyond: LatLon = [at(r, 4000)[0], at(r, 4000)[1] + 0.03];
  const options = joinOptions(r, beyond)!;
  assert.equal(options.nearest.name, "Finish");
  assert.deepEqual(options.skipped, ["Start", "1. Mont", "2. Cassel", "3. Bailleul"]);
});

test("service stops are neither offered nor counted as skipped", () => {
  const r = rb();
  const options = joinOptions(r, ahead(r, 1700))!;
  assert.ok(!options.skipped.includes("pause: Café"));
  assert.notEqual(options.nearest.name, "pause: Café");
});

test("no route points, no join", () => {
  assert.equal(joinOptions(prepareRoadbook(parseRoadbookFile(roadbookFile(line))), [50, 3]), null);
});

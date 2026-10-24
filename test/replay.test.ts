import assert from "node:assert/strict";
import { test } from "node:test";
import { needsApproach } from "../src/core/approach.ts";
import { angleDiff } from "../src/core/heading.ts";
import { createNavigator } from "../src/core/navigator.ts";
import {
  parseReplayLink,
  REPLAY_SCENARIOS,
  replayAsks,
  replayFixAt,
  replayPhases,
  replayStartIndex,
} from "../src/core/replay.ts";
import { parseRoadbookFile } from "../src/core/roadbookFile.ts";
import { prepareRoadbook } from "../src/core/roadbook.ts";
import { joinOptions, planSkip } from "../src/core/skip.ts";
import { snapToLine } from "../src/core/track.ts";
import { drawLine } from "./helpers/path.ts";
import { roadbookFile } from "./helpers/polyline.ts";
import type { PreparedRoadbook } from "../src/core/types.ts";

const line = drawLine([{ straight: 4000 }]);
const stop = (i: number, name: string) => ({ lat: line[i]![0], lon: line[i]![1], name, kind: "waypoint" });
const rich = (cameras = true): PreparedRoadbook =>
  prepareRoadbook(
    parseRoadbookFile(
      roadbookFile(line, {
        stops: [stop(0, "Start"), stop(160, "1"), stop(400, "2"), stop(800, "Finish")],
        limits: [{ from: 0, to: 800, kmh: 80, posted: true }],
        cameras: cameras ? [{ lat: line[400]![0], lon: line[400]![1], kmh: 70, bearing: null, direction: null }] : [],
      }),
    ),
  );

test("the link names a scenario, and only a known one", () => {
  for (const s of REPLAY_SCENARIOS) assert.equal(parseReplayLink(`mobilemotoride://replay/${s}`), s);
  assert.equal(parseReplayLink("mobilemotoride://replay/approach/"), "approach");
  assert.equal(parseReplayLink("mobilemotoride://replay/skip?x=1"), "skip");
  assert.equal(parseReplayLink("mobilemotoride://replay/teleport"), null);
  assert.equal(parseReplayLink("mobilemotoride://other/approach"), null);
  assert.equal(parseReplayLink("https://replay/approach"), null);
  assert.equal(parseReplayLink(null), null);
  assert.equal(parseReplayLink(undefined), null);
  assert.equal(parseReplayLink(""), null);
});

test("every scenario plays on a roadbook that has what it needs, and holds its last position", () => {
  const rb = rich();
  for (const s of REPLAY_SCENARIOS) {
    const phases = replayPhases(rb, s);
    assert.ok(phases && phases.length > 0, s);
    const last = phases!.at(-1)!;
    assert.ok(last.seconds >= 3600, `${s} holds its last position`);
    const later = replayFixAt(phases!, 100_000, 5);
    assert.deepEqual([later.lat, later.lon], last.at);
  }
});

test("a scenario the roadbook cannot play does nothing", () => {
  assert.equal(replayPhases(rich(false), "zone"), null, "no cameras, no zone");
  const bare = prepareRoadbook(parseRoadbookFile(roadbookFile(line)));
  assert.equal(replayPhases(bare, "skip"), null, "nothing to skip");
});

test("approach: parked 3 km from the start, needing an approach", () => {
  const rb = rich();
  const [p] = replayPhases(rb, "approach")!;
  assert.ok(needsApproach(rb, p!.at));
  assert.equal(p!.speedMps, 0);
});

test("offroute: on the line for three seconds, then 250 m off it", () => {
  const rb = rich();
  const phases = replayPhases(rb, "offroute")!;
  assert.equal(phases.length, 2);
  const onLine = snapToLine(rb.roadbook.line, rb.cumulativeM, phases[0]!.at).offsetM;
  const off = snapToLine(rb.roadbook.line, rb.cumulativeM, phases[1]!.at).offsetM;
  assert.ok(onLine < 2);
  assert.ok(off > 200 && off < 300, `off by ${off}`);
  assert.deepEqual(replayFixAt(phases, 2, 0).lat, phases[0]!.at[0]);
  assert.deepEqual(replayFixAt(phases, 3, 0).lat, phases[1]!.at[0]);
});

test("wrongway rides against the line, skip is parked with a skip on offer, zone is 550 m short of the zone", () => {
  const rb = rich();
  const wrong = replayPhases(rb, "wrongway")![0]!;
  assert.ok(wrong.speedMps * 3.6 >= 10);
  assert.ok(angleDiff(wrong.headingDeg!, 90) > 150, "the line goes east");
  const skip = replayPhases(rb, "skip")![0]!;
  assert.equal(skip.speedMps, 0);
  assert.ok(planSkip(rb, 100));
  const zone = replayPhases(rb, "zone")![0]!;
  const progress = snapToLine(rb.roadbook.line, rb.cumulativeM, zone.at).progressM;
  assert.ok(Math.abs(rb.zones[0]!.atM - progress - 550) < 5);
});

test("a roadbook shorter than the scripts still plays them on the line", () => {
  const short = drawLine([{ straight: 300 }]);
  const rb = prepareRoadbook(parseRoadbookFile(roadbookFile(short)));
  const p = replayPhases(rb, "ride")![0]!;
  assert.ok(snapToLine(rb.roadbook.line, rb.cumulativeM, p.at).offsetM < 2);
});

test("played through the navigator, the scenarios give what the smoke test will look for", () => {
  const rb = rich();
  const run = (scenario: (typeof REPLAY_SCENARIOS)[number], seconds: number) => {
    const phases = replayPhases(rb, scenario)!;
    const nav = createNavigator(rb);
    let state = nav.update(replayFixAt(phases, 0, 0));
    for (let t = 1; t <= seconds; t++) state = nav.update(replayFixAt(phases, t, t * 1000));
    return state;
  };
  assert.equal(run("wrongway", 5).wrongWay, true);
  assert.equal(run("offroute", 8).offRoute, true);
  assert.ok(run("offroute", 8).rejoin);
  assert.equal(run("skip", 3).offRoute, false);
  const zonePhases = replayPhases(rb, "zone")!;
  const first = createNavigator(rb).update(replayFixAt(zonePhases, 0, 0));
  assert.match(first.zoneWarning?.text ?? "", /^Speed camera, 550 metres$/);
  assert.equal(run("ride", 3).speedLimit.kmh, 80);
});

test("startfrom is the approach with the third route point as the place to start from", () => {
  const rb = rich();
  assert.deepEqual(replayPhases(rb, "startfrom"), replayPhases(rb, "approach"));
  assert.equal(replayStartIndex("startfrom"), 2);
  assert.equal(replayStartIndex("approach"), null);
  assert.equal(replayStartIndex("ride"), null);
  const few = prepareRoadbook(
    parseRoadbookFile(roadbookFile(line, { stops: [stop(0, "Start"), stop(800, "Finish")] })),
  );
  assert.equal(replayPhases(few, "startfrom"), null);
});

test("join: beside the road between the second and third points, so the third is the nearest next, and it asks", () => {
  const rb = rich();
  const [p] = replayPhases(rb, "join")!;
  assert.ok(needsApproach(rb, p!.at));
  assert.equal(joinOptions(rb, p!.at)!.nearest.name, "2");
  assert.equal(replayAsks("join"), true);
  for (const s of REPLAY_SCENARIOS.filter((x) => x !== "join")) assert.equal(replayAsks(s), false, s);
  const few = prepareRoadbook(
    parseRoadbookFile(roadbookFile(line, { stops: [stop(0, "Start"), stop(800, "Finish")] })),
  );
  assert.equal(replayPhases(few, "join"), null);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { withApproach } from "../src/core/approach.ts";
import {
  JUNCTION_PASSED_M,
  junctionAhead,
  junctionHeadline,
  junctionSpeech,
  junctionText,
  lanesPhrase,
  ordinal,
  ordinalWord,
} from "../src/core/junctions.ts";
import { createNavigator } from "../src/core/navigator.ts";
import { parseRoadbookFile } from "../src/core/roadbookFile.ts";
import { prepareRoadbook } from "../src/core/roadbook.ts";
import { pointAt } from "../src/core/track.ts";
import { drawLine, fixAt } from "./helpers/path.ts";
import { roadbookFile } from "./helpers/polyline.ts";
import type { LatLon, PreparedRoadbook } from "../src/core/types.ts";

const straight = () => drawLine([{ straight: 4000 }]); // a point every 5 m
const roundabout = (extra: Record<string, unknown> = {}) => ({
  kind: "roundabout",
  at: 400, // 2000 m
  to: 412,
  exits: [-80, 15, 100],
  take: 1, // the exit at 15 degrees: the second met by right-hand traffic (100, 15, then -80)
  ...extra,
});
const lanes = (extra: Record<string, unknown> = {}) => ({
  kind: "lanes",
  at: 400,
  count: 4,
  use: [0, 1],
  ...extra,
});
const prep = (junctions: unknown[], line = straight()): PreparedRoadbook =>
  prepareRoadbook(parseRoadbookFile(roadbookFile(line, { junctions })));
const at = (rb: PreparedRoadbook, m: number): LatLon => pointAt(rb.roadbook.line, rb.cumulativeM, m);

test("a roundabout and a lane guide are read and placed along the line", () => {
  const rb = prep([roundabout(), lanes({ at: 600, turns: ["left", "through", "through", "right"] })]);
  assert.equal(rb.junctions.length, 2);
  const [r, l] = rb.junctions;
  assert.equal(r!.kind, "roundabout");
  assert.ok(Math.abs(r!.atM - 2000) < 1 && Math.abs(r!.endM - 2060) < 1);
  assert.equal(l!.kind, "lanes");
  assert.ok(Math.abs(l!.atM - 3000) < 1 && l!.endM === l!.atM);
  assert.deepEqual(l!.kind === "lanes" && l!.turns, ["left", "through", "through", "right"]);
});

test("exits are numbered as traffic meets them: from the right where it keeps right, from the left where it keeps left", () => {
  const exits = [-80, 15, 100]; // left, ahead and a little right, right
  const first = (traffic: string | undefined) => {
    const r = prep([roundabout({ exits, take: 2, ...(traffic ? { traffic } : {}) })]).junctions[0]!;
    return r.kind === "roundabout" ? r : null;
  };
  // Right-hand traffic circles counterclockwise: the road on the right is the first exit, the one on the left the last.
  assert.deepEqual(first(undefined)!.exits, [100, 15, 280]);
  assert.equal(first("right")!.exit, 1); // the exit to take is the one at 100 degrees, the first on the right
  // Left-hand traffic circles clockwise: the other way round.
  assert.deepEqual(first("left")!.exits, [280, 15, 100]);
  assert.equal(first("left")!.exit, 3);
});

test("the exit to take is numbered whatever order the file lists the exits in", () => {
  for (const exits of [
    [100, 15, -80],
    [-80, 100, 15],
    [15, -80, 100],
  ]) {
    const take = exits.indexOf(15);
    const r = prep([roundabout({ exits, take })]).junctions[0]!;
    assert.equal(r.kind === "roundabout" && r.exit, 2);
    assert.deepEqual(r.kind === "roundabout" && r.exits, [100, 15, 280]);
  }
});

test("an exit straight back is the last one, a whole turn round", () => {
  const r = prep([roundabout({ exits: [180, 90, -90], take: 0 })]).junctions[0]!;
  assert.equal(r.kind === "roundabout" && r.exit, 3);
  assert.deepEqual(r.kind === "roundabout" && r.exits, [90, 270, 180]);
});

test("exit bearings are normalised to 0..359 and lanes to use are sorted", () => {
  const rb = prep([roundabout({ exits: [-80, 15, 460] }), lanes({ at: 600, use: [1, 0] })]);
  const [r, l] = rb.junctions;
  assert.deepEqual(r!.kind === "roundabout" && r!.exits, [100, 15, 280]);
  assert.deepEqual(l!.kind === "lanes" && l!.use, [0, 1]);
});

test("junctions that make no sense are dropped, the rest of the file is kept", () => {
  const bad = [
    roundabout({ to: 400 }), // leaves where it enters
    roundabout({ to: 99999 }), // past the line
    roundabout({ exits: [90] }), // one exit
    roundabout({ exits: [0, 1, 2, 3, 4, 5, 6, 7, 8] }), // nine
    roundabout({ take: 3 }), // a fourth of three
    roundabout({ take: -1 }),
    roundabout({ exits: [10, "x"] }),
    lanes({ count: 1, use: [0] }),
    lanes({ use: [] }),
    lanes({ use: [0, 1, 2, 3] }), // all of them says nothing
    lanes({ use: [4] }),
    lanes({ use: [1, 1] }),
    lanes({ at: -1 }),
    { kind: "tram", at: 10 },
    "nonsense",
    null,
  ];
  const rb = prep([...bad, lanes({ at: 700 })]);
  assert.equal(rb.junctions.length, 1);
  assert.equal(rb.junctions[0]!.kind, "lanes");
});

test("turns are kept only when there is one per lane and all are known", () => {
  assert.equal(prep([lanes({ turns: ["left", "through"] })]).junctions[0]!.kind === "lanes", true);
  const j = prep([lanes({ turns: ["left", "through"] })]).junctions[0]!;
  assert.equal(j.kind === "lanes" && j.turns, undefined);
  const k = prep([lanes({ turns: ["left", "through", "through", "teleport"] })]).junctions[0]!;
  assert.equal(k.kind === "lanes" && k.turns, undefined);
});

test("a roadbook without junctions has none", () => {
  assert.deepEqual(prep([]).junctions, []);
  assert.deepEqual(prepareRoadbook(parseRoadbookFile(roadbookFile(straight()))).junctions, []);
});

test("ordinals: 1st 2nd 3rd 4th, 11th 12th 13th, 21st 22nd", () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal), [
    "1st",
    "2nd",
    "3rd",
    "4th",
    "11th",
    "12th",
    "13th",
    "21st",
    "22nd",
    "23rd",
    "101st",
    "111th",
  ]);
  assert.deepEqual([1, 2, 12, 13].map(ordinalWord), ["first", "second", "twelfth", "13th"]);
});

test("lane phrases say left, right, a single lane or the lanes in between", () => {
  const phrase = (count: number, use: number[]) => lanesPhrase({ kind: "lanes", at: 0, count, use, atM: 0, endM: 0 });
  assert.equal(phrase(4, [0, 1]), "Keep left, lanes 1 and 2");
  assert.equal(phrase(4, [2, 3]), "Keep right, lanes 3 and 4");
  assert.equal(phrase(5, [0, 1, 2]), "Keep left, lanes 1, 2 and 3");
  assert.equal(phrase(4, [1, 2]), "Stay in lanes 2 and 3 of 4");
  assert.equal(phrase(4, [0, 2]), "Stay in lanes 1 and 3 of 4");
  assert.equal(phrase(3, [0]), "Keep in the left lane");
  assert.equal(phrase(3, [2]), "Keep in the right lane");
  assert.equal(phrase(3, [1]), "Keep in lane 2 of 3");
});

test("the words and the speech of a roundabout name the exit", () => {
  const j = prep([roundabout({ take: 0 })]).junctions[0]!;
  assert.equal(junctionText(j), "Roundabout, 3rd exit");
  assert.equal(junctionSpeech(j), "At the roundabout, take the third exit");
});

test("a junction is ahead from 300 m (roundabout) or 600 m (lanes) until just past it", () => {
  const rb = prep([roundabout()]); // at 2000 m, out at 2060 m
  assert.equal(junctionAhead(rb.junctions, 1690), null);
  assert.ok(Math.abs(junctionAhead(rb.junctions, 1700)!.distanceM - 300) < 1);
  assert.equal(junctionAhead(rb.junctions, 2030)!.distanceM, 0); // inside
  assert.ok(junctionAhead(rb.junctions, 2060 + JUNCTION_PASSED_M));
  assert.equal(junctionAhead(rb.junctions, 2061 + JUNCTION_PASSED_M), null);
  const l = prep([lanes()]);
  assert.equal(junctionAhead(l.junctions, 1390), null);
  assert.ok(junctionAhead(l.junctions, 1400));
  assert.equal(junctionAhead(l.junctions, 2031), null);
});

test("a roundabout is guided before lanes that are due at the same time, the lanes once it is behind", () => {
  const rb = prep([roundabout(), lanes({ at: 440 })]); // ring at 2000 m, lanes at 2200 m
  assert.equal(junctionAhead(rb.junctions, 1750)!.junction.kind, "roundabout");
  assert.equal(junctionAhead(rb.junctions, 2060 + JUNCTION_PASSED_M)!.junction.kind, "roundabout");
  assert.equal(junctionAhead(rb.junctions, 2100)!.junction.kind, "lanes");
  assert.equal(junctionAhead(rb.junctions, 2300), null);
});

test("the instruction names the exit with its distance, then goes back to the road", () => {
  const rb = prep([roundabout()]);
  const nav = createNavigator(rb);
  const ride = (m: number, t: number) => nav.update(fixAt(at(rb, m), 50, t));
  assert.match(ride(1000, 0).instruction.text, /^Straight /);
  const near = ride(1750, 1000);
  assert.equal(near.instruction.kind, "roundabout");
  assert.equal(near.instruction.text, "Roundabout, 2nd exit");
  assert.ok(Math.abs(near.instruction.distanceM - 250) < 5);
  assert.equal(near.junction!.junction.kind, "roundabout");
  assert.equal(ride(2040, 2000).instruction.distanceM, 0);
  const after = ride(2200, 3000);
  assert.equal(after.junction, null);
  assert.match(after.instruction.text, /^Straight /);
});

test("the lane guide shows from 600 m, in words, with its distance", () => {
  const rb = prep([lanes()]);
  const nav = createNavigator(rb);
  const s = nav.update(fixAt(at(rb, 1500), 80, 0));
  assert.equal(s.instruction.kind, "lanes");
  assert.equal(s.instruction.text, "Keep left, lanes 1 and 2");
  assert.ok(Math.abs(s.instruction.distanceM - 500) < 5);
});

test("a junction is spoken once per pass, and again on the next pass of a loop", () => {
  const rb = prep([roundabout()]);
  const nav = createNavigator(rb);
  const spoken: string[] = [];
  for (let m = 1000; m < 2400; m += 20) {
    const w = nav.update(fixAt(at(rb, m), 60, m)).junctionWarning;
    if (w) spoken.push(w.text);
  }
  assert.deepEqual(spoken, ["At the roundabout, take the second exit"]);
  // Ridden again (a loop): the same junction is announced again.
  for (let m = 1000; m < 2400; m += 20) {
    const w = nav.update(fixAt(at(rb, m), 60, 100_000 + m)).junctionWarning;
    if (w) spoken.push(w.text);
  }
  assert.equal(spoken.length, 2);
});

test("a corner warning on the same fix goes first, the junction follows on the next fix", () => {
  const line = drawLine([{ straight: 1000 }, { arc: 20, deg: 90, dir: "left" }, { straight: 2000 }]);
  const base = prepareRoadbook(parseRoadbookFile(roadbookFile(line)));
  const corner = base.corners.find((c) => c.severity !== "bend")!;
  const index = base.cumulativeM.findIndex((d) => d >= corner.endM + 60);
  const rb = prepareRoadbook(
    parseRoadbookFile(roadbookFile(line, { junctions: [roundabout({ at: index, to: index + 12 })] })),
  );
  const nav = createNavigator(rb);
  const first = nav.update(fixAt(at(rb, corner.startM - 140), 60, 0));
  assert.ok(first.warning, "the corner is warned");
  assert.equal(first.junctionWarning, null);
  const next = nav.update(fixAt(at(rb, corner.startM - 130), 60, 1000));
  assert.equal(next.junctionWarning?.text, "At the roundabout, take the second exit");
});

test("no junction while off route, in the approach, or going the wrong way", () => {
  const line = straight();
  const rb = prep([roundabout()], line);
  // Off route.
  const off = createNavigator(rb);
  off.update(fixAt(at(rb, 1000), 60, 0));
  let last = off.update(fixAt([at(rb, 1800)[0] + 0.01, at(rb, 1800)[1]], 60, 1000));
  for (let t = 2; t < 6; t++) last = off.update(fixAt([at(rb, 1800)[0] + 0.01, at(rb, 1800)[1]], 60, t * 1000));
  assert.equal(last.offRoute, true);
  assert.equal(last.junction, null);
  assert.equal(last.junctionWarning, null);
  // The approach: the junction moves along with the line but nothing is guided while approaching.
  const approach: LatLon[] = [[at(rb, 0)[0] + 0.02, at(rb, 0)[1]], at(rb, 0)];
  const withLead = withApproach(rb, approach, true);
  const lead = createNavigator(withLead);
  const s = lead.update(fixAt(approach[0]!, 60, 0));
  assert.equal(s.phase, "approach");
  assert.equal(s.junction, null);
  // The wrong way: heading against the line for a few fixes.
  const wrong = createNavigator(rb);
  let w = wrong.update({ ...fixAt(at(rb, 1800), 60, 0), headingDeg: 270 });
  for (let t = 1; t < 5; t++) w = wrong.update({ ...fixAt(at(rb, 1800), 60, t * 1000), headingDeg: 270 });
  assert.equal(w.wrongWay, true);
  assert.equal(w.junction, null);
});

test("a junction keeps its place behind an approach and drops out of the part already ridden", () => {
  const rb = prep([roundabout({ at: 200, to: 212 }), roundabout({ at: 600, to: 612 })]); // 1000 m and 3000 m
  const lead: LatLon[] = [[at(rb, 0)[0] + 0.01, at(rb, 0)[1]]];
  const all = withApproach(rb, lead, true);
  assert.equal(all.junctions.length, 2);
  assert.ok(Math.abs(all.junctions[0]!.atM - (all.approachM + 1000)) < 2);
  const later = withApproach(rb, lead, true, 1500, "route");
  assert.equal(later.junctions.length, 1);
  assert.ok(Math.abs(later.junctions[0]!.atM - (later.approachM + 1500)) < 2);
});

test("the bar's short form: the exit over Roundabout, the side over the lanes", () => {
  const lane = (count: number, use: number[]) =>
    junctionHeadline({ kind: "lanes", at: 0, count, use, atM: 0, endM: 0 });
  assert.deepEqual(junctionHeadline(prep([roundabout({ take: 0 })]).junctions[0]!), {
    headline: "3rd exit",
    detail: "Roundabout",
  });
  assert.deepEqual(lane(4, [0, 1]), { headline: "Keep left", detail: "Lanes 1 and 2" });
  assert.deepEqual(lane(4, [2, 3]), { headline: "Keep right", detail: "Lanes 3 and 4" });
  assert.deepEqual(lane(4, [1, 2]), { headline: "Lanes 2 and 3", detail: "of 4" });
  assert.deepEqual(lane(3, [0]), { headline: "Left lane", detail: "Lane 1 of 3" });
  assert.deepEqual(lane(3, [2]), { headline: "Right lane", detail: "Lane 3 of 3" });
  assert.deepEqual(lane(3, [1]), { headline: "Lane 2", detail: "of 3" });
  // None is longer than the bar can show beside the settings button.
  for (const j of [lane(4, [0, 1]), lane(8, [3, 4, 5]), lane(5, [0, 2])]) assert.ok(j.headline.length <= 15);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { createNavigator } from "../src/core/navigator.ts";
import { parseRoadbookFile } from "../src/core/roadbookFile.ts";
import { prepareRoadbook } from "../src/core/roadbook.ts";
import { pointAt } from "../src/core/track.ts";
import { DEFAULT_VOICE, isVoiceMode, nextVoice, speaks, VOICE_MODES, type VoiceKind } from "../src/core/voice.ts";
import { drawLine, fixAt } from "./helpers/path.ts";
import { roadbookFile } from "./helpers/polyline.ts";
import type { Fix, LatLon, PreparedRoadbook } from "../src/core/types.ts";

const KINDS: VoiceKind[] = ["corner", "zone", "status", "junction", "turn", "skip", "fuel", "weather", "crash"];

test("Full says everything, Alerts only corners, danger zones, a long stretch without fuel and bad weather, Off nothing", () => {
  assert.deepEqual(
    KINDS.filter((k) => speaks("full", k)),
    KINDS,
  );
  assert.deepEqual(
    KINDS.filter((k) => speaks("alerts", k)),
    ["corner", "zone", "fuel", "weather", "crash"],
  );
  assert.deepEqual(
    KINDS.filter((k) => speaks("off", k)),
    [],
  );
});

test("the modes come in the order Full, Alerts, Off, and round again; Full is the default", () => {
  assert.deepEqual(VOICE_MODES, ["full", "alerts", "off"]);
  assert.equal(DEFAULT_VOICE, "full");
  assert.equal(nextVoice("full"), "alerts");
  assert.equal(nextVoice("alerts"), "off");
  assert.equal(nextVoice("off"), "full");
  assert.equal(isVoiceMode("alerts"), true);
  assert.equal(isVoiceMode("loud"), false);
  assert.equal(isVoiceMode(null), false);
});

// 2 km east, a left turn at 2 km (a radius of 30 m), 2 km north: a turn well away from anything else.
const turning = (): PreparedRoadbook =>
  prepareRoadbook(
    parseRoadbookFile(
      roadbookFile(drawLine([{ straight: 2000 }, { arc: 30, deg: 90, dir: "left" }, { straight: 2000 }])),
    ),
  );
const at = (rb: PreparedRoadbook, m: number): LatLon => pointAt(rb.roadbook.line, rb.cumulativeM, m);

function spoken(rb: PreparedRoadbook, from: number, to: number, step = 20, speedKmh = 60) {
  const nav = createNavigator(rb);
  const said: Array<{ at: number; text: string; far: boolean }> = [];
  for (let m = from; m < to; m += step) {
    const s = nav.update(fixAt(at(rb, m), speedKmh, m * 100));
    if (s.turnWarning) said.push({ at: m, text: s.turnWarning.text, far: s.turnWarning.far });
  }
  return said;
}

test("a turn is announced twice: about 500 m ahead, then close", () => {
  const rb = turning();
  const turn = rb.maneuvers[0]!;
  const said = spoken(rb, turn.atM - 800, turn.atM + 100);
  assert.equal(said.length, 2);
  assert.equal(said[0]!.far, true);
  assert.match(said[0]!.text, /^In (500|450) metres, turn left$/);
  assert.ok(turn.atM - said[0]!.at <= 500 && turn.atM - said[0]!.at > 450);
  assert.equal(said[1]!.far, false);
  assert.equal(said[1]!.text, "Turn left");
  // 60 km/h is 16.7 m/s: six seconds is 100 m.
  assert.ok(Math.abs(turn.atM - said[1]!.at - 100) <= 20, `close at ${turn.atM - said[1]!.at} m`);
});

test("the close distance follows the speed, between 60 and 200 m", () => {
  const rb = turning();
  const turn = rb.maneuvers[0]!;
  const slow = spoken(rb, turn.atM - 400, turn.atM, 5, 10);
  const fast = spoken(rb, turn.atM - 800, turn.atM, 5, 200);
  const close = (said: typeof slow) => turn.atM - said.find((s) => !s.far)!.at;
  assert.ok(Math.abs(close(slow) - 60) <= 5);
  assert.ok(Math.abs(close(fast) - 200) <= 5);
});

test("a rider who comes up to the turn already close hears only the close message", () => {
  const rb = turning();
  const turn = rb.maneuvers[0]!;
  const said = spoken(rb, turn.atM - 90, turn.atM + 50, 5);
  assert.deepEqual(
    said.map((s) => s.text),
    ["Turn left"],
  );
});

test("a turn is said once per pass and again on the next pass", () => {
  const rb = turning();
  const turn = rb.maneuvers[0]!;
  const nav = createNavigator(rb);
  let count = 0;
  for (let pass = 0; pass < 2; pass++)
    for (let m = turn.atM - 800; m < turn.atM + 100; m += 20)
      if (nav.update(fixAt(at(rb, m), 60, (pass * 10_000 + m) * 100)).turnWarning) count++;
  assert.equal(count, 4);
});

test("a U-turn is said as one, and a turn that is followed closely says then", () => {
  const rb = prepareRoadbook(
    parseRoadbookFile(
      roadbookFile(
        drawLine([
          { straight: 1500 },
          { arc: 30, deg: 90, dir: "left" },
          { straight: 150 },
          { arc: 30, deg: 90, dir: "right" },
          { straight: 1500 },
        ]),
      ),
    ),
  );
  const first = rb.maneuvers[0]!;
  const said = spoken(rb, first.atM - 800, first.atM + 50, 5);
  assert.ok(
    said.some((s) => s.text === "Turn left, then turn right"),
    JSON.stringify(said),
  );
  const u = prepareRoadbook(
    parseRoadbookFile(
      roadbookFile(drawLine([{ straight: 1500 }, { arc: 15, deg: 180, dir: "left" }, { straight: 1500 }])),
    ),
  );
  const said2 = spoken(u, u.maneuvers[0]!.atM - 800, u.maneuvers[0]!.atM, 5);
  assert.match(said2[0]!.text, /make a U-turn$/);
  assert.equal(said2[said2.length - 1]!.text, "Make a U-turn");
});

test("a turn is not announced off route, nor going the wrong way", () => {
  const rb = turning();
  const turn = rb.maneuvers[0]!;
  const nav = createNavigator(rb);
  const side = (m: number): LatLon => [at(rb, m)[0] + 0.01, at(rb, m)[1]];
  let any = false;
  for (let m = turn.atM - 800; m < turn.atM; m += 20) {
    const s = nav.update(fixAt(side(m), 60, m * 100));
    if (s.turnWarning) any = true;
  }
  assert.equal(any, false);
});

const status = (rb: PreparedRoadbook, fixes: Fix[]) => {
  const nav = createNavigator(rb);
  return fixes.flatMap((f) => {
    const s = nav.update(f);
    return s.statusWarning ? [s.statusWarning.text] : [];
  });
};

test("going off route, being back on it, the wrong way and arriving are each said once", () => {
  const rb = turning();
  const off = (m: number, t: number) => fixAt([at(rb, m)[0] + 0.01, at(rb, m)[1]], 60, t);
  const fixes = [
    fixAt(at(rb, 500), 60, 0),
    off(500, 1000),
    off(520, 2000),
    off(540, 3000),
    off(560, 4000),
    off(580, 5000),
    fixAt(at(rb, 600), 60, 6000),
    fixAt(at(rb, 620), 60, 7000),
  ];
  assert.deepEqual(status(rb, fixes), ["You have left the route", "Back on the route"]);

  const wrong = [0, 1, 2, 3, 4].map((t) => ({ ...fixAt(at(rb, 800), 60, t * 1000), headingDeg: 270 }));
  assert.deepEqual(status(rb, wrong), ["Wrong way, make a U-turn"]);

  const end = rb.totalM;
  assert.deepEqual(
    status(rb, [fixAt(at(rb, end - 200), 40, 0), fixAt(at(rb, end - 10), 40, 1000), fixAt(at(rb, end - 5), 40, 2000)]),
    ["You have arrived"],
  );
});

test("a status message waits for a warning of danger on the same fix, it is not lost", () => {
  const line = drawLine([{ straight: 800 }, { arc: 12, deg: 160, dir: "left" }, { straight: 1500 }]);
  const rb = prepareRoadbook(parseRoadbookFile(roadbookFile(line)));
  const corner = rb.corners.find((c) => c.severity !== "bend")!;
  const nav = createNavigator(rb);
  // Against the line, at 36 km/h: the third fix is the wrong way, and the first within 150 m of the corner.
  const go = (back: number, t: number) =>
    nav.update({ ...fixAt(at(rb, corner.startM - back), 36, t), headingDeg: 270 });
  go(190, 0);
  go(170, 1000);
  const third = go(145, 2000);
  assert.equal(third.wrongWay, true);
  assert.ok(third.warning, "the corner is warned");
  assert.equal(third.statusWarning, null);
  assert.equal(go(140, 3000).statusWarning?.text, "Wrong way, make a U-turn");
});

test("at most one message is raised on a position update", () => {
  const rb = turning();
  const nav = createNavigator(rb);
  for (let m = 0; m < rb.totalM; m += 15) {
    const s = nav.update(fixAt(at(rb, m), 70, m * 100));
    const raised = [s.warning, s.zoneWarning, s.statusWarning, s.junctionWarning, s.turnWarning].filter(Boolean);
    assert.ok(raised.length <= 1, `${raised.length} at ${m} m`);
  }
});

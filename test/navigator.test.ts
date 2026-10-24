import assert from "node:assert/strict";
import { test } from "node:test";
import { createNavigator, lookaheadM, warningText } from "../src/core/navigator.ts";
import { prepareRoadbook } from "../src/core/roadbook.ts";
import { pointAt } from "../src/core/track.ts";
import { drawLine, fixAt } from "./helpers/path.ts";
import type { LatLon, PreparedRoadbook, Roadbook } from "../src/core/types.ts";

function roadbookOf(line: LatLon[], stops: Roadbook["stops"] = []): PreparedRoadbook {
  return prepareRoadbook({ id: "t", name: "t", description: "", stops, line });
}
const at = (rb: PreparedRoadbook, m: number): LatLon => pointAt(rb.roadbook.line, rb.cumulativeM, m);

// 1 km straight, a hairpin, 1 km straight.
const hairpinLine = () => drawLine([{ straight: 1000 }, { arc: 15, deg: 180, dir: "left" }, { straight: 1000 }]);

test("progress, remaining and distance to the line", () => {
  const rb = roadbookOf(drawLine([{ straight: 2000 }]));
  const nav = createNavigator(rb);
  const s = nav.update(fixAt(at(rb, 600)));
  assert.ok(Math.abs(s.progressM - 600) < 2);
  assert.ok(Math.abs(s.remainingM - (rb.totalM - 600)) < 2);
  assert.ok(s.distanceToLineM < 1);
  assert.equal(s.offRoute, false);
});

test("lookahead scales with speed within bounds", () => {
  assert.equal(lookaheadM(null), 150);
  assert.equal(lookaheadM(60 / 3.6), 150); // 133 m raised to the 150 m floor
  assert.ok(Math.abs(lookaheadM(100 / 3.6) - 222) < 1);
  assert.equal(lookaheadM(200), 600);
});

test("a hairpin is warned once, 130 m before at 60 km/h, and not again", () => {
  const rb = roadbookOf(hairpinLine());
  const hairpin = rb.corners.find((c) => c.severity === "hairpin")!;
  assert.ok(hairpin);
  const nav = createNavigator(rb);
  assert.equal(nav.update(fixAt(at(rb, hairpin.startM - 400))).warning, null);
  const warned = nav.update(fixAt(at(rb, hairpin.startM - 130)));
  assert.ok(warned.warning);
  if (!warned.warning) return;
  assert.equal(warned.warning.corner.direction, "left");
  assert.match(warned.warning.text, /^Hairpin left, 130 metres, 20$/);
  assert.equal(nav.update(fixAt(at(rb, hairpin.startM - 100))).warning, null);
  assert.equal(nav.update(fixAt(at(rb, hairpin.startM - 20))).warning, null);
});

test("the next dangerous corner is always reported for display", () => {
  const rb = roadbookOf(hairpinLine());
  const s = createNavigator(rb).update(fixAt(at(rb, 100)));
  assert.equal(s.nextCorner?.corner.severity, "hairpin");
  assert.ok(Math.abs((s.nextCorner?.distanceM ?? 0) - (rb.corners[0]!.startM - 100)) < 3);
});

test("a bend raises no warning", () => {
  const rb = roadbookOf(drawLine([{ straight: 500 }, { arc: 100, deg: 90, dir: "left" }, { straight: 500 }]));
  const nav = createNavigator(rb);
  for (let m = 0; m < rb.totalM; m += 20) assert.equal(nav.update(fixAt(at(rb, m))).warning, null);
});

test("passing a corner arms it again", () => {
  const rb = roadbookOf(hairpinLine());
  const c = rb.corners[0]!;
  const nav = createNavigator(rb);
  assert.ok(nav.update(fixAt(at(rb, c.startM - 100))).warning);
  nav.update(fixAt(at(rb, c.endM + 50)));
  // the rider rides the loop again from the start
  const again = createNavigator(rb);
  assert.ok(again.update(fixAt(at(rb, c.startM - 100))).warning);
});

test("off route needs three consecutive far fixes, one noisy fix is ignored", () => {
  const rb = roadbookOf(drawLine([{ straight: 3000 }]));
  const nav = createNavigator(rb);
  const far = (m: number): LatLon => [at(rb, m)[0] + 0.001, at(rb, m)[1]]; // about 111 m north
  nav.update(fixAt(at(rb, 100)));
  assert.equal(nav.update(fixAt(far(150))).offRoute, false);
  assert.equal(nav.update(fixAt(at(rb, 200))).offRoute, false);
  assert.equal(nav.update(fixAt(far(250))).offRoute, false);
  assert.equal(nav.update(fixAt(far(300))).offRoute, false);
  assert.equal(nav.update(fixAt(far(350))).offRoute, true);
  assert.equal(nav.update(fixAt(at(rb, 400))).offRoute, false);
});

test("no warning while off route", () => {
  const rb = roadbookOf(hairpinLine());
  const c = rb.corners[0]!;
  const nav = createNavigator(rb);
  const base = at(rb, c.startM - 100);
  const far: LatLon = [base[0] + 0.001, base[1]];
  nav.update(fixAt(far));
  nav.update(fixAt(far));
  const s = nav.update(fixAt(far));
  assert.equal(s.offRoute, true);
  assert.equal(s.warning, null);
});

test("next stop follows progress and the loop finish stays at the end", () => {
  const line = drawLine([
    { straight: 1000 },
    { arc: 100, deg: 180, dir: "left" },
    { straight: 1000 },
    { arc: 100, deg: 180, dir: "left" },
  ]);
  const start = line[0]!;
  const rb = roadbookOf(line, [
    { lat: start[0], lon: start[1], name: "Start" },
    { lat: 0, lon: 0, name: "unused" },
  ]);
  assert.equal(rb.loop, true);
  const rb2 = roadbookOf(line, [
    { lat: start[0], lon: start[1], name: "Start" },
    { lat: at(rb, 1500)[0], lon: at(rb, 1500)[1], name: "1. Café" },
    { lat: start[0], lon: start[1], name: "Finish" },
  ]);
  assert.deepEqual(
    rb2.stops.map((s) => Math.round(s.atM / 100)),
    [0, 15, Math.round(rb2.totalM / 100)],
  );
  const nav = createNavigator(rb2);
  assert.equal(nav.update(fixAt(at(rb2, 300))).nextStop?.name, "1. Café");
  assert.equal(nav.update(fixAt(at(rb2, 1800))).nextStop?.name, "Finish");
});

test("warning text rounds the distance to 10 m", () => {
  const rb = roadbookOf(hairpinLine());
  assert.equal(
    warningText({ ...rb.corners[0]!, severity: "sharp", direction: "right", advisoryKmh: 45 }, 147),
    "Sharp corner right, 150 metres, 45",
  );
});

test("an out-and-back road does not send the rider back to the first pass", () => {
  const rb = roadbookOf(drawLine([{ straight: 500 }, { arc: 1, deg: 180, dir: "left" }, { straight: 500 }]));
  const nav = createNavigator(rb);
  let last = -1;
  for (let m = 0; m <= rb.totalM; m += 15) {
    const s = nav.update({ ...fixAt(at(rb, m), 54), time: (m / 15) * 1000 });
    assert.ok(s.progressM >= last - 1, `at ${m} got ${s.progressM}`);
    last = s.progressM;
  }
  assert.ok(last > rb.totalM - 20);
});

test("two stops at the same place stay in riding order", () => {
  const line = drawLine([{ straight: 1000 }]);
  const end = line.at(-1)!;
  const rb = roadbookOf(line, [
    { lat: end[0], lon: end[1], name: "Finish" },
    { lat: end[0], lon: end[1], name: "Finish again" },
  ]);
  assert.ok(rb.stops[1]!.atM >= rb.stops[0]!.atM);
});

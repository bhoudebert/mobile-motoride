import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { limitAt } from "../src/core/limits.ts";
import { withApproach } from "../src/core/approach.ts";
import { policyOf } from "../src/core/cameraPolicy.ts";
import { createNavigator } from "../src/core/navigator.ts";
import { prepareRoadbook } from "../src/core/roadbook.ts";
import { planSkip } from "../src/core/skip.ts";
import { pointAt } from "../src/core/track.ts";
import { fixAt } from "./helpers/path.ts";
import type { Roadbook } from "../src/core/types.ts";

const dir = new URL("./fixtures/roadbooks/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

test("the fixture roadbooks are there", () => {
  assert.ok(files.length > 0);
});

for (const f of files) {
  const rb = prepareRoadbook(JSON.parse(readFileSync(new URL(f, dir), "utf8")) as Roadbook);

  test(`${f}: prepared like a real roadbook`, () => {
    assert.ok(rb.totalM > 10_000);
    assert.equal(rb.loop, true);
    assert.ok(rb.corners.length > 0);
    for (let i = 1; i < rb.stops.length; i++)
      assert.ok(rb.stops[i]!.atM >= rb.stops[i - 1]!.atM, "stops in riding order");
    for (let i = 1; i < rb.corners.length; i++)
      assert.ok(rb.corners[i]!.startM >= rb.corners[i - 1]!.startM, "corners in order");
  });

  test(`${f}: riding it at 70 km/h warns once per dangerous corner and never goes off route`, () => {
    const nav = createNavigator(rb);
    const dangerous = rb.corners.filter((c) => c.severity !== "bend");
    const warned = new Set<unknown>();
    let last = -1;
    for (let m = 0; m <= rb.totalM; m += 19) {
      const s = nav.update(fixAt(pointAt(rb.roadbook.line, rb.cumulativeM, m), 70));
      assert.equal(s.offRoute, false);
      assert.ok(s.progressM >= last - 1, "progress never goes back");
      last = s.progressM;
      if (s.warning) {
        assert.ok(!warned.has(s.warning.corner), "no corner warned twice");
        warned.add(s.warning.corner);
      }
    }
    assert.equal(warned.size, dangerous.length);
  });
}

for (const f of files) {
  const rb = prepareRoadbook(JSON.parse(readFileSync(new URL(f, dir), "utf8")) as Roadbook);
  if (rb.limitSegments.length === 0) continue;

  test(`${f}: the speed limit covers the road and is known all the way`, () => {
    const covered = rb.limitSegments.reduce((sum, l) => sum + (l.endM - l.startM), 0);
    assert.ok(covered / rb.totalM > 0.97, `covered ${covered / rb.totalM}`);
    for (const l of rb.limitSegments) assert.ok(l.kmh >= 20 && l.kmh <= 140, `limit ${l.kmh}`);
    let unknown = 0;
    for (let m = 0; m < rb.totalM; m += 50) if (limitAt(rb, m).kmh === null) unknown++;
    assert.ok(unknown / (rb.totalM / 50) < 0.03, `${unknown} unknown samples`);
  });

  test(`${f}: ridden at 70 km/h, each danger zone is warned once and the sign is never zero`, () => {
    const nav = createNavigator(rb);
    let warned = 0;
    for (let m = 0; m <= rb.totalM; m += 19) {
      const s = nav.update(fixAt(pointAt(rb.roadbook.line, rb.cumulativeM, m), 70));
      if (s.zoneWarning) warned++;
      assert.notEqual(s.speedLimit.kmh, 0);
      assert.ok(!s.speedLimit.next || s.speedLimit.next.kmh !== s.speedLimit.kmh);
    }
    // A zone right under a dangerous corner can wait for the next fix, but none is missed or doubled. A camera whose
    // country the roadbook does not say, or does not allow, is never warned of (ADR 0021).
    const allowed = rb.zones.filter((z) => policyOf(z.country) !== "off").length;
    assert.ok(warned <= allowed && warned >= allowed - 1, `${warned} warned for ${allowed} allowed zones`);
  });
}

for (const f of files) {
  const rb = prepareRoadbook(JSON.parse(readFileSync(new URL(f, dir), "utf8")) as Roadbook);

  test(`${f}: skipping every point in turn always goes forward and leaves a rideable line`, () => {
    let ride = rb;
    let lastJoin = -1;
    let skips = 0;
    const route = rb.stops.filter((s) => s.kind !== "stop");
    for (let guard = 0; guard < 50; guard++) {
      const plan = planSkip(ride, 0);
      if (!plan) break;
      assert.ok(plan.joinM > lastJoin, `join ${plan.joinM} after ${lastJoin}`);
      assert.doesNotMatch(plan.target.name, /\d+\.\d+,\s*\d+\.\d+/, "no raw coordinates as a name");
      const here = pointAt(ride.roadbook.line, ride.cumulativeM, 0);
      ride = withApproach(rb, [here], true, plan.joinM, "route", plan.target.name);
      lastJoin = plan.joinM;
      skips++;
    }
    assert.ok(skips >= route.length - 2, `${skips} skips for ${route.length} route points`);
    // The last ride goes from the rider straight to the final point and on to the end; it can be ridden.
    const nav = createNavigator(ride);
    for (let m = 0; m <= ride.totalM; m += 25) {
      const s = nav.update(fixAt(pointAt(ride.roadbook.line, ride.cumulativeM, m), 50, m * 100));
      assert.equal(s.offRoute, false);
    }
  });
}

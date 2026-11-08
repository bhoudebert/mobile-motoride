import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { chooseRejoinTarget, REJOIN_NEAR_M } from "../src/core/rejoin.ts";
import { bearingDeg, haversineM, unproject } from "../src/core/geo.ts";
import { createNavigator } from "../src/core/navigator.ts";
import { prepareRoadbook } from "../src/core/roadbook.ts";
import { planSkip } from "../src/core/skip.ts";
import { pointAt } from "../src/core/track.ts";
import { drawLine, REF } from "./helpers/path.ts";
import type { Fix, LatLon, PreparedRoadbook, Roadbook } from "../src/core/types.ts";

const fixture = (name: string) => new URL(`./fixtures/${name}`, import.meta.url);
const coutiches = prepareRoadbook(
  JSON.parse(readFileSync(fixture("roadbooks/r2-coutiches-hollain-ere-peaceful-loop.json"), "utf8")) as Roadbook,
);
const waypoints = coutiches.stops.filter((s) => s.kind !== "stop");

function recorded(name: string): Fix[] {
  const { fixes } = JSON.parse(readFileSync(fixture(`rides/${name}.json`), "utf8")) as { fixes: number[][] };
  return fixes.map(([lat, lon, time, speed], i) => {
    const prev = i > 0 ? fixes[i - 1]! : null;
    const moved = prev ? haversineM([prev[0]!, prev[1]!], [lat!, lon!]) : 0;
    return {
      lat: lat!,
      lon: lon!,
      speedMps: speed!,
      headingDeg: prev && moved > 2 ? bearingDeg([prev[0]!, prev[1]!], [lat!, lon!]) : null,
      accuracyM: 5,
      time: time! * 1000,
    } as Fix;
  });
}

for (const ride of ["2026-11-08-fuel-detour-a", "2026-11-08-fuel-detour-b"]) {
  test(`${ride}: a rider far from the route is always sent to a route point, not the nearest bit of the line`, () => {
    const nav = createNavigator(coutiches);
    const targets = new Set<string>();
    let far = 0;
    for (const fix of recorded(ride)) {
      const s = nav.update(fix);
      if (!s.offRoute || s.distanceToLineM <= REJOIN_NEAR_M) continue;
      far++;
      assert.ok(s.rejoin, "a rider off route has a place to go to");
      const stop = waypoints.find((w) => haversineM([w.lat, w.lon], s.rejoin!.target) < 30);
      assert.ok(stop, `the target ${s.rejoin.target} is a route point`);
      assert.equal(s.rejoin.name, stop.name);
      targets.add(stop.name);
    }
    assert.ok(far > 20, "the ride spends time far from the route");
    // It does not hop between the end of the loop and its start as the nearest point of the line flips.
    assert.ok(targets.size <= 2, `targets seen: ${[...targets].join(" | ")}`);
  });

  test(`${ride}: the next point can be skipped all along, off route or not`, () => {
    const nav = createNavigator(coutiches);
    for (const fix of recorded(ride)) {
      const s = nav.update(fix);
      assert.ok(planSkip(coutiches, s.reachedM), `no skip offered at ${fix.lat},${fix.lon} (reached ${s.reachedM})`);
    }
  });
}

// A straight east-west road with route points every 2 km: 1 at 2 km, 2 at 4 km, 3 at 6 km, finish at 8 km.
function road(): PreparedRoadbook {
  const line = drawLine([{ straight: 8000 }]);
  const at = (m: number): LatLon => pointAt(line, cumulative(line), m);
  const stops = [0, 2000, 4000, 6000, 8000].map((m, i, all) => ({
    lat: at(m)[0],
    lon: at(m)[1],
    name: i === 0 ? "Start" : i === all.length - 1 ? "Finish" : `Point ${i}`,
  }));
  return prepareRoadbook({ id: "t", name: "t", description: "", stops, line });
}
function cumulative(line: LatLon[]): number[] {
  const out = [0];
  for (let i = 1; i < line.length; i++) out.push(out[i - 1]! + haversineM(line[i - 1]!, line[i]!));
  return out;
}
const off = (m: number, northM: number): LatLon => unproject([m, northM], REF);

test("a rider heading for a later point is sent there, not back to the next one", () => {
  const rb = road();
  // 3 km north of the road, level with 4.5 km along it, heading east: Point 3 (6 km) is ahead, Point 2 (4 km) behind.
  const pos = off(4500, 3000);
  const choice = chooseRejoinTarget(rb, 1900, pos, 90);
  assert.equal(choice?.name, "Point 3");
});

test("a rider whose next point is the nearest ahead goes to it", () => {
  const rb = road();
  const choice = chooseRejoinTarget(rb, 2500, off(2600, 3000), 90);
  assert.equal(choice?.name, "Point 2");
});

test("the nearest point is kept even if the rider heads away from it, when the others are further still", () => {
  const rb = road();
  // Heading west, away from every point: Point 1 is still the nearest and the least behind.
  assert.equal(chooseRejoinTarget(rb, 100, off(1500, 2000), 270)?.name, "Point 1");
});

test("the finish is not a place to rejoin while a route point remains", () => {
  const rb = road();
  assert.notEqual(chooseRejoinTarget(rb, 5900, off(7800, 3000), 90)?.name, "Finish");
});

test("close to the line it is left to the nearest-point rejoin", () => {
  const rb = road();
  assert.equal(chooseRejoinTarget(rb, 1900, off(3000, REJOIN_NEAR_M - 100), 90), null);
});

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
  test(`${ride}: a rider far from the route is sent to a place of the line, which does not hop about`, () => {
    const nav = createNavigator(coutiches);
    const targets: number[] = [];
    let far = 0;
    for (const fix of recorded(ride)) {
      const s = nav.update(fix);
      if (!s.offRoute || s.distanceToLineM <= REJOIN_NEAR_M) continue;
      far++;
      assert.ok(s.rejoin, "a rider off route has a place to go to");
      assert.ok(
        waypoints.some((w) => w.name === s.rejoin!.name),
        `${s.rejoin.name} is a route point`,
      );
      if (targets[targets.length - 1] !== s.rejoin.atM) targets.push(s.rejoin.atM);
    }
    assert.ok(far > 20, "the ride spends time far from the route");
    // The place moves as the rider does, but it settles: a few changes over a ride of an hour, not one a minute.
    assert.ok(targets.length <= 40, `targets seen: ${targets.length}`);
  });

  test(`${ride}: the next point can be skipped all along, off route or not`, () => {
    const nav = createNavigator(coutiches);
    for (const fix of recorded(ride)) {
      const s = nav.update(fix);
      assert.ok(
        planSkip(coutiches, s.rejoin?.atM ?? s.reachedM),
        `no skip offered at ${fix.lat},${fix.lon} (reached ${s.reachedM})`,
      );
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

test("a rider who missed the start and went far along is sent to the nearest place of the line, not back to the start", () => {
  const rb = road();
  // Never on the road (reached 0), 3 km north of it level with 4.5 km along it, heading east: Point 1 (2 km) is behind.
  const choice = chooseRejoinTarget(rb, 0, off(4500, 3000), 90);
  assert.ok(choice);
  assert.ok(choice.atM > 4400 && choice.atM < 6000, `joins at ${choice.atM}`);
  assert.equal(choice.name, "Point 3", "the next point is the one in front");
});

test("a rider level with the finish is sent there, whatever points were skipped", () => {
  const rb = road();
  const choice = chooseRejoinTarget(rb, 0, off(7900, 3000), 90);
  assert.ok(choice && choice.atM > 7500, `joins at ${choice?.atM}`);
  assert.equal(choice.name, "Finish");
});

test("a place the rider already passed costs more than one of the same distance ahead", () => {
  const rb = road();
  // Last on the road at 6 km, now 3 km north of it level with 5 km: the nearest place is behind, 6 km is ahead.
  const choice = chooseRejoinTarget(rb, 6000, off(5000, 3000), null);
  assert.ok(choice && choice.atM >= 5900, `joins at ${choice?.atM}`);
});

test("the place being ridden to is kept unless another costs clearly less", () => {
  const rb = road();
  const pos = off(4000, 3000);
  const first = chooseRejoinTarget(rb, 0, pos, 90);
  assert.ok(first);
  // The rider drifts east a little: the nearest place moves with them, the one ridden to stays.
  const kept = chooseRejoinTarget(rb, 0, off(4300, 3000), 90, 3800);
  assert.equal(kept?.atM, 3800);
  // Much nearer another place: it takes over.
  const moved = chooseRejoinTarget(rb, 0, off(7000, 1000), 90, 3800);
  assert.ok(moved && moved.atM > 6500, `joins at ${moved?.atM}`);
});

test("close to the line it is left to the nearest-point rejoin", () => {
  const rb = road();
  assert.equal(chooseRejoinTarget(rb, 1900, off(3000, REJOIN_NEAR_M - 100), 90), null);
});

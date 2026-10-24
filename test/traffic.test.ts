import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isJam,
  outlookOfTraffic,
  parseTraffic,
  trafficCollection,
  trafficPoints,
  trafficStretches,
  TRAFFIC_AHEAD_M,
  type TrafficReading,
} from "../src/core/traffic.ts";
import { cumulativeDistances } from "../src/core/track.ts";
import type { LatLon } from "../src/core/types.ts";

// A straight line going north, 100 km long (about 0.9 degrees).
const line: LatLon[] = Array.from({ length: 1001 }, (_, i) => [50 + i * 0.0009, 3]);
const cum = cumulativeDistances(line);
const total = cum[cum.length - 1]!;

test("the points to ask are here and every 10 km up to 60 km ahead", () => {
  const pts = trafficPoints(line, cum, 5_000, total);
  assert.equal(pts.length, 7);
  assert.deepEqual(
    pts.map((p) => p.distM),
    [0, 10_000, 20_000, 30_000, 40_000, 50_000, 60_000],
  );
  assert.equal(pts[0]!.atM, 5_000);
  assert.ok(pts[6]!.lat > pts[0]!.lat);
});

test("near the finish there are fewer points, and never more than the server takes", () => {
  assert.equal(trafficPoints(line, cum, total - 15_000, total).length, 2);
  assert.ok(trafficPoints(line, cum, 0, total).length <= 8);
  assert.equal(TRAFFIC_AHEAD_M, 60_000);
});

test("the server's answer is read in the order asked; a level it does not know is unknown; a wrong count is refused", () => {
  assert.deepEqual(parseTraffic({ points: [{ level: "free" }, { level: "heavy" }, { level: "x" }, {}] }, 4), [
    "free",
    "heavy",
    "unknown",
    "unknown",
  ]);
  assert.equal(parseTraffic({ points: [{ level: "free" }] }, 2), null);
  assert.equal(parseTraffic(null, 1), null);
  assert.equal(parseTraffic({ points: "x" }, 1), null);
});

const readings = (levels: Array<TrafficReading["level"]>, progressM = 0): TrafficReading[] =>
  trafficPoints(line, cum, progressM, total)
    .slice(0, levels.length)
    .map((point, i) => ({ point, level: levels[i]! }));

test("the first jam is the nearest slow, heavy or closed point; free and unknown are not jams", () => {
  assert.equal(isJam("free"), false);
  assert.equal(isJam("unknown"), false);
  const o = outlookOfTraffic(readings(["free", "unknown", "slow", "heavy"]));
  assert.equal(o.first?.level, "slow");
  assert.equal(o.first?.point.distM, 20_000);
  assert.equal(o.known, true);
  assert.equal(outlookOfTraffic(readings(["unknown", "unknown"])).known, false);
  assert.equal(outlookOfTraffic(readings(["free", "free"])).first, null);
});

test("each jam point colours half the spacing on each side, and neighbours of the same level join", () => {
  const s = trafficStretches(readings(["free", "slow", "slow", "heavy", "free"]), 0, total);
  assert.deepEqual(s, [
    { fromM: 5_000, toM: 25_000, level: "slow" },
    { fromM: 25_000, toM: 35_000, level: "heavy" },
  ]);
});

test("a stretch never starts behind the rider nor ends past the finish", () => {
  const near = trafficStretches(readings(["heavy"], 2_000), 2_000, total);
  assert.equal(near[0]!.fromM, 2_000);
  const end = trafficStretches(readings(["free", "heavy"], total - 12_000), total - 12_000, total);
  assert.ok(end[0]!.toM <= total);
});

test("the stretches become lines for the map, longitude first, each with its level", () => {
  const c = trafficCollection(line, cum, [{ fromM: 5_000, toM: 15_000, level: "heavy" }]);
  assert.equal(c.features.length, 1);
  const f = c.features[0]!;
  assert.equal(f.properties?.["level"], "heavy");
  assert.ok(f.geometry.coordinates.length >= 50);
  assert.equal(f.geometry.coordinates[0]![0], 3);
  assert.ok(f.geometry.coordinates[0]![1]! > 50);
});

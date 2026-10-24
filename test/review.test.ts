import assert from "node:assert/strict";
import { test } from "node:test";
import {
  marksCollection,
  marksOf,
  nextReplaySpeed,
  parseRideGpx,
  profile,
  replayAt,
  reviewRide,
  speedClass,
  timeline,
  traceCollection,
} from "../src/core/review.ts";
import { rideToGpx, type RideMeta, type TrackPoint } from "../src/core/recording.ts";

const T0 = Date.UTC(2026, 9, 20, 9, 0, 0);
// East along the equator-ish line: 1e-5 degrees of longitude at 50 N is about 0.72 m.
const M_PER_DEG_LON = 111_320 * Math.cos((50 * Math.PI) / 180);
const east = (m: number) => m / M_PER_DEG_LON;

/** One point a second, riding east at `mps`, from `start` seconds and `x` metres. */
const ride = (seconds: number, mps: number, start = 0, x = 0, extra: (i: number) => Partial<TrackPoint> = () => ({})) =>
  Array.from({ length: seconds }, (_, i): TrackPoint => ({
    lat: 50,
    lon: 3 + east(x + mps * i),
    time: T0 + (start + i) * 1000,
    speedMps: mps,
    ...extra(i),
  }));

const meta = (points: TrackPoint[]): RideMeta => ({
  id: "r",
  roadbookId: "rb",
  roadbookName: "Loop",
  startedAt: points[0]!.time,
  endedAt: points[points.length - 1]!.time,
  distanceM: 0,
  points: points.length,
  state: "completed",
});

test("a recorded GPX is read back point for point, with the readings of the gauges", () => {
  const points = ride(5, 20, 0, 0, (i) => ({
    altitudeM: 100 + i,
    leanDeg: i === 2 ? 31.5 : 0,
    lateralG: 0.61,
    brakingG: i === 3 ? 0.55 : 0,
    turnRate: 0.1,
  }));
  const back = parseRideGpx(rideToGpx(meta(points), points));
  assert.equal(back.length, 5);
  assert.equal(back[0]!.time, T0);
  assert.equal(back[2]!.leanDeg, 31.5);
  assert.equal(back[3]!.brakingG, 0.55);
  assert.equal(back[4]!.altitudeM, 104);
  assert.equal(back[1]!.speedMps, 20);
  assert.ok(Math.abs(back[4]!.lon - points[4]!.lon) < 1e-6);
});

test("a track without readings or altitudes, with a point lacking a time or a self-closing one, is read as far as it goes", () => {
  const gpx = `<gpx><trk><trkseg>
    <trkpt lat="50" lon="3"><time>2026-10-20T09:00:00Z</time></trkpt>
    <trkpt lat="50.001" lon="3"/>
    <trkpt lat="50.002" lon="3"><ele>12</ele><time>2026-10-20T09:00:10Z</time></trkpt>
    <trkpt lat="x" lon="3"><time>2026-10-20T09:00:20Z</time></trkpt>
  </trkseg></trk></gpx>`;
  const points = parseRideGpx(gpx);
  assert.equal(points.length, 2);
  assert.equal(points[0]!.speedMps, null);
  assert.equal(points[0]!.altitudeM, undefined);
  assert.equal(points[1]!.altitudeM, 12);
  assert.deepEqual(parseRideGpx("not a gpx"), []);
});

test("distance, duration, time moving and speeds: a stop is not moving and a gap is not counted", () => {
  // 100 s at 20 m/s, 200 s standing still, 100 s at 30 m/s.
  const points = [
    ...ride(100, 20),
    ...ride(200, 0, 100, 2000).map((p) => ({ ...p, lon: 3 + east(1980) })),
    ...ride(100, 30, 300, 1980),
  ];
  const r = reviewRide(points);
  assert.ok(Math.abs(r.distanceM - 4960) < 60);
  assert.equal(r.durationMs, 399_000);
  assert.ok(r.movingMs > 195_000 && r.movingMs < 201_000, String(r.movingMs));
  assert.ok(r.avgKmh! > 85 && r.avgKmh! < 95);
  assert.ok(Math.abs(r.maxKmh - 108) < 0.5);
});

test("a pause longer than a minute between two points does not count as moving", () => {
  const points = [...ride(10, 20), ...ride(10, 20, 3600, 200)];
  assert.ok(reviewRide(points).movingMs <= 19_000);
});

test("climb and descent count a rise only past 3 m, and the extremes are kept", () => {
  const alts = [100, 101, 99, 102, 105, 110, 108, 104, 100, 98, 99];
  const points = ride(alts.length, 10, 0, 0, (i) => ({ altitudeM: alts[i]! }));
  const r = reviewRide(points);
  assert.equal(r.maxAltitudeM, 110);
  assert.equal(r.minAltitudeM, 98);
  // 100 -> 105 is the first rise past 3 m (then 110): +10; 110 -> 104 -> 100 is -10; the last 2 m are noise.
  assert.equal(r.climbM, 10);
  assert.equal(r.descentM, 10);
});

test("no altitudes means no climb, not a climb of 0", () => {
  const r = reviewRide(ride(10, 10));
  assert.equal(r.climbM, null);
  assert.equal(r.descentM, null);
  assert.equal(r.minAltitudeM, null);
});

test("peaks of lean to each side, lateral G, braking and acceleration come from the gauges", () => {
  const lean = [0, 10, 38, 20, -5, -41.5, -10, 0];
  const brake = [0, 0.1, -0.5, 0.7, 0.2, -0.2, 0, 0];
  const points = ride(8, 20, 0, 0, (i) => ({
    leanDeg: lean[i]!,
    brakingG: brake[i]!,
    lateralG: Math.tan((lean[i]! * Math.PI) / 180),
  }));
  const r = reviewRide(points);
  assert.deepEqual(r.peakLeft, { value: 38, index: 2 });
  assert.deepEqual(r.peakRight, { value: 41.5, index: 5 });
  assert.deepEqual(r.brake, { value: 0.7, index: 3 });
  assert.deepEqual(r.accel, { value: 0.5, index: 2 });
  assert.ok(Math.abs(r.maxLateralG! - Math.tan((41.5 * Math.PI) / 180)) < 1e-9);
  const marks = marksOf(r);
  assert.deepEqual(
    marks.map((m) => [m.kind, m.side, m.value, m.index]),
    [
      ["lean", "right", 41.5, 5],
      ["brake", undefined, 0.7, 3],
    ],
  );
  const fc = marksCollection(points, marks);
  assert.equal(fc.features.length, 2);
  assert.deepEqual(fc.features[1]!.geometry.coordinates, [points[3]!.lon, points[3]!.lat]);
});

test("a ride recorded without the gauges has no lean and no G, not zeros", () => {
  const r = reviewRide(ride(20, 15));
  assert.equal(r.peakLeft, null);
  assert.equal(r.peakRight, null);
  assert.equal(r.maxLateralG, null);
  assert.equal(r.brake, null);
  assert.equal(r.accel, null);
  assert.deepEqual(marksOf(r), []);
});

test("an empty or one point track gives zeros, without an error", () => {
  for (const pts of [[], ride(1, 10)]) {
    const r = reviewRide(pts);
    assert.equal(r.distanceM, 0);
    assert.equal(r.durationMs, 0);
    assert.equal(r.avgKmh, null);
    assert.equal(r.maxKmh, pts.length ? 36 : 0);
  }
});

test("speed classes: under 40, 40 to 70, 70 to 100, over 100 km/h", () => {
  assert.deepEqual([0, 39.9, 40, 69.9, 70, 99.9, 100, 180].map(speedClass), [0, 0, 1, 1, 2, 2, 3, 3]);
});

test("the track is drawn in runs of one speed class that join up", () => {
  const points = [...ride(10, 5), ...ride(10, 15, 10, 45), ...ride(10, 40, 20, 195)];
  const fc = traceCollection(points);
  assert.deepEqual(
    fc.features.map((f) => f.properties!.speed),
    [0, 1, 3],
  );
  for (let i = 1; i < fc.features.length; i++) {
    const prev = fc.features[i - 1]!.geometry.coordinates;
    const first = fc.features[i]!.geometry.coordinates[0];
    assert.deepEqual(first, prev[prev.length - 1]);
  }
  assert.equal(traceCollection([]).features.length, 0);
  assert.equal(traceCollection(ride(1, 5)).features.length, 0);
});

test("a speed missing from the file is made from the distance and the time", () => {
  const points = ride(10, 20).map((p) => ({ ...p, speedMps: null }));
  const r = reviewRide(points);
  assert.ok(Math.abs(r.maxKmh - 72) < 1);
  assert.equal(traceCollection(points).features[0]!.properties!.speed, 2);
});

test("the profile keeps the fastest moment of each stretch, so a short peak is not skipped", () => {
  const points = ride(300, 10, 0, 0, (i) => ({ speedMps: i === 150 ? 45 : 10 }));
  const p = profile(points, 20);
  assert.equal(p.length, 20);
  assert.ok(Math.max(...p.map((s) => s.kmh)) >= 161);
  assert.equal(p[0]!.distM, 0);
  assert.deepEqual(profile([], 10), []);
  assert.equal(profile(ride(1, 5), 5).length, 5);
});

test("the replay shortens a stop to 30 s and ends on the last point", () => {
  const points = [...ride(60, 10), ...ride(60, 10, 3600, 600)];
  const tl = timeline(points);
  assert.equal(tl.totalMs, 59_000 + 30_000 + 59_000);
  assert.equal(tl.at[59], 59_000);
  assert.equal(tl.at[60], 89_000);
  const end = replayAt(points, tl, 10_000_000)!;
  assert.equal(end.progress, 1);
  assert.equal(end.index, 119);
  assert.ok(Math.abs(end.lon - points[119]!.lon) < 1e-9);
  const start = replayAt(points, tl, -5)!;
  assert.equal(start.progress, 0);
  assert.equal(start.index, 0);
});

test("the replay moves between two points in proportion to the time, with their readings", () => {
  const points = ride(3, 20, 0, 0, (i) => ({ leanDeg: i * 10, altitudeM: 100 + i * 10, brakingG: 0.2 * i }));
  const tl = timeline(points);
  const mid = replayAt(points, tl, 1500)!;
  assert.equal(mid.index, 1);
  assert.ok(Math.abs(mid.lon - (points[1]!.lon + points[2]!.lon) / 2) < 1e-9);
  assert.equal(mid.leanDeg, 15);
  assert.equal(mid.altitudeM, 115);
  assert.ok(Math.abs(mid.brakingG! - 0.3) < 1e-9);
  assert.ok(Math.abs(mid.kmh - 72) < 1e-9);
  assert.equal(mid.time, T0 + 1500);
  assert.equal(replayAt([], timeline([]), 0), null);
  const bare = replayAt(ride(3, 5), timeline(ride(3, 5)), 500)!;
  assert.equal(bare.leanDeg, null);
  assert.equal(bare.altitudeM, null);
});

test("the replay speeds go round", () => {
  assert.equal(nextReplaySpeed(10), 30);
  assert.equal(nextReplaySpeed(300), 10);
  assert.equal(nextReplaySpeed(7), 10);
});

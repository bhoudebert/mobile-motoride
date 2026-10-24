import assert from "node:assert/strict";
import { test } from "node:test";
import { parseGpx } from "../src/core/gpx.ts";
import { parseRoadbookFile } from "../src/core/roadbookFile.ts";
import {
  durationText,
  keeps,
  parseMeta,
  pointOf,
  rideId,
  rideExtras,
  rideToGpx,
  serializeMeta,
  summarizeTrack,
  trackDistanceM,
  worthKeeping,
  type RideMeta,
  type TrackPoint,
} from "../src/core/recording.ts";
import type { Fix } from "../src/core/types.ts";
import { drawLine } from "./helpers/path.ts";
import { roadbookFile } from "./helpers/polyline.ts";

const fix = (
  lat: number,
  lon: number,
  time: number,
  speedMps: number | null = 10,
  accuracyM: number | null = 5,
): Fix => ({
  lat,
  lon,
  speedMps,
  headingDeg: 90,
  accuracyM,
  time,
});

test("a poor fix is left out, a fix at the same place is left out unless the rider moves, the first is kept", () => {
  assert.equal(keeps(null, fix(50, 3, 1000)), true);
  assert.equal(keeps(null, fix(50, 3, 1000, 10, 80)), false);
  const last: TrackPoint = pointOf(fix(50, 3, 1000));
  assert.equal(keeps(last, fix(50, 3.00001, 2000, 0)), false, "standing still");
  assert.equal(keeps(last, fix(50, 3.001, 2000, 12)), true, "70 m on");
  assert.equal(keeps(last, fix(50, 3.00001, 2000, 6)), true, "moving, even if little changed");
  assert.equal(keeps(last, fix(50, 3.001, 1000)), false, "not later than the last one");
  assert.equal(keeps(last, fix(50, 3.001, 2000, 12, null)), true, "an accuracy that is not known is not refused");
});

test("a track needs two points and 50 m to be a ride", () => {
  const a = pointOf(fix(50, 3, 0));
  assert.equal(worthKeeping([]), false);
  assert.equal(worthKeeping([a]), false);
  assert.equal(worthKeeping([a, pointOf(fix(50, 3.0002, 1000))]), false, "about 14 m");
  assert.equal(worthKeeping([a, pointOf(fix(50, 3.001, 1000))]), true);
  assert.ok(trackDistanceM([a, pointOf(fix(50, 3.001, 1000))]) > 60);
});

test("a ride is named by its start and its roadbook, so the list sorts by date", () => {
  const t = Date.UTC(2026, 9, 19, 9, 30, 5);
  assert.equal(rideId(t, "Pays des Collines loop"), "2026-10-19T09-30-05-pays-des-collines-loop");
  assert.ok(rideId(t, "x") < rideId(t + 1000, "x"));
  assert.equal(rideId(t, "Éifel & co ".repeat(10)).length <= 19 + 1 + 40, true);
});

const meta = (extra: Partial<RideMeta> = {}): RideMeta => ({
  id: "2026-10-19T09-30-05-loop",
  roadbookId: "pays-des-collines-abc",
  roadbookName: 'Pays "des" <Collines> & co',
  startedAt: Date.UTC(2026, 9, 19, 9, 30, 5),
  endedAt: Date.UTC(2026, 9, 19, 11, 35, 5),
  distanceM: 123_456,
  points: 3,
  state: "stopped",
  ...extra,
});
const points = (): TrackPoint[] =>
  drawLine([{ straight: 300 }]).map(([lat, lon], i) => ({
    lat,
    lon,
    time: Date.UTC(2026, 9, 19, 9, 30, 5) + i * 1000,
    speedMps: i === 0 ? null : 12.34,
  }));

test("the ride is a GPX any program reads: the track back out, and nothing that breaks the XML", () => {
  const pts = points();
  const gpx = rideToGpx(meta(), pts);
  const back = parseGpx(gpx);
  assert.equal(back.line.length, pts.length);
  assert.ok(Math.abs(back.line[10]![0] - pts[10]!.lat) < 1e-6);
  assert.match(gpx, /<gpx version="1\.1"/);
  assert.match(gpx, /<time>2026-10-19T09:30:05\.000Z<\/time>/);
  assert.match(gpx, /<motoride:speed>12\.3<\/motoride:speed>/);
  assert.match(gpx, /name="Pays &quot;des&quot; &lt;Collines&gt; &amp; co"/);
  assert.doesNotMatch(gpx, /<Collines>/);
});

test("the GPX says which roadbook it followed, with agentRide's own number and name when it came from there", () => {
  const plain = rideToGpx(meta(), points());
  assert.match(plain, /<motoride:ride roadbook="pays-des-collines-abc"/);
  assert.match(plain, /state="stopped"/);
  assert.match(plain, /distanceM="123456"/);
  assert.doesNotMatch(plain, /source=/);
  const from = rideToGpx(
    meta({ origin: { app: "agentRide", roadbook: 7, ride: 12, name: "Pays des Collines" } }),
    points(),
  );
  assert.match(from, /source="agentRide" sourceRoadbook="7" sourceRide="12" sourceName="Pays des Collines"/);
});

test("a roadbook file's origin is read, and a damaged one is dropped", () => {
  const line = drawLine([{ straight: 500 }]);
  const rb = parseRoadbookFile(
    roadbookFile(line, { origin: { app: "agentRide", roadbook: 7, name: "Pays des Collines", extra: 1 } }),
  );
  assert.deepEqual(rb.origin, { app: "agentRide", roadbook: 7, name: "Pays des Collines" });
  assert.equal(parseRoadbookFile(roadbookFile(line, { origin: { roadbook: 7 } })).origin, undefined);
  assert.equal(
    parseRoadbookFile(roadbookFile(line, { origin: { app: "x", roadbook: -1, ride: 1.5 } })).origin?.roadbook,
    undefined,
  );
  assert.equal(parseRoadbookFile(roadbookFile(line)).origin, undefined);
});

test("what the list needs is kept beside the track and read back; anything else is refused", () => {
  const m = meta({ origin: { app: "agentRide", roadbook: 7 } });
  assert.deepEqual(parseMeta(serializeMeta(m)), m);
  for (const bad of [
    "",
    "{",
    "[]",
    `{"v":2}`,
    serializeMeta({ ...m, state: "weird" as never }),
    serializeMeta({ ...m, distanceM: NaN }),
  ])
    assert.equal(parseMeta(bad), null, bad);
});

test("durations are short", () => {
  assert.equal(durationText(48 * 60_000), "48 min");
  assert.equal(durationText(125 * 60_000), "2 h 05");
  assert.equal(durationText(0), "0 min");
});

const reading = (leanDeg: number) => ({
  leanDeg,
  lateralG: Math.tan((leanDeg * Math.PI) / 180),
  brakingG: 0.31,
  peakLeftDeg: 0,
  peakRightDeg: 0,
  turnRate: 0.2,
});

test("a point keeps the altitude when the GPS gave one, and the sensor readings when there are some", () => {
  const plain = pointOf(fix(50, 3, 1000));
  assert.equal("altitudeM" in plain, false);
  assert.equal("leanDeg" in plain, false);
  const withAltitude = pointOf({ ...fix(50, 3, 1000), altitudeM: 212.46 });
  assert.equal(withAltitude.altitudeM, 212.46);
  assert.equal(pointOf({ ...fix(50, 3, 1000), altitudeM: null }).altitudeM, undefined);
  assert.equal(pointOf({ ...fix(50, 3, 1000), altitudeM: NaN }).altitudeM, undefined);
  const full = pointOf({ ...fix(50, 3, 1000), altitudeM: 100 }, reading(30));
  assert.equal(full.leanDeg, 30);
  assert.equal(full.brakingG, 0.31);
  assert.equal(full.turnRate, 0.2);
  assert.ok(Math.abs(full.lateralG! - 0.577) < 0.001);
});

test("the GPX has the elevation in the standard place and the sensor readings as an extension a reader can ignore", () => {
  const pts = points().map((p, i) => ({
    ...p,
    altitudeM: 100 + i * 0.5,
    leanDeg: i % 2 ? -12.34 : 25.6,
    lateralG: 0.456,
    brakingG: -0.2,
    turnRate: 0.1234,
  }));
  const gpx = rideToGpx(meta({ climbM: 12, peakLeftDeg: 26, peakRightDeg: 12 }), pts);
  assert.match(gpx, /<trkpt lat="[\d.]+" lon="[\d.]+"><ele>100\.0<\/ele><time>/);
  assert.match(gpx, /<motoride:lean>25\.6<\/motoride:lean>/);
  assert.match(gpx, /<motoride:lean>-12\.3<\/motoride:lean>/);
  assert.match(gpx, /<motoride:latg>0\.46<\/motoride:latg>/);
  assert.match(gpx, /<motoride:brakeg>-0\.20<\/motoride:brakeg>/);
  assert.match(gpx, /<motoride:turn>0\.123<\/motoride:turn>/);
  assert.match(gpx, /climbM="12" peakLeftDeg="26" peakRightDeg="12"/);
  assert.equal(parseGpx(gpx).line.length, pts.length, "still a track any program reads");
  const plain = rideToGpx(meta(), points());
  assert.doesNotMatch(plain, /<ele>|motoride:lean|climbM|peakLeftDeg/);
});

test("the climb and the peak leans of a ride are summed up only from the readings the track has", () => {
  assert.deepEqual(summarizeTrack(points()), {});
  // 150 points a metre apart-ish climbing 30 m at 54 km/h, leaning both ways
  const track: TrackPoint[] = Array.from({ length: 60 }, (_, i) => ({
    lat: 50 + i * 0.0001,
    lon: 3,
    time: i * 1000,
    speedMps: 15,
    altitudeM: 100 + i * 0.5,
    leanDeg: i === 20 ? 38.2 : i === 40 ? -41.4 : 5,
  }));
  const s = summarizeTrack(track);
  assert.ok(s.climbM! >= 20 && s.climbM! <= 30, `${s.climbM}`);
  assert.equal(s.peakLeftDeg, 38);
  assert.equal(s.peakRightDeg, 41);
  const noLean = summarizeTrack(track.map(({ leanDeg: _l, ...p }) => p));
  assert.equal(noLean.peakLeftDeg, undefined);
  assert.ok(noLean.climbM! > 0);
});

test("the list says the climb and the leans when the ride has them, and nothing otherwise", () => {
  assert.equal(rideExtras(meta()), null);
  assert.equal(rideExtras(meta({ climbM: 412 })), "Climb 412 m");
  assert.equal(rideExtras(meta({ peakLeftDeg: 38, peakRightDeg: 41 })), "Lean 38° L · 41° R");
  assert.equal(
    rideExtras(meta({ climbM: 412, peakLeftDeg: 38, peakRightDeg: 41 })),
    "Climb 412 m · Lean 38° L · 41° R",
  );
});

test("the climb and the peaks are read back with the meta, and a damaged one is dropped", () => {
  const m = meta({ climbM: 412, peakLeftDeg: 38, peakRightDeg: 41 });
  assert.deepEqual(parseMeta(serializeMeta(m)), m);
  const damaged = JSON.stringify({ v: 1, ...m, climbM: "high", peakLeftDeg: null });
  const back = parseMeta(damaged)!;
  assert.equal(back.climbM, undefined);
  assert.equal(back.peakLeftDeg, undefined);
  assert.equal(back.peakRightDeg, 41);
});

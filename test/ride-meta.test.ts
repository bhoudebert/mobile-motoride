import assert from "node:assert/strict";
import { test } from "node:test";
import { rideToGpx, serializeMeta, parseMeta, type RideMeta, type TrackPoint } from "../src/core/recording.ts";
import { metaFromGpx } from "../src/core/review.ts";

const t0 = Date.UTC(2026, 9, 31, 9, 0, 0);
const points: TrackPoint[] = Array.from({ length: 50 }, (_, i) => ({
  lat: 50.45 + i * 0.0002,
  lon: 3.2 + i * 0.0003,
  time: t0 + i * 1000,
  speedMps: 17.4,
  altitudeM: 40 + i * 0.5,
}));
const meta: RideMeta = {
  id: "2026-10-31T09-00-00-pays-des-collines-loop",
  roadbookId: "pays-des-collines-loop-1cjjl60",
  roadbookName: "Pays des Collines & co",
  origin: { app: "agentRide", roadbook: 1, ride: 3, name: "Pays des Collines & co" },
  startedAt: t0,
  endedAt: t0 + 49_000,
  distanceM: 1234,
  points: 50,
  state: "completed",
  climbM: 24.5,
};

test("the summary of a ride is rebuilt from its GPX as it was, with a name that needs escaping", () => {
  const rebuilt = metaFromGpx(meta.id, rideToGpx(meta, points));
  assert.deepEqual(rebuilt, meta);
  // And the rebuilt summary is one the list reads back.
  assert.deepEqual(parseMeta(serializeMeta(rebuilt!)), meta);
});

test("a ride that followed no roadbook has no origin and no id, and is still a ride", () => {
  const free: RideMeta = { ...meta, roadbookId: "", roadbookName: "Evening ride" };
  delete free.origin;
  const rebuilt = metaFromGpx(free.id, rideToGpx(free, points))!;
  assert.equal(rebuilt.origin, undefined);
  assert.equal(rebuilt.roadbookId, "");
  assert.equal(rebuilt.roadbookName, "Evening ride");
  assert.ok(parseMeta(serializeMeta(rebuilt)));
});

test("a GPX with no motoride block is read from its points: times, distance, recovered", () => {
  const foreign = `<?xml version="1.0"?><gpx version="1.1"><trk><name>Sunday</name><trkseg>${points
    .map((p) => `<trkpt lat="${p.lat}" lon="${p.lon}"><time>${new Date(p.time).toISOString()}</time></trkpt>`)
    .join("")}</trkseg></trk></gpx>`;
  const rebuilt = metaFromGpx("sunday", foreign)!;
  assert.equal(rebuilt.state, "recovered");
  assert.equal(rebuilt.startedAt, t0);
  assert.equal(rebuilt.endedAt, t0 + 49_000);
  assert.equal(rebuilt.points, 50);
  assert.ok(rebuilt.distanceM > 500 && rebuilt.distanceM < 2000);
  assert.equal(rebuilt.roadbookName, "sunday");
});

test("a file cut in the middle is rebuilt from the points it has, and one without two points is not a ride", () => {
  const whole = rideToGpx(meta, points);
  const cut = whole.slice(0, whole.indexOf("</trkpt>", whole.indexOf("<time>2026-10-31T09:00:30")) + 8);
  const rebuilt = metaFromGpx(meta.id, cut)!;
  assert.ok(rebuilt.points >= 30 && rebuilt.points < 50);
  assert.equal(rebuilt.roadbookName, "Pays des Collines & co");
  assert.equal(metaFromGpx("x", whole.slice(0, whole.indexOf("<trkpt"))), null);
});

test("the upload mark of a ride is kept when it is valid and dropped when it is not", () => {
  const read = (extra: Record<string, unknown>) => parseMeta(JSON.stringify({ v: 1, ...meta, ...extra }));
  const ok = read({ uploadedAt: t0 + 5000, serverRideId: meta.id })!;
  assert.equal(ok.uploadedAt, t0 + 5000);
  assert.equal(ok.serverRideId, meta.id);
  const bad = read({ uploadedAt: "yesterday", serverRideId: 7 })!;
  assert.equal(bad.uploadedAt, undefined);
  assert.equal(bad.serverRideId, undefined);
  // A summary written before there was an upload has none of it: a ride on the phone only.
  assert.equal(parseMeta(serializeMeta(meta))!.uploadedAt, undefined);
});

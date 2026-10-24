import assert from "node:assert/strict";
import { test } from "node:test";
import {
  camerasFromElements,
  cameraBearing,
  completed,
  effectiveLimit,
  foundFromTraces,
  needsCompletion,
  thinIndexes,
  type TraceEdge,
  type TraceResponse,
} from "../src/core/enrich.ts";
import { prepareRoadbook } from "../src/core/roadbook.ts";
import { cumulativeDistances } from "../src/core/track.ts";
import type { LatLon, Roadbook } from "../src/core/types.ts";
import { drawLine } from "./helpers/path.ts";
import { encodePolyline } from "./helpers/polyline.ts";

const line = drawLine([{ straight: 6000 }]); // 1201 points, 5 m apart, going east
const roadbook = (): Roadbook => ({ id: "x", name: "GPX", description: "", stops: [], line });
const cum = cumulativeDistances(line);

/** What the service answers for a matched line: its own shape (every 10th point, a little off) and the edges on it. */
const traceOf = (edges: TraceEdge[], from = 0, to = line.length - 1): TraceResponse => ({
  shape: encodePolyline(
    line.filter((_, i) => i >= from && i <= to && (i - from) % 10 === 0).map(([a, o]) => [a + 0.00001, o] as LatLon),
  ),
  admins: [
    { country_code: "fr", state_code: "HDF" },
    { country_code: "BE", state_code: "WAL" },
  ],
  edges,
});
const edge = (from: number, to: number, extra: Partial<TraceEdge> = {}): TraceEdge => ({
  length: 1,
  road_class: "secondary",
  density: 2,
  names: ["D 938", "Rue de la Gare"],
  begin_shape_index: from,
  end_shape_index: to,
  end_node: { admin_index: 0 },
  ...extra,
});

test("a posted limit is kept, an untagged one is the legal default of the country, capped on minor roads and 50 in town", () => {
  const admins = [
    { country_code: "FR" },
    { country_code: "BE", state_code: "WAL" },
    { country_code: "BE", state_code: "VLG" },
    { country_code: "XX" },
  ];
  const at = (admin: number, extra: Partial<TraceEdge> = {}) =>
    effectiveLimit({ length: 1, end_node: { admin_index: admin }, ...extra }, admins);
  assert.deepEqual(at(0, { speed_limit: 70 }), { kmh: 70, posted: true });
  assert.deepEqual(at(0, { road_class: "secondary" }), { kmh: 80, posted: false });
  assert.equal(at(1, { road_class: "primary" }).kmh, 90);
  assert.equal(at(2, { road_class: "primary" }).kmh, 70);
  assert.equal(at(0, { road_class: "residential" }).kmh, 40);
  assert.equal(at(0, { road_class: "unclassified" }).kmh, 60);
  assert.equal(at(0, { road_class: "secondary", density: 7 }).kmh, 50);
  assert.equal(at(3, { road_class: "secondary" }).kmh, 80);
});

test("the line is thinned to about one point in thirty metres, ends kept", () => {
  const kept = thinIndexes(cum, 30);
  assert.equal(kept[0], 0);
  assert.equal(kept.at(-1), line.length - 1);
  assert.ok(kept.length > 150 && kept.length < 250, `${kept.length}`);
});

test("limits and countries from the traced roads land on the matching places of the line", () => {
  // The shape has 121 points (every 10th): 0..120. Edges: 0-40 (2 km, FR 80), 40-80 (FR posted 50), 80-120 (BE).
  const found = foundFromTraces(line, [
    {
      from: 0,
      to: line.length - 1,
      trace: traceOf([
        edge(0, 40),
        edge(40, 80, { speed_limit: 50 }),
        edge(80, 120, { end_node: { admin_index: 1 }, road_class: "primary" }),
      ]),
    },
  ]);
  const limits = found.limits as Array<{ from: number; to: number; kmh: number; posted: boolean; road: string }>;
  assert.equal(limits.length, 3);
  assert.deepEqual(
    limits.map((l) => [l.kmh, l.posted]),
    [
      [80, false],
      [50, true],
      [90, false],
    ],
  );
  assert.equal(limits[0]!.road, "D 938");
  // Each stretch starts where the one before ends, and falls where it should: a third of the line each, within 10 m.
  assert.equal(limits[0]!.from, 0);
  assert.ok(Math.abs(limits[0]!.to - 400) <= 2, `${limits[0]!.to}`);
  assert.equal(limits[1]!.from, limits[0]!.to);
  assert.ok(Math.abs(limits[1]!.to - 800) <= 2);
  assert.equal(limits[2]!.to, line.length - 1);
  assert.deepEqual(found.countries, [
    { from: 0, to: limits[1]!.to, code: "FR" },
    { from: limits[1]!.to, to: line.length - 1, code: "BE" },
  ]);
});

test("edges of one road under one limit make one stretch, across the pieces the line was sent in", () => {
  const half = 600;
  const found = foundFromTraces(line, [
    { from: 0, to: half, trace: traceOf([edge(0, 30), edge(30, 60)], 0, half) },
    { from: half, to: line.length - 1, trace: traceOf([edge(0, 30), edge(30, 60)], half, line.length - 1) },
  ]);
  const limits = found.limits as Array<{ from: number; to: number }>;
  assert.equal(limits.length, 1);
  assert.equal(limits[0]!.from, 0);
  assert.equal(limits[0]!.to, line.length - 1);
});

const ring = (from: number, to: number, extra: Partial<TraceEdge> = {}): TraceEdge =>
  edge(from, to, { roundabout: true, begin_heading: 90, end_heading: 90, ...extra });

test("a roundabout of the trace is found with its exits relative to the way in and the one taken", () => {
  const node = (...roads: Array<{ begin_heading: number; driveability: "forward" | "backward" | "both" }>) => ({
    admin_index: 0,
    intersecting_edges: roads,
  });
  const found = foundFromTraces(line, [
    {
      from: 0,
      to: line.length - 1,
      trace: traceOf([
        edge(0, 40, { end_heading: 0, end_node: node() }),
        ring(40, 44, {
          end_node: node(
            { begin_heading: 100, driveability: "forward" },
            { begin_heading: 280, driveability: "backward" },
          ),
        }),
        ring(44, 48, { end_node: node({ begin_heading: 200, driveability: "both" }) }),
        edge(48, 120, { begin_heading: 10 }),
      ]),
    },
  ]);
  assert.equal(found.junctions.length, 1);
  const j = found.junctions[0] as { kind: string; at: number; to: number; exits: number[]; take: number };
  assert.equal(j.kind, "roundabout");
  assert.deepEqual(j.exits, [-160, 10, 100]);
  assert.equal(j.take, 1);
  assert.ok(j.at < j.to && Math.abs(j.at - 400) <= 3 && Math.abs(j.to - 480) <= 3, `${j.at} ${j.to}`);
});

test("cameras are read from Overpass elements: limit, direction, and once even if seen twice", () => {
  const cameras = camerasFromElements([
    { type: "node", id: 1, lat: 50.4, lon: 3.2, tags: { highway: "speed_camera", maxspeed: "70", direction: "90" } },
    { type: "node", id: 1, lat: 50.4, lon: 3.2, tags: {} },
    { type: "way", id: 2, center: { lat: 50.41, lon: 3.21 }, tags: { direction: "both" } },
    { type: "node", id: 3, tags: {} },
  ]) as Array<{ kmh: number | null; bearing: number | null; direction: string | null }>;
  assert.equal(cameras.length, 2);
  assert.deepEqual(cameras[0], { lat: 50.4, lon: 3.2, kmh: 70, bearing: 90, direction: null });
  assert.equal(cameras[1]!.direction, "both");
  assert.equal(cameraBearing("NE"), 45);
  assert.equal(cameraBearing("forward"), null);
  assert.equal(cameraBearing("90;270"), null);
});

test("a completed roadbook reads like an agentRide one: limits, countries and cameras, ready to ride", () => {
  const rb = roadbook();
  assert.equal(needsCompletion(rb), true);
  const found = foundFromTraces(line, [{ from: 0, to: line.length - 1, trace: traceOf([edge(0, 120)]) }]);
  const done = completed(rb, found, [
    { lat: line[600]![0], lon: line[600]![1], kmh: 70, bearing: null, direction: null },
  ]);
  assert.equal(needsCompletion(done), false);
  const prepared = prepareRoadbook(done);
  assert.equal(prepared.limitSegments.length, 1);
  assert.equal(prepared.countrySegments[0]!.code, "FR");
  assert.equal(prepared.zones.length, 1);
  assert.equal(prepared.zones[0]!.country, "FR");
  // Without an answer from the camera service, the roadbook is still completed and has no cameras.
  assert.deepEqual(completed(rb, found, null).cameras, []);
});

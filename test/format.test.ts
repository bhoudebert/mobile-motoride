import assert from "node:assert/strict";
import { test } from "node:test";
import { boundsOf, formatDistance, kmh } from "../src/core/format.ts";
import { cornersCollection, lineFeature, riderFeature, stopsCollection } from "../src/core/geojson.ts";
import { prepareRoadbook } from "../src/core/roadbook.ts";
import { drawLine } from "./helpers/path.ts";

test("formatDistance", () => {
  assert.equal(formatDistance(847), "850 m");
  assert.equal(formatDistance(1234), "1.2 km");
  assert.equal(formatDistance(123_456), "123 km");
});

test("kmh", () => {
  assert.equal(kmh(null), null);
  assert.equal(kmh(-1), null);
  assert.equal(kmh(16.7), 60);
});

test("boundsOf is west, south, east, north", () => {
  assert.deepEqual(
    boundsOf([
      [50, 3],
      [51, 2],
      [50.5, 4],
    ]),
    [2, 50, 4, 51],
  );
});

test("map data puts longitude first and keeps only dangerous corners", () => {
  const line = drawLine([
    { straight: 300 },
    { arc: 15, deg: 180, dir: "left" },
    { arc: 100, deg: 90, dir: "right" },
    { straight: 300 },
  ]);
  const rb = prepareRoadbook({
    id: "t",
    name: "T",
    description: "",
    stops: [{ lat: line[0]![0], lon: line[0]![1], name: "Start" }],
    line,
  });
  assert.deepEqual(lineFeature(rb).geometry.coordinates[0], [line[0]![1], line[0]![0]]);
  assert.equal(stopsCollection(rb).features.length, 1);
  const corners = cornersCollection(rb);
  assert.ok(corners.features.length >= 1);
  assert.ok(corners.features.every((f) => f.properties?.["severity"] !== "bend"));
});

test("the rider feature carries longitude first and the bearing", () => {
  const f = riderFeature([50.1, 3.2], 123);
  assert.deepEqual(f.geometry.coordinates, [3.2, 50.1]);
  assert.equal(f.properties?.["bearing"], 123);
});

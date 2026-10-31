import assert from "node:assert/strict";
import { test } from "node:test";
import { routeEndsCollection } from "../src/core/geojson.ts";
import { prepareRoadbook } from "../src/core/roadbook.ts";
import type { Roadbook } from "../src/core/types.ts";

const roadbook = (line: [number, number][]): Roadbook => ({
  id: "r",
  name: "Test",
  description: "",
  stops: [],
  line,
});
const kinds = (line: [number, number][]) =>
  routeEndsCollection(prepareRoadbook(roadbook(line))).features.map((f) => [
    f.properties?.["kind"],
    f.properties?.["icon"],
  ]);

test("a road from one place to another has a start at its first point and a finish at its last", () => {
  const line: [number, number][] = [
    [50.0, 3.0],
    [50.05, 3.05],
    [50.1, 3.1],
  ];
  const ends = routeEndsCollection(prepareRoadbook(roadbook(line)));
  assert.deepEqual(kinds(line), [
    ["finish", "route-finish"],
    ["start", "route-start"],
  ]);
  // GeoJSON is [lon, lat]: the finish at the last point, the start at the first.
  assert.deepEqual(ends.features[0]!.geometry.coordinates, [3.1, 50.1]);
  assert.deepEqual(ends.features[1]!.geometry.coordinates, [3.0, 50.0]);
});

test("a loop has one mark for both ends, at its first point", () => {
  // The last point 200 m from the first: a loop (within 500 m).
  const line: [number, number][] = [
    [50.0, 3.0],
    [50.05, 3.05],
    [50.1, 3.0],
    [50.0018, 3.0],
  ];
  const ends = routeEndsCollection(prepareRoadbook(roadbook(line)));
  assert.deepEqual(kinds(line), [["loop", "route-loop"]]);
  assert.deepEqual(ends.features[0]!.geometry.coordinates, [3.0, 50.0]);
});

test("a line of less than two points has no ends", () => {
  assert.deepEqual(routeEndsCollection(prepareRoadbook(roadbook([[50, 3]]))).features, []);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { directionGradient, nextStretch, ridden, sliceLine } from "../src/core/lineStyle.ts";

test("the share ridden is 0 to 1 and 0 when nothing is known", () => {
  assert.equal(ridden(0, 1000), 0);
  assert.equal(ridden(250, 1000), 0.25);
  assert.equal(ridden(2000, 1000), 1);
  assert.equal(ridden(500, 0), 0);
  assert.equal(ridden(-5, 1000), 0);
});

test("before the start the whole line is the colour ahead, after the end the colour behind", () => {
  assert.deepEqual(directionGradient(0, "b", "a"), ["interpolate", ["linear"], ["line-progress"], 0, "a", 1, "a"]);
  assert.deepEqual(directionGradient(1, "b", "a"), ["interpolate", ["linear"], ["line-progress"], 0, "b", 1, "b"]);
});

test("in between the colour behind changes to the colour ahead at the share ridden, with rising stops", () => {
  const g = directionGradient(0.4567, "b", "a");
  assert.deepEqual(g, ["interpolate", ["linear"], ["line-progress"], 0, "b", 0.456, "b", 0.4561, "a", 1, "a"]);
  const stops = (g as unknown[]).filter((_, i) => i >= 3 && i % 2 === 1) as number[];
  assert.deepEqual(
    [...stops].sort((x, y) => x - y),
    stops,
  );
  assert.equal(new Set(stops).size, stops.length);
});

test("the style changes a thousandth at a time, not on every metre", () => {
  assert.deepEqual(directionGradient(0.4561, "b", "a"), directionGradient(0.4569, "b", "a"));
});

test("a share outside 0 to 1 is held to it", () => {
  assert.deepEqual(directionGradient(-3, "b", "a"), directionGradient(0, "b", "a"));
  assert.deepEqual(directionGradient(7, "b", "a"), directionGradient(1, "b", "a"));
});

// A straight line east along the equator, a point every 1000 m (111.32 km per degree of longitude there is not needed: the
// distances are given, not computed).
const line: [number, number][] = [0, 1, 2, 3, 4].map((i) => [0, i * 0.01]);
const cumulative = [0, 1000, 2000, 3000, 4000];

test("a slice runs from one distance to another, the ends cut on the line, the points between kept", () => {
  assert.deepEqual(sliceLine(line, cumulative, 500, 2500), [
    [0, 0.005],
    [0, 0.01],
    [0, 0.02],
    [0, 0.025],
  ]);
});

test("a slice on a vertex has no doubled point, and one beyond the end stops at the end", () => {
  assert.deepEqual(sliceLine(line, cumulative, 1000, 2000), [
    [0, 0.01],
    [0, 0.02],
  ]);
  assert.deepEqual(sliceLine(line, cumulative, 3500, 9000), [
    [0, 0.035],
    [0, 0.04],
  ]);
});

test("an empty or reversed span gives no line", () => {
  assert.deepEqual(sliceLine(line, cumulative, 2000, 2000), []);
  assert.deepEqual(sliceLine(line, cumulative, 3000, 1000), []);
  assert.deepEqual(sliceLine([], [], 0, 10), []);
});

test("the bright stretch starts at the last 50 m step and is 3 km long, held to the end of the roadbook", () => {
  assert.deepEqual(nextStretch(0, 20_000), { fromM: 0, toM: 3000 });
  assert.deepEqual(nextStretch(1234, 20_000), { fromM: 1200, toM: 4200 });
  assert.deepEqual(nextStretch(19_000, 20_000), { fromM: 19_000, toM: 20_000 });
  assert.deepEqual(nextStretch(25_000, 20_000), { fromM: 20_000, toM: 20_000 });
});

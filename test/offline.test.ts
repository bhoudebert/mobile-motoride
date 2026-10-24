import assert from "node:assert/strict";
import { test } from "node:test";
import { PACK_MAX_TILES, paddedBounds, packKey, planPack, tilesAt, tilesIn } from "../src/core/offline.ts";
import type { LatLon } from "../src/core/types.ts";

const line = (a: LatLon, b: LatLon): LatLon[] => [a, b];

test("tilesAt counts the tiles that cover the bounds, one at level 0", () => {
  assert.equal(tilesAt([-179, -60, 179, 60], 0), 1);
  assert.equal(tilesAt([-179, -60, 179, 60], 1), 4);
  assert.ok(tilesIn([3, 50, 3.1, 50.1], 8, 10) > 3);
});

test("the bounds are wider than the line by the margin on every side", () => {
  const [w, s, e, n] = paddedBounds(line([50, 3], [50.1, 3.1]), 3000);
  assert.ok(s < 50 - 0.02 && n > 50.1 + 0.02);
  assert.ok(w < 3 - 0.03 && e > 3.1 + 0.03);
});

test("a day loop is saved down to the highest level, a continent is too long to save", () => {
  const loop = planPack(line([50.4, 3.0], [50.7, 3.6]));
  assert.ok(loop);
  assert.equal(loop.maxZoom, 14);
  assert.ok(loop.tiles <= PACK_MAX_TILES);
  assert.equal(loop.minZoom, 8);
  assert.equal(planPack(line([40, -5], [55, 15])), null);
});

test("a long ride gives up the finest levels before giving up", () => {
  const plan = planPack(line([50.0, 2.0], [51.2, 5.5]));
  assert.ok(plan);
  assert.ok(plan.maxZoom < 14 && plan.maxZoom >= 10);
  assert.ok(plan.tiles <= PACK_MAX_TILES);
});

test("a saved map is known by its roadbook and basemap", () => {
  assert.equal(packKey("loop", "light"), "loop:light");
  assert.notEqual(packKey("loop", "light"), packKey("loop", "colour"));
});

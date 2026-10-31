import assert from "node:assert/strict";
import { test } from "node:test";
import { hudWidth, isLandscape } from "../src/core/layout.ts";

test("a window wider than it is tall is landscape", () => {
  assert.equal(isLandscape(844, 390), true);
  assert.equal(isLandscape(390, 844), false);
  assert.equal(isLandscape(500, 500), false);
});

test("the panel column is two fifths of the width, between 300 and 400", () => {
  assert.equal(hudWidth(667), 300);
  assert.equal(hudWidth(844), 338);
  assert.equal(hudWidth(932), 373);
  assert.equal(hudWidth(1280), 400);
});

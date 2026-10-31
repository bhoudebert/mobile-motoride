import assert from "node:assert/strict";
import { test } from "node:test";
import { hudWidth, isLandscape } from "../src/core/layout.ts";

test("a window wider than it is tall is landscape", () => {
  assert.equal(isLandscape(844, 390), true);
  assert.equal(isLandscape(390, 844), false);
  assert.equal(isLandscape(500, 500), false);
});

test("the panel column is 37 % of the width, between 290 and 380", () => {
  assert.equal(hudWidth(667), 290);
  assert.equal(hudWidth(844), 312);
  assert.equal(hudWidth(932), 345);
  assert.equal(hudWidth(1280), 380);
});

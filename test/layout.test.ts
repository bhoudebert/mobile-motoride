import assert from "node:assert/strict";
import { test } from "node:test";
import { hudWidth, isLandscape } from "../src/core/layout.ts";

test("a window wider than it is tall is landscape", () => {
  assert.equal(isLandscape(844, 390), true);
  assert.equal(isLandscape(390, 844), false);
  assert.equal(isLandscape(500, 500), false);
});

test("the panel column is a third of the width, between 260 and 340", () => {
  assert.equal(hudWidth(667), 260);
  assert.equal(hudWidth(844), 287);
  assert.equal(hudWidth(932), 317);
  assert.equal(hudWidth(1280), 340);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { swipeOf } from "../src/core/swipe.ts";

test("a long vertical drag is a swipe, up or down", () => {
  assert.equal(swipeOf(0, -60), "up");
  assert.equal(swipeOf(5, 60), "down");
});

test("a tap, a short drag and a sideways drag are not swipes", () => {
  assert.equal(swipeOf(0, 0), null);
  assert.equal(swipeOf(0, -35), null);
  assert.equal(swipeOf(80, -60), null);
  assert.equal(swipeOf(-100, 50), null);
});

test("the length threshold is inclusive and the slope is 1.5 to 1", () => {
  assert.equal(swipeOf(0, -36), "up");
  assert.equal(swipeOf(40, -60), "up");
  assert.equal(swipeOf(41, -60), null);
});

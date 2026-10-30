import assert from "node:assert/strict";
import { test } from "node:test";
import { isSwipeBack } from "../src/core/swipeBack.ts";

test("a sweep from the left edge to the right is a swipe back", () => {
  assert.equal(isSwipeBack(10, 400, 160, 420), true);
});

test("a swipe that starts away from the edge, is too short, goes the wrong way or is a scroll is not", () => {
  assert.equal(isSwipeBack(200, 400, 360, 400), false);
  assert.equal(isSwipeBack(10, 400, 50, 400), false);
  assert.equal(isSwipeBack(10, 400, -100, 400), false);
  assert.equal(isSwipeBack(10, 400, 120, 700), false);
});

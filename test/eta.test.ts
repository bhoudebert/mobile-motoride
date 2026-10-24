import assert from "node:assert/strict";
import { test } from "node:test";
import { etaOf, formatDuration, nextPace } from "../src/core/eta.ts";

test("the pace follows the speed while moving and keeps still while standing", () => {
  assert.equal(nextPace(null, null), null);
  assert.equal(nextPace(null, 1), null);
  assert.equal(nextPace(null, 20), 20);
  assert.equal(nextPace(20, 0), 20);
  const p = nextPace(20, 30)!;
  assert.ok(p > 20 && p < 21);
});

test("the time left comes from the pace, the assumed one before the rider moves, kept within sane bounds", () => {
  const now = Date.UTC(2026, 0, 1, 12, 0);
  assert.deepEqual(etaOf(96_000, null, now), { seconds: 6000, arrivalMs: now + 6_000_000 });
  assert.equal(etaOf(96_000, 24, now).seconds, 4020);
  assert.equal(etaOf(96_000, 1, now).seconds, 12_000);
  assert.equal(etaOf(96_000, 90, now).seconds, 3180);
  assert.equal(etaOf(0, 20, now).seconds, 0);
});

test("a duration reads in minutes under an hour and as hours and minutes after", () => {
  assert.equal(formatDuration(0), "1 min");
  assert.equal(formatDuration(45 * 60), "45 min");
  assert.equal(formatDuration(2 * 3600 + 5 * 60), "2h05");
  assert.equal(formatDuration(3600), "1h00");
});

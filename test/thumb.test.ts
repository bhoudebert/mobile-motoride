import assert from "node:assert/strict";
import { test } from "node:test";
import { thumbSegments } from "../src/core/thumb.ts";
import type { LatLon } from "../src/core/types.ts";

const square: LatLon[] = [
  [50, 4],
  [50, 4.01],
  [50.01, 4.01],
  [50.01, 4],
  [50, 4],
];

test("a line fits the box with room all round and keeps its proportions", () => {
  const segs = thumbSegments(square, 200, 100, 10);
  assert.equal(segs.length, 4);
  for (const s of segs) {
    assert.ok(s.x >= 10 - 1e-6 && s.x <= 190 + 1e-6, `x ${s.x}`);
    assert.ok(s.y >= 10 - 1e-6 && s.y <= 90 + 1e-6, `y ${s.y}`);
  }
  // A degree of longitude is shorter than one of latitude at 50 degrees: the east-west sides are the shorter ones.
  assert.ok(segs[0]!.length < segs[1]!.length);
});

test("north is up: going north draws upward", () => {
  const [a] = thumbSegments(
    [
      [50, 4],
      [50.01, 4],
    ],
    100,
    100,
  );
  assert.ok(Math.abs(a!.angle + Math.PI / 2) < 1e-9);
});

test("a long line is cut down to a few dozen points", () => {
  const long: LatLon[] = Array.from({ length: 5000 }, (_, i) => [50 + Math.sin(i / 50) * 0.01, 4 + i * 1e-5]);
  assert.ok(thumbSegments(long, 300, 150, 12, 48).length <= 49);
});

test("nothing to draw for a point, an empty box or no line", () => {
  assert.deepEqual(thumbSegments([[50, 4]], 100, 100), []);
  assert.deepEqual(thumbSegments(square, 10, 10, 12), []);
  assert.deepEqual(thumbSegments([], 100, 100), []);
});

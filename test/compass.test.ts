import assert from "node:assert/strict";
import { test } from "node:test";
import { needleDeg, pointOf, wrapDeg } from "../src/core/compass.ts";

test("a heading is wrapped to 0 up to 360", () => {
  assert.equal(wrapDeg(360), 0);
  assert.equal(wrapDeg(-90), 270);
  assert.equal(wrapDeg(725), 5);
});

test("each point covers 45 degrees centred on it, north across zero", () => {
  const cases: [number, string][] = [
    [0, "n"],
    [22.4, "n"],
    [22.5, "ne"],
    [45, "ne"],
    [90, "e"],
    [135, "se"],
    [180, "s"],
    [225, "sw"],
    [270, "w"],
    [315, "nw"],
    [337.4, "nw"],
    [337.5, "n"],
    [359.9, "n"],
    [-90, "w"],
    [450, "e"],
  ];
  for (const [deg, point] of cases) assert.equal(pointOf(deg), point, `${deg}`);
});

test("the needle turns against the heading, so it points to the north of a screen turned along it", () => {
  assert.equal(needleDeg(0), 0);
  assert.equal(needleDeg(90), 270);
  assert.equal(needleDeg(270), 90);
  assert.equal(needleDeg(180), 180);
});

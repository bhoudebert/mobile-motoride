import assert from "node:assert/strict";
import { test } from "node:test";
import { advisoryKmh, detectCorners, severityOf } from "../src/core/corners.ts";
import { cumulativeDistances } from "../src/core/track.ts";
import { drawLine, noise } from "./helpers/path.ts";
import type { LatLon } from "../src/core/types.ts";

const corners = (line: LatLon[]) => detectCorners(line, cumulativeDistances(line));

test("a straight road has no corner", () => {
  assert.deepEqual(corners(drawLine([{ straight: 2000 }])), []);
});

test("a half-circle of 15 m radius is one left hairpin", () => {
  const found = corners(drawLine([{ straight: 300 }, { arc: 15, deg: 180, dir: "left" }, { straight: 300 }]));
  assert.equal(found.length, 1);
  const c = found[0]!;
  assert.equal(c.severity, "hairpin");
  assert.equal(c.direction, "left");
  assert.ok(c.minRadiusM > 12 && c.minRadiusM < 18, `radius ${c.minRadiusM}`);
  assert.ok(c.angleDeg > 150 && c.angleDeg < 210, `angle ${c.angleDeg}`);
  assert.ok(c.startM < 300 + 5 && c.endM > 300 + 40);
});

test("direction follows the turn", () => {
  const found = corners(drawLine([{ straight: 300 }, { arc: 40, deg: 90, dir: "right" }, { straight: 300 }]));
  assert.equal(found.length, 1);
  assert.equal(found[0]!.direction, "right");
  assert.equal(found[0]!.severity, "sharp");
});

test("a 90 degree junction turn of 15 m radius is sharp, not a hairpin", () => {
  const found = corners(drawLine([{ straight: 300 }, { arc: 15, deg: 90, dir: "right" }, { straight: 300 }]));
  assert.equal(found.length, 1);
  assert.equal(found[0]!.severity, "sharp");
});

test("a gentle 200 m radius curve is not a corner", () => {
  assert.deepEqual(corners(drawLine([{ straight: 300 }, { arc: 200, deg: 90, dir: "left" }, { straight: 300 }])), []);
});

test("a 100 m radius curve is a bend, reported but never a warning severity", () => {
  const found = corners(drawLine([{ straight: 300 }, { arc: 100, deg: 90, dir: "left" }, { straight: 300 }]));
  assert.equal(found.length, 1);
  assert.equal(found[0]!.severity, "bend");
});

test("GPS jitter on a straight does not make corners", () => {
  const rnd = noise(7);
  const line = drawLine([{ straight: 3000 }], 10).map(([lat, lon]): LatLon => [lat + rnd() * 0.00003, lon]); // about 3 m
  assert.deepEqual(corners(line), []);
});

test("two corners in opposite directions stay two", () => {
  const found = corners(
    drawLine([
      { straight: 200 },
      { arc: 30, deg: 90, dir: "left" },
      { straight: 15 },
      { arc: 30, deg: 90, dir: "right" },
      { straight: 200 },
    ]),
  );
  assert.equal(found.length, 2);
  assert.deepEqual(
    found.map((c) => c.direction),
    ["left", "right"],
  );
});

test("severity and advisory speed", () => {
  assert.equal(severityOf(24.9, 180), "hairpin");
  assert.equal(severityOf(24.9, 99), "sharp");
  assert.equal(severityOf(25, 180), "sharp");
  assert.equal(severityOf(59, 44), "bend");
  assert.equal(severityOf(60, 180), "bend");
  assert.equal(advisoryKmh(15), 20); // sqrt(3*15) = 6.7 m/s = 24 km/h
  assert.equal(advisoryKmh(60), 45); // 13.4 m/s = 48 km/h
  assert.equal(advisoryKmh(1), 10); // never below 10
});

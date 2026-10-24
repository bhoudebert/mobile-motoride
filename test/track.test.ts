import assert from "node:assert/strict";
import { test } from "node:test";
import { haversineM } from "../src/core/geo.ts";
import { cumulativeDistances, pointAt, resample, snapToLine } from "../src/core/track.ts";
import { drawLine } from "./helpers/path.ts";

test("cumulative distance of a 1 km straight", () => {
  const line = drawLine([{ straight: 1000 }]);
  const cum = cumulativeDistances(line);
  assert.ok(Math.abs((cum.at(-1) ?? 0) - 1000) < 1);
});

test("pointAt and resample stay on the line", () => {
  const line = drawLine([{ straight: 1000 }]);
  const cum = cumulativeDistances(line);
  assert.ok(Math.abs(haversineM(line[0]!, pointAt(line, cum, 500)) - 500) < 1);
  assert.deepEqual(pointAt(line, cum, -5), line[0]);
  assert.deepEqual(pointAt(line, cum, 1e9), line.at(-1));
  const pts = resample(line, cum, 10);
  assert.ok(pts.length >= 100 && pts.length <= 102);
  assert.deepEqual(pts.at(-1)?.point, line.at(-1));
});

test("snap reports progress and offset", () => {
  const line = drawLine([{ straight: 1000 }]);
  const cum = cumulativeDistances(line);
  const onLine = pointAt(line, cum, 400);
  const beside: [number, number] = [onLine[0] + 0.0001, onLine[1]]; // about 11 m north
  const snap = snapToLine(line, cum, beside);
  assert.ok(Math.abs(snap.progressM - 400) < 2);
  assert.ok(snap.offsetM > 9 && snap.offsetM < 13);
});

test("a loop's start is not mistaken for its finish", () => {
  const line = drawLine([
    { straight: 500 },
    { arc: 100, deg: 180, dir: "left" },
    { straight: 500 },
    { arc: 100, deg: 180, dir: "left" },
  ]);
  const cum = cumulativeDistances(line);
  assert.ok(snapToLine(line, cum, line[0]!).progressM < 1);
});

test("a window keeps the second pass of a crossing apart from the first", () => {
  // Figure of eight style: out and back over the same road.
  const line = drawLine([{ straight: 1000 }, { arc: 2, deg: 180, dir: "left" }, { straight: 1000 }]);
  const cum = cumulativeDistances(line);
  const total = cum.at(-1) ?? 0;
  const spot = pointAt(line, cum, 500);
  const first = snapToLine(line, cum, spot, 400, 1500);
  const second = snapToLine(line, cum, spot, 1100, total);
  assert.ok(Math.abs(first.progressM - 500) < 2);
  assert.ok(Math.abs(second.progressM - (total - 500)) < 3);
});

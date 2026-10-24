import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CAMERA_POLICIES,
  countryAt,
  policyOf,
  spanText,
  stricter,
  zoneLengthM,
  zoneShare,
} from "../src/core/cameraPolicy.ts";

test("the policy by country follows the research, and an unknown country is off", () => {
  assert.equal(policyOf("FR"), "zones");
  for (const c of ["BE", "LU", "NL", "ES"]) assert.equal(policyOf(c), "exact", c);
  for (const c of ["DE", "CH"]) assert.equal(policyOf(c), "off", c);
  assert.equal(policyOf("be"), "exact");
  assert.equal(policyOf("XX"), "off");
  assert.equal(policyOf(null), "off");
  assert.equal(policyOf(undefined), "off");
  assert.ok(Object.keys(CAMERA_POLICIES).every((c) => /^[A-Z]{2}$/.test(c)));
});

test("between a camera's country and the rider's, the stricter policy wins", () => {
  assert.equal(stricter("exact", "zones"), "zones");
  assert.equal(stricter("zones", "exact"), "zones");
  assert.equal(stricter("exact", "off"), "off");
  assert.equal(stricter("off", "zones"), "off");
  assert.equal(stricter("exact", "exact"), "exact");
});

test("a French zone is at least 300 m in town, 2 km on a road and 4 km on a motorway", () => {
  assert.equal(zoneLengthM(30), 300);
  assert.equal(zoneLengthM(50), 300);
  assert.equal(zoneLengthM(70), 2000);
  assert.equal(zoneLengthM(90), 2000);
  assert.equal(zoneLengthM(110), 4000);
  assert.equal(zoneLengthM(130), 4000);
  assert.equal(zoneLengthM(null), 2000);
});

test("a camera is never at the middle of its zone, and always at the same place in it", () => {
  const shares = new Set<number>();
  for (let i = 0; i < 200; i++) {
    const s = zoneShare(50 + i / 1000, 3 + i / 777);
    assert.ok(s >= 0.25 && s <= 0.75, `${s}`);
    shares.add(Math.round(s * 100));
  }
  assert.ok(shares.size > 20, "the share varies from camera to camera");
  assert.equal(zoneShare(50.4, 3.2), zoneShare(50.4, 3.2));
});

test("the country is read from the stretches, and is null where the roadbook is silent", () => {
  const segments = [
    { startM: 0, endM: 1000, code: "BE" },
    { startM: 1000, endM: 3000, code: "FR" },
  ];
  assert.equal(countryAt(segments, 0), "BE");
  assert.equal(countryAt(segments, 999), "BE");
  assert.equal(countryAt(segments, 1000), "FR");
  assert.equal(countryAt(segments, 3000), "FR");
  assert.equal(countryAt(segments, 3001), null);
  assert.equal(countryAt([], 10), null);
});

test("the length of a zone is said in metres or kilometres", () => {
  assert.equal(spanText(300), "300 metres");
  assert.equal(spanText(2000), "2 kilometres");
  assert.equal(spanText(2500), "2.5 kilometres");
  assert.equal(spanText(4000), "4 kilometres");
  assert.equal(spanText(1000), "1 kilometre");
});

import { camerasCollection } from "../src/core/geojson.ts";
import { prepareRoadbook } from "../src/core/roadbook.ts";
import { parseRoadbookFile } from "../src/core/roadbookFile.ts";
import { drawLine } from "./helpers/path.ts";
import { roadbookFile } from "./helpers/polyline.ts";

const line = drawLine([{ straight: 4000 }]);
const cam = { lat: line[400]![0], lon: line[400]![1], kmh: 70, direction: null };

test("the countries of a roadbook file are read, upper-cased and ordered; damaged ones are dropped", () => {
  const rb = parseRoadbookFile(
    roadbookFile(line, {
      countries: [
        { from: 400, to: 800, code: "fr" },
        { from: 0, to: 400, code: "BE" },
        { from: 5, to: 5, code: "DE" },
        { from: 0, to: 9999, code: "NL" },
        { from: 0, to: 10, code: "BEL" },
        { from: 0, to: 10 },
        "x",
      ],
    }),
  );
  assert.deepEqual(rb.countries, [
    { from: 0, to: 400, code: "BE" },
    { from: 400, to: 800, code: "FR" },
  ]);
  assert.deepEqual(parseRoadbookFile(roadbookFile(line, { countries: "FR" })).countries, []);
});

test("cameras are drawn only where the camera's country and the rider's both give their place", () => {
  const rb = prepareRoadbook(
    parseRoadbookFile(roadbookFile(line, { cameras: [cam], countries: [{ from: 0, to: 800, code: "BE" }] })),
  );
  assert.equal(camerasCollection(rb, "BE").features.length, 1);
  assert.equal(camerasCollection(rb, "FR").features.length, 0, "a rider in France is not shown where it is");
  assert.equal(camerasCollection(rb, "DE").features.length, 0);
  assert.equal(camerasCollection(rb, null).features.length, 0, "no rider, nothing");
  const fr = prepareRoadbook(
    parseRoadbookFile(roadbookFile(line, { cameras: [cam], countries: [{ from: 0, to: 800, code: "FR" }] })),
  );
  assert.equal(camerasCollection(fr, "BE").features.length, 0, "a French camera is never placed");
  const feature = camerasCollection(rb, "BE").features[0]!;
  assert.ok(Math.abs(feature.geometry.coordinates[1]! - cam.lat) < 0.0005);
});

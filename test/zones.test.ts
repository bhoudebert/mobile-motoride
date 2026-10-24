import assert from "node:assert/strict";
import { test } from "node:test";
import { withApproach } from "../src/core/approach.ts";
import { createNavigator } from "../src/core/navigator.ts";
import { parseRoadbookFile } from "../src/core/roadbookFile.ts";
import { prepareRoadbook } from "../src/core/roadbook.ts";
import { pointAt } from "../src/core/track.ts";
import { drawLine, fixAt } from "./helpers/path.ts";
import { roadbookFile } from "./helpers/polyline.ts";
import type { LatLon, PreparedRoadbook } from "../src/core/types.ts";

const straight = () => drawLine([{ straight: 4000 }]);
const camera = (line: LatLon[], index: number, extra: Record<string, unknown> = {}) => ({
  lat: line[index]![0],
  lon: line[index]![1],
  kmh: 70,
  direction: null,
  ...extra,
});
const prep = (cameras: unknown[], line = straight()): PreparedRoadbook =>
  prepareRoadbook(parseRoadbookFile(roadbookFile(line, { cameras })));
const at = (rb: PreparedRoadbook, m: number): LatLon => pointAt(rb.roadbook.line, rb.cumulativeM, m);

test("a camera on the line becomes a zone at its place", () => {
  const line = straight();
  const rb = prep([camera(line, 400)]);
  assert.equal(rb.zones.length, 1);
  assert.ok(Math.abs(rb.zones[0]!.atM - 2000) < 5);
});

test("a camera on another road is not a zone", () => {
  const line = straight();
  const beside = camera(line, 400, { lat: line[400]![0] + 0.0009 }); // about 100 m north
  assert.equal(prep([beside]).zones.length, 0);
  assert.equal(
    prep([camera(line, 500, { direction: "both" }), camera(line, 600, { direction: null })]).zones.length,
    2,
  );
});

test("cameras within 150 m make one zone", () => {
  const line = straight();
  const rb = prep([camera(line, 400), camera(line, 420), camera(line, 600)]);
  assert.equal(rb.zones.length, 2);
});

test("a camera where its place may be given is warned once, within 600 m, with its distance", () => {
  const line = straight();
  const rb = prep([camera(line, 400)]);
  const nav = createNavigator(rb);
  const ride = (m: number, time: number) => nav.update(fixAt(at(rb, m), 60, time));
  assert.equal(ride(1000, 0).zoneWarning, null);
  const warned = ride(1450, 1000).zoneWarning;
  assert.ok(warned);
  assert.equal(warned!.text, "Speed camera, 550 metres");
  assert.equal(warned!.kind, "camera");
  assert.equal(warned!.kmh, 70);
  assert.equal(ride(1500, 2000).zoneWarning, null);
  assert.equal(ride(1900, 3000).zoneWarning, null);
});

test("each zone warns in turn, after the one before has been passed", () => {
  const line = straight();
  const rb = prep([camera(line, 300), camera(line, 700)]);
  const nav = createNavigator(rb);
  const warnings: string[] = [];
  for (let m = 500; m < 3500; m += 20) {
    const w = nav.update(fixAt(at(rb, m), 60, m)).zoneWarning;
    if (w) warnings.push(w.text);
  }
  assert.equal(warnings.length, 2);
});

test("with danger zones off nothing is warned", () => {
  const line = straight();
  const rb = prep([camera(line, 400)]);
  const nav = createNavigator(rb, { dangerZones: false });
  for (let m = 1000; m < 2200; m += 50) assert.equal(nav.update(fixAt(at(rb, m), 60, m)).zoneWarning, null);
});

test("no zone warning while off route", () => {
  const line = straight();
  const rb = prep([camera(line, 400)]);
  const nav = createNavigator(rb);
  const base = at(rb, 1500);
  const far: LatLon = [base[0] + 0.002, base[1]];
  nav.update(fixAt(base, 60, 0));
  nav.update(fixAt(far, 60, 1000));
  nav.update(fixAt(far, 60, 2000));
  const s = nav.update(fixAt(far, 60, 3000));
  assert.equal(s.offRoute, true);
  assert.equal(s.zoneWarning, null);
});

test("a corner warning on the same fix keeps the zone's for the next fix", () => {
  const line = drawLine([{ straight: 2000 }, { arc: 15, deg: 180, dir: "left" }, { straight: 600 }]);
  const rb = prepareRoadbook(parseRoadbookFile(roadbookFile(line, { cameras: [] })));
  const corner = rb.corners.find((c) => c.severity !== "bend")!;
  // A zone 80 m after the corner starts, so both fall due together.
  const at80 = corner.startM + 80;
  const zoneRb = {
    ...rb,
    countrySegments: [{ startM: 0, endM: rb.totalM, code: "BE" }],
    zones: [{ atM: at80, watched: null, country: "BE", kmh: null, startM: at80 - 100, endM: at80 + 100 }],
  };
  const nav = createNavigator(zoneRb);
  const first = nav.update(fixAt(at(rb, corner.startM - 140), 17, 0));
  assert.ok(first.warning);
  assert.equal(first.zoneWarning, null);
  const second = nav.update(fixAt(at(rb, corner.startM - 120), 17, 1000));
  assert.ok(second.zoneWarning);
});

test("zones move along with the approach", () => {
  const line = straight();
  const rb = prep([camera(line, 400)]);
  const approach: LatLon[] = drawLine([{ straight: 1000 }]).map(([lat, lon]) => [lat, lon - 0.0142]);
  const joined = withApproach(rb, approach, false);
  assert.ok(Math.abs(joined.zones[0]!.atM - (rb.zones[0]!.atM + joined.approachM)) < 0.01);
});

const inCountry = (code: string, line = straight()) => ({
  countries: [{ from: 0, to: line.length - 1, code }],
});
const prepIn = (code: string, cameras: unknown[], extra: Record<string, unknown> = {}, line = straight()) =>
  prepareRoadbook(parseRoadbookFile(roadbookFile(line, { cameras, ...inCountry(code, line), ...extra })));

/** Ride the whole line at `kmh`, a fix every 20 m, and keep the warnings in the order they come. */
const ridden = (rb: PreparedRoadbook, kmh = 60) => {
  const nav = createNavigator(rb);
  const out: Array<{ m: number; w: NonNullable<ReturnType<typeof nav.update>["zoneWarning"]> }> = [];
  for (let m = 0; m < rb.totalM; m += 20) {
    const w = nav.update(fixAt(at(rb, m), kmh, m)).zoneWarning;
    if (w) out.push({ m, w });
  }
  return out;
};

test("in France a camera is a danger zone: no camera word, no countdown, at least 2 km on an ordinary road", () => {
  const line = straight();
  const rb = prepIn("FR", [camera(line, 400)], { limits: [{ from: 0, to: 800, kmh: 80, posted: true }] });
  const zone = rb.zones[0]!;
  assert.ok(zone.endM - zone.startM >= 1990 && zone.endM - zone.startM <= 2010, `${zone.endM - zone.startM}`);
  assert.ok(zone.atM > zone.startM + 400 && zone.atM < zone.endM - 400, "the camera is inside, never at an end");
  const warnings = ridden(rb);
  assert.equal(warnings.length, 1);
  const { m, w } = warnings[0]!;
  assert.equal(w.kind, "zone");
  assert.match(w.text, /^Danger zone for (1\.\d|2) kilomet(re|res)$/);
  assert.doesNotMatch(w.text, /camera|radar/i);
  assert.ok(m >= zone.startM && m <= zone.startM + 20, "warned as the zone is entered, not as the camera nears");
  assert.equal(w.endM, zone.endM);
  assert.equal(w.distanceM, 0);
});

test("a French zone is 300 m in a town and 4 km on a motorway, and is centred on no camera", () => {
  const line = straight();
  const town = prepIn("FR", [camera(line, 400)], { limits: [{ from: 0, to: 800, kmh: 50, posted: true }] }).zones[0]!;
  assert.ok(Math.abs(town.endM - town.startM - 300) < 10);
  const long = drawLine([{ straight: 20000 }]);
  const motorway = prepIn("FR", [camera(long, 1000)], { limits: [{ from: 0, to: 1999, kmh: 130, posted: true }] }, long)
    .zones[0]!;
  assert.ok(Math.abs(motorway.endM - motorway.startM - 4000) < 10, `${motorway.endM - motorway.startM}`);
  const centres = new Set<number>();
  for (const i of [300, 400, 500, 600]) {
    const z = prepIn("FR", [camera(line, i)], { limits: [{ from: 0, to: 800, kmh: 80, posted: true }] }).zones[0]!;
    centres.add(Math.round(((z.atM - z.startM) / (z.endM - z.startM)) * 20));
    assert.notEqual((z.atM - z.startM) / (z.endM - z.startM), 0.5);
  }
  assert.ok(centres.size > 1, "the camera is not always at the same place in its zone");
});

test("a zone is warned once and not again while the rider is still in it", () => {
  const line = straight();
  const rb = prepIn("FR", [camera(line, 400)]);
  assert.equal(ridden(rb).length, 1);
});

test("in Germany and Switzerland nothing is warned, and in a country nobody checked nothing either", () => {
  const line = straight();
  for (const code of ["DE", "CH", "XX"]) assert.equal(ridden(prepIn(code, [camera(line, 400)])).length, 0, code);
  const bare = prepareRoadbook(parseRoadbookFile(roadbookFile(line, { cameras: [camera(line, 400)], countries: [] })));
  assert.equal(ridden(bare).length, 0, "a roadbook that does not say its country");
});

test("a camera in Belgium is not given by its place to a rider who is still in France", () => {
  const line = straight();
  const rb = prepareRoadbook(
    parseRoadbookFile(
      roadbookFile(line, {
        cameras: [camera(line, 400)],
        countries: [
          { from: 0, to: 300, code: "FR" },
          { from: 300, to: 800, code: "BE" },
        ],
        limits: [{ from: 0, to: 800, kmh: 80, posted: true }],
      }),
    ),
  );
  const warnings = ridden(rb);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]!.w.kind, "zone", "the stricter of the two countries");
});

test("a camera in France is a zone even for a rider still in Belgium: the camera's country rules", () => {
  const line = straight();
  const rb = prepareRoadbook(
    parseRoadbookFile(
      roadbookFile(line, {
        cameras: [camera(line, 600)],
        countries: [
          { from: 0, to: 300, code: "BE" },
          { from: 300, to: 800, code: "FR" },
        ],
      }),
    ),
  );
  const warnings = ridden(rb);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]!.w.kind, "zone");
});

test("a camera in Belgium after a stretch in Germany is warned of once the rider is in Belgium", () => {
  const line = straight();
  const rb = prepareRoadbook(
    parseRoadbookFile(
      roadbookFile(line, {
        cameras: [camera(line, 300)],
        countries: [
          { from: 0, to: 200, code: "DE" },
          { from: 200, to: 800, code: "BE" },
        ],
      }),
    ),
  );
  const warnings = ridden(rb);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]!.w.kind, "camera");
  const border = rb.countrySegments[1]!.startM;
  assert.ok(warnings[0]!.m >= border, "nothing is said while the rider is in Germany");
});

test("the country of a camera comes from the line where it lies, and moves with an approach", () => {
  const line = straight();
  const rb = prepIn("BE", [camera(line, 400)]);
  assert.equal(rb.zones[0]!.country, "BE");
  const approach: LatLon[] = drawLine([{ straight: 1000 }]).map(([lat, lon]) => [lat, lon - 0.0142]);
  const joined = withApproach(rb, approach, false);
  assert.ok(Math.abs(joined.zones[0]!.startM - (rb.zones[0]!.startM + joined.approachM)) < 0.01);
  assert.ok(Math.abs(joined.zones[0]!.endM - (rb.zones[0]!.endM + joined.approachM)) < 0.01);
  assert.ok(Math.abs(joined.countrySegments[0]!.endM - (rb.countrySegments[0]!.endM + joined.approachM)) < 0.01);
});

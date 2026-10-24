import assert from "node:assert/strict";
import { test } from "node:test";
import { parseGpx, slugify, tidyStopName } from "../src/core/gpx.ts";

const gpx = (body: string) =>
  `<?xml version="1.0"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">${body}</gpx>`;

test("reads name, description, stops and the track line", () => {
  const rb = parseGpx(
    gpx(`<metadata><name>Pays des Collines &amp; co</name><desc>122 km</desc></metadata>
      <wpt lat="50.1" lon="3.1"><name>Start</name></wpt><wpt lat="50.2" lon="3.2"><name>1. Stop</name></wpt>
      <trk><name>x</name><trkseg><trkpt lat="50.1" lon="3.1"/><trkpt lat="50.15" lon="3.15"></trkpt><trkpt lat="50.2" lon="3.2"/></trkseg></trk>`),
  );
  assert.equal(rb.name, "Pays des Collines & co");
  assert.equal(rb.id, "pays-des-collines-co");
  assert.equal(rb.description, "122 km");
  assert.equal(rb.stops.length, 2);
  assert.equal(rb.stops[1]?.name, "1. Stop");
  assert.equal(rb.line.length, 3);
});

test("accepts lon before lat", () => {
  const rb = parseGpx(gpx(`<trk><trkseg><trkpt lon="3.1" lat="50.1"/><trkpt lon="3.2" lat="50.2"/></trkseg></trk>`));
  assert.deepEqual(rb.line[0], [50.1, 3.1]);
});

test("a route only is both the line and the stops", () => {
  const rb = parseGpx(
    gpx(`<rte><name>R</name><rtept lat="50.1" lon="3.1"><name>A</name></rtept><rtept lat="50.2" lon="3.2"/></rte>`),
  );
  assert.equal(rb.name, "R");
  assert.equal(rb.line.length, 2);
  assert.equal(rb.stops.length, 2);
  assert.equal(rb.stops[0]?.name, "A");
});

test("ignores invalid points and refuses fewer than two", () => {
  assert.throws(
    () =>
      parseGpx(
        gpx(`<trk><trkseg><trkpt lat="95" lon="3"/><trkpt lat="50" lon="3"/><trkpt lat="x" lon="3"/></trkseg></trk>`),
      ),
    /1 usable line point/,
  );
});

test("slugify strips accents and symbols", () => {
  assert.equal(slugify("Éau d'Heure — lakes!"), "eau-d-heure-lakes");
  assert.equal(slugify("***"), "roadbook");
});

test("a stop named by its coordinates reads as a point, a real name is left alone", () => {
  assert.equal(tidyStopName("1. 50.60485,3.61783"), "Point 1");
  assert.equal(tidyStopName("12. 50.6,3.6"), "Point 12");
  assert.equal(tidyStopName("Start: 50.4552,3.20384"), "Start");
  assert.equal(tidyStopName("Finish: -33.8688, 151.2093"), "Finish");
  assert.equal(tidyStopName("5. Frasnes-lez-Anvaing, Wallonia, Belgium"), "5. Frasnes-lez-Anvaing, Wallonia, Belgium");
  assert.equal(tidyStopName("Start: Route Nationale 49"), "Start: Route Nationale 49");
  assert.equal(tidyStopName("pause: Boulangerie (10:30)"), "pause: Boulangerie (10:30)");
  assert.equal(tidyStopName(""), "");
});

test("the stops of a GPX are tidied as they are read", () => {
  const rb = parseGpx(
    gpx(`<wpt lat="50.1" lon="3.1"><name>Start: 50.1,3.1</name></wpt><wpt lat="50.2" lon="3.2"><name>1. 50.2,3.2</name></wpt>
      <trk><trkseg><trkpt lat="50.1" lon="3.1"/><trkpt lat="50.2" lon="3.2"/></trkseg></trk>`),
  );
  assert.deepEqual(
    rb.stops.map((s) => s.name),
    ["Start", "Point 1"],
  );
});

import assert from "node:assert/strict";
import { test } from "node:test";
import type { OverpassElement } from "../src/core/enrich.ts";
import {
  alongRoute,
  DEFAULT_FUEL_RANGE_KM,
  fuelAnnouncement,
  fuelSummary,
  isFuelRange,
  isPlaceKind,
  lineWindow,
  PLACE_KINDS,
  placesAhead,
  POI_FILTERS,
  nextFuel,
  nextFuelRange,
  poiName,
  poisFromElements,
  upcomingFuel,
  type RoutePoi,
} from "../src/core/pois.ts";
import { cumulativeDistances } from "../src/core/track.ts";
import { drawLine } from "./helpers/path.ts";

const line = drawLine([{ straight: 100_000 }]);
const cum = cumulativeDistances(line);

const node = (id: number, lat: number, lon: number, tags: Record<string, string> = {}): OverpassElement => ({
  type: "node",
  id,
  lat,
  lon,
  tags,
});

const stop = (id: string, atM: number): RoutePoi => ({
  poi: { id, kind: "fuel", lat: 0, lon: 0, name: id, brand: null },
  atM,
  offM: 100,
});

test("the places of Overpass: a node or a way's centre, named by name or brand, each once", () => {
  const pois = poisFromElements("fuel", [
    node(1, 50, 3, { name: " Station Dupont ", brand: "Total" }),
    node(1, 50, 3, { name: "Station Dupont" }),
    { type: "way", id: 7, center: { lat: 50.1, lon: 3.1 }, tags: { brand: "Esso" } },
    { type: "relation", id: 9, tags: { name: "no position" } },
    node(2, 50.2, 3.2, { operator: "Carrefour" }),
    node(3, 50.3, 3.3),
  ]);
  assert.deepEqual(
    pois.map((p) => [p.id, p.name, p.brand]),
    [
      ["node/1", "Station Dupont", "Total"],
      ["way/7", null, "Esso"],
      ["node/2", null, "Carrefour"],
      ["node/3", null, null],
    ],
  );
  assert.equal(poiName(pois[0]!), "Station Dupont");
  assert.equal(poiName(pois[1]!), "Esso");
  assert.equal(poiName(pois[3]!), null);
});

test("stations along the route are placed by where the nearest point is, and the far ones are left out", () => {
  const [lat0, lon0] = line[0]!;
  const at = (m: number, offM: number) => ({
    lat: lat0 + offM / 111_320,
    lon: lon0 + m / (111_320 * Math.cos((lat0 * Math.PI) / 180)),
  });
  const pois = poisFromElements("fuel", [
    node(1, at(60_000, 800).lat, at(60_000, 800).lon),
    node(2, at(20_000, 100).lat, at(20_000, 100).lon),
    node(3, at(40_000, 5000).lat, at(40_000, 5000).lon),
  ]);
  const found = alongRoute(line, cum, pois, 1500);
  assert.deepEqual(
    found.map((f) => f.poi.id),
    ["node/2", "node/1"],
  );
  assert.ok(Math.abs(found[0]!.atM - 20_000) < 60);
  assert.ok(Math.abs(found[0]!.offM - 100) < 5);
  assert.ok(Math.abs(found[1]!.offM - 800) < 5);
});

test("the next station is the first not passed, and one just passed is still offered", () => {
  const stops = [stop("a", 10_000), stop("b", 50_000), stop("c", 90_000)];
  assert.equal(nextFuel(stops, 0)!.stop.poi.id, "a");
  assert.equal(nextFuel(stops, 0)!.distM, 10_000);
  assert.equal(nextFuel(stops, 9_950)!.stop.poi.id, "a");
  assert.equal(nextFuel(stops, 10_090)!.stop.poi.id, "a");
  assert.equal(nextFuel(stops, 10_200)!.stop.poi.id, "b");
  assert.equal(nextFuel(stops, 95_000), null);
  assert.equal(nextFuel([], 0), null);
  assert.deepEqual(
    upcomingFuel(stops, 20_000, 5).map((u) => [u.stop.poi.id, u.distM]),
    [
      ["b", 30_000],
      ["c", 70_000],
    ],
  );
  assert.equal(upcomingFuel(stops, 0, 2).length, 2);
});

test("the longest stretch without fuel counts the start and the finish, and is tight past 80 % of the range", () => {
  const stops = [stop("a", 10_000), stop("b", 50_000), stop("c", 90_000)];
  assert.deepEqual(fuelSummary(stops, 100_000, 200), { count: 3, longestGapM: 40_000, tight: false });
  assert.deepEqual(fuelSummary(stops, 100_000, 45), { count: 3, longestGapM: 40_000, tight: true });
  assert.deepEqual(fuelSummary([], 100_000, 200), { count: 0, longestGapM: 100_000, tight: false });
  assert.deepEqual(fuelSummary([], 180_000, 200), { count: 0, longestGapM: 180_000, tight: true });
  // From where the rider is: what is behind does not count.
  assert.deepEqual(fuelSummary(stops, 100_000, 200, 55_000), { count: 1, longestGapM: 35_000, tight: false });
  assert.equal(fuelSummary([stop("a", 150_000)], 160_000, 200).longestGapM, 150_000);
});

test("a station is announced once, 3 km ahead, when what follows it is a long stretch", () => {
  const stops = [stop("a", 10_000), stop("b", 150_000)];
  const none = new Set<string>();
  // Far: nothing yet.
  assert.equal(fuelAnnouncement(stops, 5_000, 200_000, 200, none), null);
  // Within 3 km, and 140 km follow it: say it, with the next one.
  const a = fuelAnnouncement(stops, 7_500, 200_000, 200, none)!;
  assert.deepEqual([a.id, a.kind, a.distM, a.gapM], ["a", "next", 2_500, 140_000]);
  // Said already: never twice.
  assert.equal(fuelAnnouncement(stops, 8_000, 200_000, 200, new Set(["a"])), null);
  // The last one, with a long stretch to the finish.
  const b = fuelAnnouncement(stops, 148_000, 300_000, 200, none)!;
  assert.deepEqual([b.id, b.kind, b.gapM], ["b", "last", 150_000]);
  // Another station soon after, or the finish soon after: not worth a word.
  assert.equal(fuelAnnouncement([stop("a", 10_000), stop("b", 60_000)], 8_000, 80_000, 200, none), null);
  assert.equal(fuelAnnouncement(stops, 148_000, 160_000, 200, none), null);
  assert.equal(fuelAnnouncement([], 0, 100_000, 200, none), null);
});

test("the range of the tank goes round the steps and a stored value is checked", () => {
  assert.equal(DEFAULT_FUEL_RANGE_KM, 200);
  assert.equal(nextFuelRange(200), 250);
  assert.equal(nextFuelRange(400), 100);
  assert.equal(nextFuelRange(123), 100);
  assert.equal(isFuelRange(300), true);
  assert.equal(isFuelRange(301), false);
  assert.equal(isFuelRange("200"), false);
});

test("the kinds of place to look for each have a filter, and a stored value is checked", () => {
  assert.deepEqual([...PLACE_KINDS], ["bakery", "cafe", "restaurant", "viewpoint", "toilets", "atm", "motorcycle"]);
  for (const k of PLACE_KINDS) assert.ok(POI_FILTERS[k].startsWith("["), k);
  assert.equal(POI_FILTERS.bakery, '["shop"="bakery"]');
  assert.equal(POI_FILTERS.restaurant, '["amenity"~"^(restaurant|fast_food)$"]');
  assert.equal(isPlaceKind("bakery"), true);
  assert.equal(isPlaceKind("fuel"), false);
  assert.equal(isPlaceKind(null), false);
});

test("a window of the line keeps its own distances from zero", () => {
  const w = lineWindow(line, cum, 20_000, 50_000);
  assert.ok(w.line.length >= 2);
  assert.equal(w.cumulativeM[0], 0);
  assert.ok(Math.abs(w.cumulativeM.at(-1)! - 30_000) < 100);
  assert.equal(w.line.length, w.cumulativeM.length);
  // The window of the whole line is the line.
  const all = lineWindow(line, cum, 0, 1e9);
  assert.equal(all.line.length, line.length);
  // A window between two points of the line still has two.
  const tiny = lineWindow(line, cum, cum[10]! + 1, cum[10]! + 2);
  assert.equal(tiny.line.length, 2);
  assert.equal(tiny.cumulativeM.length, 2);
});

test("the places ahead are the first not passed, nearest along the route first", () => {
  const places = [stop("a", 5_000), stop("b", 20_000), stop("c", 40_000)];
  assert.deepEqual(
    placesAhead(places, 10_000, 5).map((p) => p.stop.poi.id),
    ["b", "c"],
  );
  assert.deepEqual(
    placesAhead(places, 0, 2).map((p) => [p.stop.poi.id, p.distM]),
    [
      ["a", 5_000],
      ["b", 20_000],
    ],
  );
  assert.deepEqual(placesAhead([], 0, 3), []);
});

import assert from "node:assert/strict";
import { test } from "node:test";
import { destinationRoadbook, MAX_PLACES, placesOf, searchable } from "../src/core/destination.ts";
import { prepareRoadbook } from "../src/core/roadbook.ts";
import { searchPlaces } from "../src/services/places.ts";
import type { LatLon } from "../src/core/types.ts";

test("a query is sent trimmed and only from 3 characters", () => {
  assert.equal(searchable("  Mons  "), "Mons");
  assert.equal(searchable("Le   Quesnoy"), "Le Quesnoy");
  assert.equal(searchable("ab"), null);
  assert.equal(searchable("   "), null);
});

test("places are read from a Nominatim answer: name, a shorter line of where, a position", () => {
  const places = placesOf([
    { display_name: "Mons, Hainaut, Wallonia, 7000, Belgium", name: "Mons", lat: "50.4542", lon: "3.9523" },
    { display_name: "Rue de la Gare, Mons, Hainaut, Belgium", lat: "50.45", lon: "3.95" },
  ]);
  assert.deepEqual(places[0], { name: "Mons", detail: "Hainaut, Wallonia, 7000", lat: 50.4542, lon: 3.9523 });
  assert.equal(places[1]!.name, "Rue de la Gare");
  assert.equal(places[1]!.detail, "Mons, Hainaut, Belgium");
});

test("entries without a position, with an impossible one, or that are not places are dropped; the list is capped", () => {
  assert.deepEqual(placesOf("nope"), []);
  assert.deepEqual(
    placesOf([
      null,
      { display_name: "A", lat: "x", lon: "3" },
      { display_name: "B", lat: "95", lon: "3" },
      { lat: "50", lon: "3" },
    ]),
    [],
  );
  const many = Array.from({ length: 20 }, (_, i) => ({ display_name: `P${i}`, lat: "50", lon: "3" }));
  assert.equal(placesOf(many).length, MAX_PLACES);
});

const line: LatLon[] = [
  [50.4, 3.2],
  [50.41, 3.21],
  [50.42, 3.22],
];

test("a trip is a roadbook from the position to the place, with its distance", () => {
  const rb = destinationRoadbook(
    { name: "Café de l'Église", detail: "Mons", lat: 50.42, lon: 3.22 },
    [50.4, 3.2],
    line,
  );
  assert.equal(rb.name, "To Café de l'Église");
  assert.equal(rb.id, "to-cafe-de-l-eglise");
  assert.deepEqual(
    rb.stops.map((s) => s.name),
    ["Start", "Café de l'Église"],
  );
  assert.match(rb.description, /^\d+(\.\d)? km to Mons\.$/);
  const prepared = prepareRoadbook(rb);
  assert.ok(prepared.totalM > 2000);
  assert.equal(prepared.stops.length, 2);
});

test("the search asks Nominatim once with an identifying agent, and says null when it cannot", async () => {
  const calls: Array<{ url: string; agent: string }> = [];
  const ok = (async (url: string, init: { headers: Record<string, string> }) => {
    calls.push({ url, agent: init.headers["User-Agent"]! });
    return { ok: true, json: async () => [{ display_name: "Mons, Belgium", lat: "50.45", lon: "3.95" }] };
  }) as unknown as typeof fetch;
  const found = await searchPlaces("Mons", { fetchImpl: ok });
  assert.equal(found?.length, 1);
  assert.equal(calls.length, 1);
  assert.match(calls[0]!.url, /nominatim\.openstreetmap\.org\/search\?q=Mons&format=jsonv2&limit=8/);
  assert.match(calls[0]!.agent, /^MobileMotoRide\//);
  const http = (async () => ({ ok: false })) as unknown as typeof fetch;
  assert.equal(await searchPlaces("Mons", { fetchImpl: http }), null);
  const down = (async () => {
    throw new Error("offline");
  }) as unknown as typeof fetch;
  assert.equal(await searchPlaces("Mons", { fetchImpl: down }), null);
});

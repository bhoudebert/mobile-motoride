import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addRecent,
  MAX_RECENTS,
  parseRecents,
  recentDetail,
  recentKey,
  recentTitle,
  type Recent,
} from "../src/core/recents.ts";

const place = (name: string, lat = 50.45, lon = 3.95, at = 1): Recent => ({
  kind: "place",
  place: { name, detail: "Hainaut", lat, lon },
  at,
});
const roadbook = (id: string, at = 1): Recent => ({ kind: "roadbook", id, name: `RB ${id}`, detail: "122 km", at });

test("the newest ride comes first and the same ride moves to the top, not twice", () => {
  let list: Recent[] = [];
  list = addRecent(list, roadbook("a", 1));
  list = addRecent(list, place("Mons", 50.45, 3.95, 2));
  list = addRecent(list, roadbook("a", 3));
  assert.deepEqual(
    list.map((r) => [r.kind, recentTitle(r), r.at]),
    [
      ["roadbook", "RB a", 3],
      ["place", "Mons", 2],
    ],
  );
});

test("a place is the same place when it is within a few metres, whatever its name", () => {
  assert.equal(recentKey(place("Mons", 50.45001, 3.95001)), recentKey(place("Mons centre", 50.45002, 3.95002)));
  assert.notEqual(recentKey(place("Mons", 50.45, 3.95)), recentKey(place("Mons", 50.46, 3.95)));
  assert.notEqual(recentKey(place("x")), recentKey(roadbook("x")));
});

test("only the newest few are kept", () => {
  let list: Recent[] = [];
  for (let i = 0; i < MAX_RECENTS + 4; i++) list = addRecent(list, roadbook(String(i), i));
  assert.equal(list.length, MAX_RECENTS);
  assert.equal(list[0]!.kind === "roadbook" && list[0]!.id, String(MAX_RECENTS + 3));
});

test("titles and details read from either kind", () => {
  assert.equal(recentTitle(roadbook("a")), "RB a");
  assert.equal(recentDetail(roadbook("a")), "122 km");
  assert.equal(recentDetail(place("Mons")), "Hainaut");
});

test("what was kept is read back, and anything damaged is dropped, never thrown", () => {
  const list = [place("Mons"), roadbook("a")];
  assert.deepEqual(parseRecents(JSON.stringify(list)), list);
  assert.deepEqual(parseRecents(null), []);
  assert.deepEqual(parseRecents("not json"), []);
  assert.deepEqual(parseRecents('{"a":1}'), []);
  const damaged = JSON.stringify([
    null,
    { kind: "place", place: { name: "X", lat: 500, lon: 3 }, at: 1 },
    { kind: "place", place: { name: "Y", lat: "50", lon: 3 }, at: 1 },
    { kind: "roadbook", id: 3, name: "n", at: 1 },
    { kind: "other", at: 1 },
    { kind: "roadbook", id: "ok", name: "Fine", at: 5 },
  ]);
  assert.deepEqual(parseRecents(damaged), [{ kind: "roadbook", id: "ok", name: "Fine", detail: "", at: 5 }]);
});

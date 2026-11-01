import assert from "node:assert/strict";
import { test } from "node:test";
import type { ImportedRoadbook } from "../src/core/library.ts";
import { decodePolyline, encodePolyline } from "../src/core/polyline.ts";
import type { Roadbook } from "../src/core/types.ts";
import { parseRoadbookFile, serializeRoadbookFile } from "../src/core/roadbookFile.ts";
import { onlyOnPhone, type ServerRoadbook } from "../src/core/serverRoadbooks.ts";
import { MAX_PUSH_BYTES, pushRoadbook } from "../src/services/serverRoadbooks.ts";
import { readdirSync, readFileSync } from "node:fs";

const DIR = new URL("./fixtures/roadbooks/", import.meta.url);
const fixtureRoadbooks = readdirSync(DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(new URL(f, DIR), "utf8")) as Roadbook);

const SERVER = { url: "https://rides.example.org", token: "mrt_x" };
const reply = (status: number, body: unknown = {}, headers: Record<string, string> = {}) =>
  ({
    ok: status < 300,
    status,
    headers: { get: (k: string) => headers[k] ?? null },
    json: async () => body,
  }) as unknown as Response;
const fake = (r: Response, seen: { url?: string; init?: RequestInit } = {}) =>
  (async (url: string, init: RequestInit) => {
    seen.url = url;
    seen.init = init;
    return r;
  }) as unknown as typeof fetch;

test("a polyline survives encoding and decoding", () => {
  const line = fixtureRoadbooks[0]!.line;
  const back = decodePolyline(encodePolyline(line));
  assert.equal(back.length, line.length);
  for (let i = 0; i < line.length; i++) {
    assert.ok(Math.abs(back[i]![0] - line[i]![0]) < 1e-6 && Math.abs(back[i]![1] - line[i]![1]) < 1e-6);
  }
});

test("a roadbook written as a file reads back with its line, stops, limits, cameras, countries and origin", () => {
  for (const rb of fixtureRoadbooks) {
    const back = parseRoadbookFile(serializeRoadbookFile(rb));
    assert.equal(back.name, rb.name);
    assert.equal(back.line.length, rb.line.length);
    assert.deepEqual(back.stops, rb.stops);
    assert.deepEqual(back.limits, rb.limits ?? []);
    assert.deepEqual(back.countries, rb.countries ?? []);
    assert.equal(back.cameras?.length, (rb.cameras ?? []).length);
    assert.deepEqual(back.origin, rb.origin);
  }
});

test("a roadbook is sent to the collection with the phone's token and its answer is read", async () => {
  const seen: { url?: string; init?: RequestInit } = {};
  const ok = await pushRoadbook(SERVER, "{}", {
    fetchImpl: fake(reply(200, { id: 11, replaced: false, stamp: "s1" }), seen),
  });
  assert.deepEqual(ok, { ok: true, id: 11, replaced: false, stamp: "s1" });
  assert.equal(seen.url, "https://rides.example.org/roadbooks");
  assert.equal(seen.init!.method, "PUT");
  assert.equal((seen.init!.headers as Record<string, string>).Authorization, "Bearer mrt_x");
});

test("each refusal is told apart: library full by its code, too large, 100 sent, busy with its wait, refused, invalid", async () => {
  const f = (r: Response) => ({ fetchImpl: fake(r) });
  const why = async (r: Response) => {
    const a = await pushRoadbook(SERVER, "{}", f(r));
    return a.ok ? "ok" : a.reason;
  };
  assert.equal(await why(reply(413, { error: "library_full" })), "libraryFull");
  assert.equal(await why(reply(413, { error: "Too large." })), "tooLarge");
  assert.equal(
    await why(reply(409, { error: "This server keeps at most 100 sent roadbooks; delete one first." })),
    "full",
  );
  assert.equal(await why(reply(401)), "unauthorized");
  assert.equal(await why(reply(400)), "invalid");
  const busy = await pushRoadbook(SERVER, "{}", f(reply(429, {}, { "Retry-After": "12" })));
  assert.deepEqual(busy, { ok: false, reason: "busy", retryAfterS: 12 });
  const down = (async () => {
    throw new TypeError("down");
  }) as unknown as typeof fetch;
  assert.equal((await pushRoadbook(SERVER, "{}", { fetchImpl: down })).ok, false);
  const big = await pushRoadbook(SERVER, "x".repeat(MAX_PUSH_BYTES + 1), f(reply(200, { id: 1 })));
  assert.deepEqual(big, { ok: false, reason: "tooLarge" });
});

const kept = (id: string, extra: Partial<ImportedRoadbook> = {}): ImportedRoadbook => ({
  roadbook: { ...fixtureRoadbooks[0]!, id, name: id },
  importedAt: 1,
  ...extra,
});
const entry = (id: number, name: string): ServerRoadbook => ({
  id,
  name,
  distanceKm: 1,
  ridingMinutes: 1,
  stamp: "s",
  state: "current",
  ready: true,
});

test("what is offered is what holds no server number: not what is linked, even when the server lists the name", () => {
  const local = kept("local");
  const linked = kept("linked", { serverId: 3, serverStamp: "s" });
  const listedByOrigin = kept("by-origin", {
    roadbook: {
      ...fixtureRoadbooks[0]!,
      id: "by-origin",
      name: "Loop",
      origin: { app: "agentRide", roadbook: 9, name: "Loop" },
    },
  });
  const list = [entry(9, "Loop"), entry(3, "linked")];
  assert.deepEqual(
    onlyOnPhone([local, linked, listedByOrigin], list).map((k) => k.roadbook.id),
    ["local", "by-origin"],
  );
  assert.deepEqual(onlyOnPhone([local], null), [], "nothing is offered while the list is not known");
});

import assert from "node:assert/strict";
import { test } from "node:test";
import type { ImportedRoadbook } from "../src/core/library.ts";
import { parseServerList, serverAction, stampOfEtag } from "../src/core/serverRoadbooks.ts";
import type { Roadbook } from "../src/core/types.ts";
import { fetchServerRoadbook, listServerRoadbooks } from "../src/services/serverRoadbooks.ts";

const SERVER = { url: "https://s.example", token: "t0k" };
const entry = { id: 7, name: "Loop", distanceKm: 12.3, ridingMinutes: 20, stamp: "bbb" };
const keptWith = (
  over: Partial<ImportedRoadbook> = {},
  origin: Roadbook["origin"] | null = { app: "agentRide", roadbook: 7, name: "Loop" },
) =>
  ({
    roadbook: { id: "local", name: "Loop", description: "", stops: [], line: [], ...(origin ? { origin } : {}) },
    importedAt: 1,
    ...over,
  }) as ImportedRoadbook;

test("the list of a server is read, and what is not a roadbook is left out", () => {
  const list = parseServerList({
    roadbooks: [
      entry,
      { id: "x", name: "bad", stamp: "s" },
      null,
      { id: 2, name: "", stamp: "s" },
      { id: 3, name: "No stamp" },
    ],
  });
  assert.deepEqual(list, [entry]);
  assert.deepEqual(parseServerList({}), []);
  assert.deepEqual(parseServerList(null), []);
});

test("download when no kept roadbook has the origin, refresh when the stamp differs, current when it is the same", () => {
  assert.equal(serverAction(entry, []), "download");
  assert.equal(serverAction(entry, [keptWith({}, null)]), "download");
  assert.equal(serverAction(entry, [keptWith({}, { app: "agentRide", roadbook: 7, name: "Other" })]), "download");
  assert.equal(serverAction(entry, [keptWith({ serverStamp: "aaa" })]), "refresh");
  assert.equal(serverAction(entry, [keptWith()]), "refresh");
  assert.equal(serverAction(entry, [keptWith({ serverStamp: "bbb" })]), "current");
});

test("the stamp is the ETag without its quotes", () => {
  assert.equal(stampOfEtag('"abc123"'), "abc123");
  assert.equal(stampOfEtag('W/"abc"'), "abc");
  assert.equal(stampOfEtag(null), null);
  assert.equal(stampOfEtag('""'), null);
});

const answer = (status: number, body: unknown = {}, etag?: string) =>
  (async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    headers: { get: (k: string) => (k.toLowerCase() === "etag" ? (etag ?? null) : null) },
  })) as unknown as typeof fetch;

test("the list is asked with the token, and each failure has its reason", async () => {
  let seen: { url: string; auth: string } | undefined;
  const spy = (async (url: string, init: RequestInit) => {
    seen = { url, auth: (init.headers as Record<string, string>)["Authorization"]! };
    return { ok: true, status: 200, json: async () => ({ roadbooks: [entry] }) };
  }) as unknown as typeof fetch;
  assert.deepEqual(await listServerRoadbooks(SERVER, { fetchImpl: spy }), { ok: true, items: [entry] });
  assert.deepEqual(seen, { url: "https://s.example/roadbooks", auth: "Bearer t0k" });
  const reason = async (status: number) =>
    (await listServerRoadbooks(SERVER, { fetchImpl: answer(status) }))["reason" as never];
  assert.equal(await reason(401), "unauthorized");
  assert.equal(await reason(404), "unsupported");
  assert.equal(await reason(429), "busy");
  assert.equal(await reason(500), "failed");
  const down = (async () => Promise.reject(new TypeError("down"))) as unknown as typeof fetch;
  assert.equal((await listServerRoadbooks(SERVER, { fetchImpl: down }))["reason" as never], "unreachable");
});

test("a roadbook file comes with its stamp, and its failures are told apart", async () => {
  const ok = await fetchServerRoadbook(SERVER, 7, { fetchImpl: answer(200, "FILE", '"stamp9"') });
  assert.deepEqual(ok, { ok: true, text: "FILE", stamp: "stamp9" });
  const reason = async (status: number) =>
    (await fetchServerRoadbook(SERVER, 7, { fetchImpl: answer(status) }))["reason" as never];
  assert.equal(await reason(404), "missing");
  assert.equal(await reason(502), "failed");
  assert.equal(await reason(429), "busy");
  assert.equal(await reason(401), "unauthorized");
});

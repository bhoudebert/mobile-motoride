import assert from "node:assert/strict";
import { test } from "node:test";
import type { ImportedRoadbook } from "../src/core/library.ts";
import { parseServerList, serverAction, stampOfEtag, type ServerRoadbook } from "../src/core/serverRoadbooks.ts";
import type { Roadbook } from "../src/core/types.ts";
import { fetchServerRoadbook, listServerRoadbooks, refreshServerRoadbook } from "../src/services/serverRoadbooks.ts";

const SERVER = { url: "https://s.example", token: "t0k" };
const entry: ServerRoadbook = {
  id: 7,
  name: "Loop",
  distanceKm: 12.3,
  ridingMinutes: 20,
  stamp: "bbb",
  state: "current",
};
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
  const { state: _state, ...onTheWire } = entry;
  const list = parseServerList({
    roadbooks: [
      onTheWire,
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

test("a pushed roadbook, listed under a number that is not its origin's, is found by the number it was fetched under", () => {
  const pushed = { ...entry, id: 1_000_003, name: "Pushed" };
  const copy = keptWith({ serverId: 1_000_003, serverStamp: "bbb" }, { app: "agentRide", roadbook: 4, name: "Pushed" });
  assert.equal(serverAction(pushed, []), "download");
  assert.equal(serverAction(pushed, [copy]), "current");
  assert.equal(serverAction({ ...pushed, stamp: "ccc" }, [copy]), "refresh");
  // An entry whose number is another copy's origin number does not take a copy that came from another number.
  assert.equal(serverAction({ ...entry, id: 4, name: "Pushed" }, [copy]), "download");
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

test("the state, the map day and the error of an entry are kept, and an older server's entry is current", () => {
  const list = parseServerList({
    roadbooks: [
      { ...entry, state: "outdated", mapDay: "2026-10-30" },
      { ...entry, id: 8, state: "refreshing" },
      { ...entry, id: 9, state: "failed", error: "no route found" },
      { ...entry, id: 10, state: "something new" },
      { ...entry, id: 11, mapDay: "" },
    ],
  });
  assert.deepEqual(
    list.map((e) => e.state),
    ["outdated", "refreshing", "failed", "current", "current"],
  );
  assert.equal(list[0]!.mapDay, "2026-10-30");
  assert.equal(list[2]!.error, "no route found");
  assert.equal(list[4]!.mapDay, undefined);
});

test("what the list offers follows the state, the held stamp and nothing else", () => {
  const held = [keptWith({ serverStamp: "bbb" })];
  // The file held is the ready one: the state says what to show.
  assert.equal(serverAction({ ...entry, state: "current" }, held), "current");
  assert.equal(serverAction({ ...entry, state: "outdated" }, held), "outdated");
  assert.equal(serverAction({ ...entry, state: "failed", error: "x" }, held), "failed");
  // Being remade: nothing to press, whatever the stamp.
  assert.equal(serverAction({ ...entry, state: "refreshing" }, held), "refreshing");
  assert.equal(serverAction({ ...entry, state: "refreshing", stamp: "ccc" }, held), "refreshing");
  // A new file is ready (a stamp that is not the one held): download it, even when the map has aged since.
  assert.equal(serverAction({ ...entry, state: "current", stamp: "ccc" }, held), "refresh");
  assert.equal(serverAction({ ...entry, state: "outdated", stamp: "ccc" }, held), "refresh");
  // Not held at all: the file is downloaded, an outdated one too (it still works).
  assert.equal(serverAction({ ...entry, state: "outdated" }, []), "download");
  // After the download the held stamp is the listed one: the update is not offered again on the next opening.
  assert.equal(
    serverAction({ ...entry, state: "current", stamp: "ccc" }, [keptWith({ serverStamp: "ccc" })]),
    "current",
  );
});

test("a refresh is asked with POST and the token, and the answers are told apart", async () => {
  let seen: { url: string; method?: string; auth: string } | undefined;
  const spy = (status: number) =>
    (async (url: string, init: RequestInit) => {
      seen = {
        url,
        ...(init.method ? { method: init.method } : {}),
        auth: (init.headers as Record<string, string>)["Authorization"]!,
      };
      return { ok: status < 300, status, json: async () => ({}) };
    }) as unknown as typeof fetch;
  assert.deepEqual(await refreshServerRoadbook(SERVER, 7, { fetchImpl: spy(202) }), { ok: true, state: "refreshing" });
  assert.deepEqual(seen, { url: "https://s.example/roadbook/7/refresh", method: "POST", auth: "Bearer t0k" });
  assert.deepEqual(await refreshServerRoadbook(SERVER, 7, { fetchImpl: spy(200) }), { ok: true, state: "current" });
  assert.deepEqual(await refreshServerRoadbook(SERVER, 7, { fetchImpl: spy(404) }), { ok: false, reason: "missing" });
  assert.deepEqual(await refreshServerRoadbook(SERVER, 7, { fetchImpl: spy(401) }), {
    ok: false,
    reason: "unauthorized",
  });
  assert.deepEqual(await refreshServerRoadbook(SERVER, 7, { fetchImpl: spy(429) }), { ok: false, reason: "busy" });
  const down = (async () => {
    throw new TypeError("Network request failed");
  }) as unknown as typeof fetch;
  assert.deepEqual(await refreshServerRoadbook(SERVER, 7, { fetchImpl: down }), { ok: false, reason: "unreachable" });
});

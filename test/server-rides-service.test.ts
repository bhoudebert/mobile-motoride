import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchServerRide, listServerRides, removeServerRide } from "../src/services/serverRides.ts";

const SERVER = { url: "https://s.example", token: "t0k" };
const reply = (status: number, body: unknown = {}) =>
  (async () => ({
    ok: status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  })) as unknown as typeof fetch;

test("the rides are asked with the token and read, and an older server is told apart from a missing ride", async () => {
  let seen: { url: string; auth: string } | undefined;
  const spy = (async (url: string, init: RequestInit) => {
    seen = { url, auth: (init.headers as Record<string, string>)["Authorization"]! };
    return {
      ok: true,
      status: 200,
      json: async () => ({
        rides: [
          { id: "a", name: "A", startedAt: "2026-10-30T10:00:00Z", endedAt: "2026-10-30T11:00:00Z", distanceKm: 3 },
        ],
      }),
    };
  }) as unknown as typeof fetch;
  const answer = await listServerRides(SERVER, { fetchImpl: spy });
  assert.equal(answer.ok && answer.rides[0]!.distanceM, 3000);
  assert.deepEqual(seen, { url: "https://s.example/rides", auth: "Bearer t0k" });
  assert.deepEqual(await listServerRides(SERVER, { fetchImpl: reply(404) }), { ok: false, reason: "unsupported" });
  assert.deepEqual(await listServerRides(SERVER, { fetchImpl: reply(401) }), { ok: false, reason: "unauthorized" });
  assert.deepEqual(await listServerRides(SERVER, { fetchImpl: reply(429) }), { ok: false, reason: "busy" });
  const down = (async () => {
    throw new TypeError("Network request failed");
  }) as unknown as typeof fetch;
  assert.deepEqual(await listServerRides(SERVER, { fetchImpl: down }), { ok: false, reason: "unreachable" });
});

test("a ride's GPX comes back as the text the server holds, at its own address", async () => {
  let url = "";
  const spy = (async (u: string) => {
    url = u;
    return { ok: true, status: 200, text: async () => "<gpx/>" };
  }) as unknown as typeof fetch;
  assert.deepEqual(await fetchServerRide(SERVER, "2026-10-30T13-49-32-loop", { fetchImpl: spy }), {
    ok: true,
    gpx: "<gpx/>",
  });
  assert.equal(url, "https://s.example/rides/2026-10-30T13-49-32-loop");
  assert.deepEqual(await fetchServerRide(SERVER, "x", { fetchImpl: reply(404) }), { ok: false, reason: "missing" });
});

test("a ride is removed with DELETE on the server only, and one that is already gone counts as removed", async () => {
  let seen: { url: string; method?: string } | undefined;
  const spy = (async (url: string, init: RequestInit) => {
    seen = { url, ...(init.method ? { method: init.method } : {}) };
    return { ok: true, status: 200, json: async () => ({}) };
  }) as unknown as typeof fetch;
  assert.deepEqual(await removeServerRide(SERVER, "r1", { fetchImpl: spy }), { ok: true });
  assert.deepEqual(seen, { url: "https://s.example/rides/r1", method: "DELETE" });
  assert.deepEqual(await removeServerRide(SERVER, "r1", { fetchImpl: reply(404) }), { ok: true });
  assert.deepEqual(await removeServerRide(SERVER, "r1", { fetchImpl: reply(401) }), {
    ok: false,
    reason: "unauthorized",
  });
  assert.deepEqual(await removeServerRide(SERVER, "r1", { fetchImpl: reply(500) }), { ok: false, reason: "failed" });
});

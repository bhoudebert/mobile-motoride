import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchTraffic, serverHasTraffic } from "../src/services/traffic.ts";

const server = { url: "https://rides.example.org", token: "mrt_" + "A".repeat(43) };
const points = [
  { distM: 0, atM: 0, lat: 50.12345, lon: 3.5 },
  { distM: 10_000, atM: 10_000, lat: 50.2, lon: 3.5 },
];
const reply = (status: number, body: unknown) =>
  (async () => ({ ok: status < 300, status, json: async () => body })) as unknown as typeof fetch;

test("the server's health says whether it has traffic, and anything else is no", async () => {
  assert.equal(await serverHasTraffic(server, { fetchImpl: reply(200, { ok: true, traffic: true }) }), true);
  assert.equal(await serverHasTraffic(server, { fetchImpl: reply(200, { ok: true, traffic: false }) }), false);
  assert.equal(await serverHasTraffic(server, { fetchImpl: reply(200, { ok: true }) }), false);
  assert.equal(await serverHasTraffic(server, { fetchImpl: reply(500, {}) }), false);
  assert.equal(
    await serverHasTraffic(server, {
      fetchImpl: (async () => {
        throw new TypeError("down");
      }) as unknown as typeof fetch,
    }),
    false,
  );
});

test("the points go as lat and lon to the server's /traffic with the token, and the levels come back", async () => {
  let seen: { url: string; init: RequestInit } | null = null;
  const fetchImpl = (async (url: string, init: RequestInit) => {
    seen = { url, init };
    return {
      ok: true,
      status: 200,
      json: async () => ({ budget: true, points: [{ level: "free" }, { level: "heavy" }] }),
    };
  }) as unknown as typeof fetch;
  const answer = await fetchTraffic(server, points, { fetchImpl });
  assert.deepEqual(answer, { levels: ["free", "heavy"], budget: true });
  assert.equal(seen!.url, "https://rides.example.org/traffic");
  assert.equal(seen!.init.method, "POST");
  assert.equal((seen!.init.headers as Record<string, string>).Authorization, `Bearer ${server.token}`);
  assert.deepEqual(JSON.parse(seen!.init.body as string), {
    points: [
      [50.12345, 3.5],
      [50.2, 3.5],
    ],
  });
});

test("the budget flag is passed on, and a refusal, a network failure or a wrong answer is null", async () => {
  const body = { budget: false, points: [{ level: "unknown" }, { level: "unknown" }] };
  assert.equal((await fetchTraffic(server, points, { fetchImpl: reply(200, body) }))?.budget, false);
  assert.equal(await fetchTraffic(server, points, { fetchImpl: reply(503, {}) }), null);
  assert.equal(await fetchTraffic(server, points, { fetchImpl: reply(200, { points: [] }) }), null);
  assert.equal(await fetchTraffic(server, [], { fetchImpl: reply(200, {}) }), null);
  assert.equal(
    await fetchTraffic(server, points, {
      fetchImpl: (async () => {
        throw new TypeError("down");
      }) as unknown as typeof fetch,
    }),
    null,
  );
});

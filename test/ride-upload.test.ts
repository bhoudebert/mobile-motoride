import assert from "node:assert/strict";
import { test } from "node:test";
import { uploadRide } from "../src/services/rideUpload.ts";

const SERVER = { url: "https://s.example", token: "t0k" };
const reply = (status: number, body: unknown = {}) =>
  (async () => ({ ok: status < 300, status, json: async () => body })) as unknown as typeof fetch;

test("a ride goes as the GPX it is, with the token, to its own address", async () => {
  let seen: { url: string; init: RequestInit } | undefined;
  const spy = (async (url: string, init: RequestInit) => {
    seen = { url, init };
    return {
      ok: true,
      status: 201,
      json: async () => ({ id: "ride 1", status: "created", roadbook: { id: 3, name: "Loop" } }),
    };
  }) as unknown as typeof fetch;
  const answer = await uploadRide(SERVER, "2026-10-31T09-00-00-loop", "<gpx/>", { fetchImpl: spy });
  assert.deepEqual(answer, { ok: true, id: "ride 1", status: "created", roadbook: { id: 3, name: "Loop" } });
  assert.equal(seen!.url, "https://s.example/rides/2026-10-31T09-00-00-loop");
  assert.equal(seen!.init.method, "PUT");
  assert.equal(seen!.init.body, "<gpx/>");
  assert.equal((seen!.init.headers as Record<string, string>)["Authorization"], "Bearer t0k");
});

test("200 is a ride replaced or unchanged, 201 a ride created, and the answer is read leniently", async () => {
  assert.deepEqual(
    await uploadRide(SERVER, "a", "x", { fetchImpl: reply(200, { id: "a", status: "unchanged", roadbook: null }) }),
    {
      ok: true,
      id: "a",
      status: "unchanged",
      roadbook: null,
    },
  );
  // A body that is not as promised does not make a stored ride a failure.
  assert.deepEqual(await uploadRide(SERVER, "a", "x", { fetchImpl: reply(201, "nope") }), {
    ok: true,
    id: "a",
    status: "created",
    roadbook: null,
  });
  assert.equal(
    ((await uploadRide(SERVER, "a", "x", { fetchImpl: reply(200, {}) })) as { status: string }).status,
    "replaced",
  );
});

test("each refusal is told apart, and nothing is thrown", async () => {
  const reason = async (status: number) =>
    (await uploadRide(SERVER, "a", "x", { fetchImpl: reply(status) }))["reason" as never];
  assert.equal(await reason(401), "unauthorized");
  assert.equal(await reason(404), "unsupported");
  assert.equal(await reason(405), "unsupported");
  assert.equal(await reason(409), "full");
  assert.equal(await reason(413), "tooLarge");
  assert.equal(await reason(429), "busy");
  assert.equal(await reason(400), "failed");
  assert.equal(await reason(415), "failed");
  assert.equal(await reason(500), "failed");
  const down = (async () => {
    throw new TypeError("Network request failed");
  }) as unknown as typeof fetch;
  assert.deepEqual(await uploadRide(SERVER, "a", "x", { fetchImpl: down }), { ok: false, reason: "unreachable" });
  const slow = (async () => {
    throw Object.assign(new Error("timed out"), { name: "TimeoutError" });
  }) as unknown as typeof fetch;
  assert.deepEqual(await uploadRide(SERVER, "a", "x", { fetchImpl: slow }), { ok: false, reason: "timeout" });
});

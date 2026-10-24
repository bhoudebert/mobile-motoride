import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCapabilities } from "../src/core/capabilities.ts";
import { fetchCapabilities } from "../src/services/capabilities.ts";

const server = { url: "https://rides.example.org", token: "mrt_" + "A".repeat(43) };
const reply = (status: number, body: unknown) =>
  (async () => ({ ok: status < 300, status, json: async () => body })) as unknown as typeof fetch;

test("a health answer says whether traffic is on and where it works, and anything unclear is no", () => {
  assert.deepEqual(parseCapabilities({ ok: true, traffic: true, trafficCountries: ["FR"] }), {
    traffic: true,
    countries: ["FR"],
  });
  assert.deepEqual(parseCapabilities({ traffic: true }), { traffic: true, countries: [] });
  assert.deepEqual(parseCapabilities({ traffic: "yes", trafficCountries: "FR" }), { traffic: false, countries: [] });
  assert.deepEqual(parseCapabilities({ traffic: true, trafficCountries: ["FR", "france", 3, "be"] }).countries, ["FR"]);
  assert.deepEqual(parseCapabilities(null), { traffic: false, countries: [] });
});

test("the capabilities come from the server's health, and null when it cannot be had", async () => {
  assert.deepEqual(
    await fetchCapabilities(server, { fetchImpl: reply(200, { traffic: true, trafficCountries: ["FR"] }) }),
    {
      traffic: true,
      countries: ["FR"],
    },
  );
  assert.equal(await fetchCapabilities(server, { fetchImpl: reply(500, {}) }), null);
  assert.equal(
    await fetchCapabilities(server, {
      fetchImpl: (async () => {
        throw new TypeError("down");
      }) as unknown as typeof fetch,
    }),
    null,
  );
});

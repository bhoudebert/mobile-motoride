import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { clearForecasts, fetchForecast } from "../src/services/weather.ts";

const body = {
  properties: {
    timeseries: [
      {
        time: "2026-10-22T09:00:00Z",
        data: {
          instant: { details: { air_temperature: 10, wind_speed: 5 } },
          next_1_hours: { summary: { symbol_code: "rain" }, details: { precipitation_amount: 1.2 } },
        },
      },
    ],
  },
};

beforeEach(() => clearForecasts());

const fake = (reply: () => Response | "down") => {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  const fn = (async (url: string, init: { headers: Record<string, string> }) => {
    calls.push({ url, headers: init.headers });
    const r = reply();
    if (r === "down") throw new Error("network");
    return r;
  }) as unknown as typeof fetch;
  return { fn, calls };
};
const ok = (expires?: string) =>
  new Response(JSON.stringify(body), { status: 200, headers: expires ? { expires } : {} });

test("a place is asked for with an identifying agent and a hundredth of a degree, not the exact position", async () => {
  const { fn, calls } = fake(() => ok());
  const hours = await fetchForecast(50.456789, 3.234567, { fetchImpl: fn });
  assert.equal(hours!.length, 1);
  assert.equal(hours![0]!.precipMm, 1.2);
  assert.equal(calls[0]!.url, "https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=50.46&lon=3.23");
  assert.match(calls[0]!.headers["User-Agent"]!, /^MobileMotoRide\//);
});

test("the same place is not asked for twice until the service says it will have changed", async () => {
  const { fn, calls } = fake(() => ok("Thu, 22 Oct 2026 09:30:00 GMT"));
  let now = Date.UTC(2026, 9, 22, 9, 0, 0);
  await fetchForecast(50.45, 3.2, { fetchImpl: fn, now: () => now });
  now += 20 * 60_000;
  await fetchForecast(50.451, 3.201, { fetchImpl: fn, now: () => now }); // the same hundredth of a degree
  assert.equal(calls.length, 1);
  now += 15 * 60_000; // past the Expires of 09:30
  await fetchForecast(50.45, 3.2, { fetchImpl: fn, now: () => now });
  assert.equal(calls.length, 2);
  // Another place is another request.
  await fetchForecast(50.6, 3.2, { fetchImpl: fn, now: () => now });
  assert.equal(calls.length, 3);
});

test("without an Expires the answer is kept ten minutes", async () => {
  const { fn, calls } = fake(() => ok());
  let now = 1_000_000;
  await fetchForecast(1, 1, { fetchImpl: fn, now: () => now });
  now += 9 * 60_000;
  await fetchForecast(1, 1, { fetchImpl: fn, now: () => now });
  assert.equal(calls.length, 1);
  now += 2 * 60_000;
  await fetchForecast(1, 1, { fetchImpl: fn, now: () => now });
  assert.equal(calls.length, 2);
});

test("a failure gives null, or what was kept when the service cannot be reached later", async () => {
  assert.equal(await fetchForecast(2, 2, { fetchImpl: fake(() => "down").fn }), null);
  assert.equal(await fetchForecast(2, 2, { fetchImpl: fake(() => new Response("x", { status: 503 })).fn }), null);
  assert.equal(await fetchForecast(2, 2, { fetchImpl: fake(() => new Response("{}", { status: 200 })).fn }), null);
  let now = 1_000_000;
  const good = fake(() => ok());
  await fetchForecast(3, 3, { fetchImpl: good.fn, now: () => now });
  now += 30 * 60_000;
  const stale = await fetchForecast(3, 3, { fetchImpl: fake(() => "down").fn, now: () => now });
  assert.equal(stale!.length, 1);
  const stale2 = await fetchForecast(3, 3, {
    fetchImpl: fake(() => new Response("x", { status: 429 })).fn,
    now: () => now,
  });
  assert.equal(stale2!.length, 1);
});

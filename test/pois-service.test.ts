import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchPois } from "../src/services/pois.ts";
import { cumulativeDistances } from "../src/core/track.ts";
import { drawLine } from "./helpers/path.ts";

const line = drawLine([{ straight: 100_000 }]);
const cum = cumulativeDistances(line);

const fake = (handler: (query: string, call: number) => Response | object | "down") => {
  const calls: string[] = [];
  const fn = (async (_url: string, init: { body: string }) => {
    const query = decodeURIComponent(init.body.replace(/^data=/, ""));
    calls.push(query);
    const r = handler(query, calls.length);
    if (r === "down") throw new Error("network");
    return r instanceof Response ? r : new Response(JSON.stringify(r), { status: 200 });
  }) as unknown as typeof fetch;
  return { fn, calls };
};

test("fuel stations are asked for along the whole route, in pieces, and the answers are joined", async () => {
  const { fn, calls } = fake((_q, n) => ({
    elements: [{ type: "node", id: n, lat: 50 + n / 1000, lon: 3, tags: { name: `S${n}` } }],
  }));
  const pois = await fetchPois("fuel", line, cum, { fetchImpl: fn, pause: async () => {} });
  assert.ok(calls.length >= 3 && calls.length <= 4, String(calls.length));
  assert.ok(calls.every((q) => q.includes('nwr["amenity"="fuel"](around:1500,')));
  assert.equal(pois!.length, calls.length);
  assert.deepEqual(
    pois!.map((p) => p.name),
    calls.map((_, i) => `S${i + 1}`),
  );
});

test("a stretch no server can answer makes the whole answer null, never a list with a hole", async () => {
  const { fn } = fake((_q, n) => (n >= 2 ? "down" : { elements: [] }));
  assert.equal(await fetchPois("fuel", line, cum, { fetchImpl: fn, pause: async () => {} }), null);
});

test("a remark (a query cut short) is not an answer", async () => {
  const { fn } = fake(() => ({ elements: [], remark: "runtime error: Query timed out" }));
  assert.equal(await fetchPois("fuel", line, cum, { fetchImpl: fn, pause: async () => {} }), null);
});

test("a route with no length is still asked once, and an empty answer is an empty list", async () => {
  const { fn, calls } = fake(() => ({ elements: [] }));
  const short = [line[0]!, line[0]!] as typeof line;
  const pois = await fetchPois("fuel", short, cumulativeDistances(short), { fetchImpl: fn, pause: async () => {} });
  assert.deepEqual(pois, []);
  assert.equal(calls.length, 1);
});

test("progress is reported and ends at 1", async () => {
  const { fn } = fake(() => ({ elements: [] }));
  const seen: number[] = [];
  await fetchPois("fuel", line, cum, { fetchImpl: fn, pause: async () => {}, onProgress: (s) => seen.push(s) });
  assert.ok(seen.length >= 3);
  assert.equal(seen.at(-1), 1);
  assert.deepEqual(
    [...seen].sort((a, b) => a - b),
    seen,
  );
});

test("a bakery is looked for with its own filter and a radius of 1 km, not the fuel one", async () => {
  const { fn, calls } = fake(() => ({
    elements: [{ type: "node", id: 1, lat: 50, lon: 3, tags: { name: "Chez Paul" } }],
  }));
  const short = drawLine([{ straight: 20_000 }]);
  const pois = await fetchPois("bakery", short, cumulativeDistances(short), { fetchImpl: fn, pause: async () => {} });
  assert.ok(calls[0]!.includes('nwr["shop"="bakery"](around:1000,'));
  assert.ok(!calls[0]!.includes("fuel"));
  assert.equal(pois![0]!.kind, "bakery");
  assert.equal(pois![0]!.name, "Chez Paul");
});

test("a search the rider waits for tries two servers, with 10 s each, and asks the pieces together", async () => {
  const seen: Array<{ query: string; at: number }> = [];
  const order: string[] = [];
  const fn = (async (url: string, init: { body: string }) => {
    order.push(url);
    seen.push({ query: decodeURIComponent(init.body), at: seen.length });
    throw new Error("down");
  }) as unknown as typeof fetch;
  const pauses: number[] = [];
  assert.equal(
    await fetchPois("bakery", line, cum, { fetchImpl: fn, pause: async (ms) => void pauses.push(ms), quick: true }),
    null,
  );
  const pieces = new Set(seen.map((s) => s.query)).size;
  assert.ok(pieces >= 3);
  // Two servers for each piece, and no pause between them.
  assert.equal(seen.length, pieces * 2);
  assert.deepEqual(pauses, []);
  assert.ok(seen.every((s) => s.query.includes("[timeout:10]")));
  // The pieces are asked together: the first attempt of every piece comes before the second attempt of the first.
  assert.equal(new Set(order.slice(0, pieces)).size, 1);
});

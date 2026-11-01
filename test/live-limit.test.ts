import assert from "node:assert/strict";
import { test } from "node:test";
import { unproject } from "../src/core/geo.ts";
import { dueForLimit, limitFromTrace, newLiveLimitState } from "../src/core/liveLimit.ts";
import { traceLimit } from "../src/services/liveLimit.ts";
import { REF } from "./helpers/path.ts";
import type { LatLon } from "../src/core/types.ts";

const at = (x: number): LatLon => unproject([x, 0], REF);

test("the limit is the posted one of the last road of the trail, with its road ref", () => {
  const got = limitFromTrace({
    edges: [
      { length: 100, speed_limit: 50 },
      { length: 200, speed_limit: 70, names: ["Rue des Prés", "D 954"] },
    ],
  });
  assert.deepEqual(got, { kmh: 70, posted: true, carried: false, next: null, road: "D 954" });
});

test("a road without a posted limit gets the legal default of its country, marked assumed", () => {
  const got = limitFromTrace({
    admins: [{ country_code: "FR" }],
    edges: [{ length: 300, road_class: "secondary", density: 2, end_node: { admin_index: 0 } }],
  });
  assert.equal(got?.kmh, 80);
  assert.equal(got?.posted, false);
  assert.equal(limitFromTrace({ edges: [] }), null);
});

test("a request is due once the trail has two points, then every 8 s and 80 m", () => {
  const s = newLiveLimitState();
  assert.equal(dueForLimit(s, at(0), 0), null, "one point is not a trail");
  const first = dueForLimit(s, at(30), 1000);
  assert.equal(first?.length, 2);
  assert.equal(dueForLimit(s, at(60), 5000), null, "too soon");
  assert.equal(dueForLimit(s, at(60), 10_000), null, "too near");
  assert.ok(dueForLimit(s, at(150), 10_000), "late enough and far enough");
  assert.equal(dueForLimit(s, at(150), 30_000), null, "a rider who has not moved is not asked again");
});

test("the trail keeps six points, 25 m apart at least", () => {
  const s = newLiveLimitState();
  for (let i = 0; i < 20; i++) dueForLimit(s, at(i * 30), i * 1000);
  assert.equal(s.trail.length, 6);
  const near = newLiveLimitState();
  dueForLimit(near, at(0), 0);
  dueForLimit(near, at(10), 1000);
  assert.equal(near.trail.length, 1);
});

test("the service asks the trail and gives the limit, or null on any failure", async () => {
  let body = "";
  const ok = (async (_u: string, init: RequestInit) => {
    body = String(init.body);
    return { ok: true, json: async () => ({ edges: [{ length: 10, speed_limit: 90 }] }) };
  }) as unknown as typeof fetch;
  assert.equal((await traceLimit([at(0), at(30)], { fetchImpl: ok }))?.kmh, 90);
  assert.equal(JSON.parse(body).shape.length, 2);
  const down = (async () => {
    throw new Error("x");
  }) as unknown as typeof fetch;
  assert.equal(await traceLimit([at(0), at(30)], { fetchImpl: down }), null);
  const bad = (async () => ({ ok: false })) as unknown as typeof fetch;
  assert.equal(await traceLimit([at(0), at(30)], { fetchImpl: bad }), null);
});

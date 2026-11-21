import assert from "node:assert/strict";
import { test } from "node:test";
import { chooseRoutes } from "../src/services/routeChoices.ts";
import { encodePolyline } from "./helpers/polyline.ts";
import { drawLine } from "./helpers/path.ts";
import { unproject } from "../src/core/geo.ts";
import { REF } from "./helpers/path.ts";
import type { LatLon } from "../src/core/types.ts";

const server = { url: "https://srv.example", token: "tok" };
const motorway: LatLon[] = drawLine([{ straight: 20_000 }], 100);
const back: LatLon[] = drawLine([{ straight: 5000 }, { arc: 900, deg: 90, dir: "left" }, { straight: 9000 }], 100);

/** A world: Valhalla answers the motorway for the fastest and the shortest, the back roads without motorway. */
function world(opts: { traffic: boolean; level?: string; trafficOk?: boolean }) {
  const calls: string[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push(url);
    if (url.includes("valhalla")) {
      const costing = JSON.parse(String(init?.body)).costing_options?.motorcycle ?? {};
      const line = costing.use_highways === 0 ? back : motorway;
      const time = costing.use_highways === 0 ? 1500 : 900;
      return {
        ok: true,
        json: async () => ({ trip: { legs: [{ shape: encodePolyline(line) }], summary: { time, length: 20 } } }),
      };
    }
    if (url.endsWith("/health")) return { ok: true, json: async () => ({ ok: true, traffic: opts.traffic }) };
    if (url.endsWith("/traffic")) {
      if (opts.trafficOk === false) return { ok: false };
      const n = JSON.parse(String(init?.body)).points.length;
      // Jam only on the motorway: its first point is on the line y = 0 east of the start.
      const pts = JSON.parse(String(init?.body)).points as number[][];
      const onMotorway = Math.abs(pts.at(-1)![0]! - motorway[0]![0]) < 1e-4;
      return {
        ok: true,
        json: async () => ({
          points: Array.from({ length: n }, () => ({ level: onMotorway ? (opts.level ?? "free") : "free" })),
        }),
      };
    }
    throw new Error(url);
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

const from = motorway[0]!;
const to = unproject([20_000, 0], REF);

test("without a server the routes are ranked by their own time and traffic is not asked", async () => {
  const w = world({ traffic: true, level: "heavy" });
  const out = await chooseRoutes(from, to, { server: null, enabled: true }, { fetchImpl: w.fetchImpl });
  assert.equal(out[0]!.kind, "fastest");
  assert.ok(!w.calls.some((u) => u.includes("srv.example")));
});

test("traffic turned off asks nothing of the server", async () => {
  const w = world({ traffic: true, level: "heavy" });
  await chooseRoutes(from, to, { server, enabled: false }, { fetchImpl: w.fetchImpl });
  assert.ok(!w.calls.some((u) => u.includes("srv.example")));
});

test("a server without traffic is asked its health only", async () => {
  const w = world({ traffic: false });
  const out = await chooseRoutes(from, to, { server, enabled: true }, { fetchImpl: w.fetchImpl });
  assert.equal(out[0]!.kind, "fastest");
  assert.ok(!w.calls.some((u) => u.endsWith("/traffic")));
});

test("a jam on the motorway puts the road without motorway first, and says what it costs", async () => {
  const w = world({ traffic: true, level: "heavy" });
  const out = await chooseRoutes(from, to, { server, enabled: true }, { fetchImpl: w.fetchImpl });
  assert.equal(out[0]!.kind, "noMotorway");
  const fastest = out.find((r) => r.kind === "fastest")!;
  assert.ok(fastest.delayS > 600, `delay ${fastest.delayS}`);
  assert.equal(w.calls.filter((u) => u.endsWith("/traffic")).length, 2, "one traffic request for each road");
});

test("traffic that does not answer leaves the routes ranked by their own time", async () => {
  const w = world({ traffic: true, level: "heavy", trafficOk: false });
  const out = await chooseRoutes(from, to, { server, enabled: true }, { fetchImpl: w.fetchImpl });
  assert.equal(out[0]!.kind, "fastest");
  assert.ok(out.every((r) => r.delayS === 0));
});

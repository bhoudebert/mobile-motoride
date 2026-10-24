import assert from "node:assert/strict";
import { test } from "node:test";
import { EnrichError, enrichRoadbook } from "../src/services/enrich.ts";
import { needsCompletion } from "../src/core/enrich.ts";
import type { LatLon, Roadbook } from "../src/core/types.ts";
import { drawLine } from "./helpers/path.ts";
import { encodePolyline } from "./helpers/polyline.ts";

const line = drawLine([{ straight: 8000 }]);
const rb: Roadbook = { id: "x", name: "GPX", description: "", stops: [], line };

/** A Valhalla that answers with the very points it was sent, as one road in France at 80. */
const valhalla = (body: { shape: Array<{ lat: number; lon: number }> }) => ({
  shape: encodePolyline(body.shape.map((p) => [p.lat, p.lon] as LatLon)),
  admins: [{ country_code: "FR", state_code: "HDF" }],
  edges: [
    {
      length: 1,
      road_class: "secondary",
      density: 2,
      names: ["D 938"],
      begin_shape_index: 0,
      end_shape_index: body.shape.length - 1,
      end_node: { admin_index: 0 },
    },
  ],
});

interface Call {
  url: string;
  body: string;
}
const fakeFetch = (handlers: {
  trace?: (b: any) => Response | object;
  overpass?: () => Response | object | "down";
}) => {
  const calls: Call[] = [];
  const fn = (async (url: string, init: { body: string; headers: Record<string, string> }) => {
    calls.push({ url, body: init.body });
    const reply = (x: unknown) =>
      x instanceof Object && "ok" in x ? x : { ok: true, status: 200, json: async () => x };
    if (url.includes("trace_attributes")) {
      assert.match(init.headers["User-Agent"]!, /^MobileMotoRide\//);
      assert.equal(init.headers["X-Client-Id"], "motoride");
      return reply(
        handlers.trace ? handlers.trace(JSON.parse(init.body)) : valhalla(JSON.parse(init.body)),
      ) as Response;
    }
    const r = handlers.overpass ? handlers.overpass() : { elements: [] };
    if (r === "down") throw new TypeError("Network request failed");
    return reply(r) as Response;
  }) as unknown as typeof fetch;
  return { fn, calls };
};

test("a GPX is completed: limits and countries from Valhalla, cameras from Overpass, progress reported", async () => {
  const mid = line[800]!;
  const { fn, calls } = fakeFetch({
    overpass: () => ({
      elements: [{ type: "node", id: 7, lat: mid[0], lon: mid[1], tags: { maxspeed: "70", direction: "90" } }],
    }),
  });
  const seen: Array<[number, string]> = [];
  const { roadbook, camerasMissing } = await enrichRoadbook(rb, {
    fetchImpl: fn,
    onProgress: (s, w) => seen.push([s, w]),
  });
  assert.equal(camerasMissing, false);
  assert.equal(needsCompletion(roadbook), false);
  assert.equal(roadbook.countries?.[0]?.code, "FR");
  assert.equal(roadbook.limits?.[0]?.kmh, 80);
  assert.equal(roadbook.cameras?.length, 1);
  assert.equal(roadbook.cameras?.[0]?.kmh, 70);
  assert.ok(calls.some((c) => c.url.includes("trace_attributes")));
  assert.ok(calls.some((c) => c.url.includes("overpass")));
  const trace = JSON.parse(calls.find((c) => c.url.includes("trace_attributes"))!.body);
  assert.equal(trace.shape_match, "map_snap");
  assert.equal(trace.costing, "motorcycle");
  assert.ok(trace.shape.length < line.length / 3, "the line is thinned before it is sent");
  assert.match(decodeURIComponent(calls.find((c) => c.url.includes("overpass"))!.body), /speed_camera/);
  assert.equal(seen.at(-1)![0], 1);
  assert.ok(seen.every(([s], i) => i === 0 || s >= seen[i - 1]![0]));
});

test("a long line goes to Valhalla in pieces", async () => {
  const long = drawLine([{ straight: 80_000 }]); // 16,000 points, more than one piece after thinning
  const { fn, calls } = fakeFetch({});
  const { roadbook } = await enrichRoadbook({ ...rb, line: long }, { fetchImpl: fn, pause: async () => {} });
  const traces = calls.filter((c) => c.url.includes("trace_attributes"));
  assert.ok(traces.length >= 2, `${traces.length} pieces`);
  assert.equal(roadbook.limits?.length, 1, "the pieces join into one stretch of one road");
});

test("when only the cameras cannot be had, the roadbook is still completed and says so", async () => {
  const { fn } = fakeFetch({ overpass: () => "down" });
  const { roadbook, camerasMissing } = await enrichRoadbook(rb, { fetchImpl: fn, pause: async () => {} });
  assert.equal(camerasMissing, true);
  assert.equal(roadbook.limits?.length, 1);
  assert.deepEqual(roadbook.cameras, []);
  const bad = fakeFetch({ overpass: () => ({ ok: false, status: 504, json: async () => ({}) }) });
  assert.equal((await enrichRoadbook(rb, { fetchImpl: bad.fn, pause: async () => {} })).camerasMissing, true);
});

test("when the roads cannot be matched it says why", async () => {
  const busy = fakeFetch({ trace: () => ({ ok: false, status: 429, json: async () => ({}) }) });
  await assert.rejects(
    enrichRoadbook(rb, { fetchImpl: busy.fn }),
    (e: Error) => e instanceof EnrichError && /busy/.test(e.message),
  );
  const failed = fakeFetch({ trace: () => ({ ok: false, status: 400, json: async () => ({}) }) });
  await assert.rejects(enrichRoadbook(rb, { fetchImpl: failed.fn }), /could not match this route \(400\)/);
  const offline = (async () => {
    throw new TypeError("offline");
  }) as unknown as typeof fetch;
  await assert.rejects(enrichRoadbook(rb, { fetchImpl: offline }), /could not be reached/);
});

test("a busy Overpass server is left for a mirror, and a query cut short is asked again elsewhere", async () => {
  const urls: string[] = [];
  let n = 0;
  const fn = (async (url: string, init: { body: string }) => {
    if (url.includes("trace_attributes"))
      return { ok: true, status: 200, json: async () => valhalla(JSON.parse(init.body)) };
    urls.push(url);
    n++;
    if (n === 1) return { ok: false, status: 429, json: async () => ({}) };
    if (n === 2)
      return { ok: true, status: 200, json: async () => ({ elements: [], remark: "runtime error: timeout" }) };
    return {
      ok: true,
      status: 200,
      json: async () => ({ elements: [{ type: "node", id: 1, lat: 50.4, lon: 3.2, tags: {} }] }),
    };
  }) as unknown as typeof fetch;
  const { roadbook, camerasMissing } = await enrichRoadbook(rb, { fetchImpl: fn, pause: async () => {} });
  assert.equal(camerasMissing, false);
  assert.equal(roadbook.cameras?.length, 1);
  assert.ok(
    urls[0]!.includes("overpass-api.de") &&
      urls[1]!.includes("openstreetmap.fr") &&
      urls[2]!.includes("z.overpass-api.de"),
  );
});

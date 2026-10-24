import assert from "node:assert/strict";
import { test } from "node:test";
import { APPROACH_MIN_M, distanceToLineM, needsApproach, withApproach } from "../src/core/approach.ts";
import { haversineM } from "../src/core/geo.ts";
import { createNavigator } from "../src/core/navigator.ts";
import { approachFeature } from "../src/core/geojson.ts";
import { decodePolyline } from "../src/core/polyline.ts";
import { prepareRoadbook } from "../src/core/roadbook.ts";
import { pointAt } from "../src/core/track.ts";
import { routeToStart } from "../src/services/valhalla.ts";
import { drawLine, fixAt } from "./helpers/path.ts";
import { encodePolyline as encode } from "./helpers/polyline.ts";
import type { LatLon } from "../src/core/types.ts";

// A roadbook: 2 km east, a left junction, 1 km north; its stops are its two ends.
const roadbook = () => {
  const line = drawLine([{ straight: 2000 }, { arc: 15, deg: 90, dir: "left" }, { straight: 1000 }]);
  const a = line[0]!;
  const b = line.at(-1)!;
  return prepareRoadbook({
    id: "t",
    name: "t",
    description: "",
    line,
    stops: [
      { lat: a[0], lon: a[1], name: "Start" },
      { lat: b[0], lon: b[1], name: "Finish" },
    ],
  });
};

/** The line moved so that it ends at `target`: an approach that arrives at the start. */
const endingAt = (line: LatLon[], target: LatLon): LatLon[] => {
  const last = line.at(-1)!;
  return line.map(([lat, lon]): LatLon => [lat + target[0] - last[0], lon + target[1] - last[1]]);
};

const approachLine = (rb: ReturnType<typeof roadbook>): LatLon[] =>
  endingAt(drawLine([{ straight: 3000 }]), rb.roadbook.line[0]!);

test("polyline round trip at precision 6", () => {
  const pts: LatLon[] = [
    [50.455201, 3.20384],
    [50.60485, 3.61783],
    [-33.8688, 151.2093],
  ];
  const back = decodePolyline(encode(pts));
  assert.equal(back.length, 3);
  back.forEach((p, i) => assert.ok(haversineM(p, pts[i]!) < 0.5));
});

test("an approach is needed beyond 150 m from the line, not within", () => {
  const rb = roadbook();
  const on = pointAt(rb.roadbook.line, rb.cumulativeM, 1000);
  assert.equal(needsApproach(rb, on), false);
  const near: LatLon = [on[0] + 0.0005, on[1]]; // about 55 m
  assert.equal(needsApproach(rb, near), false);
  const far: LatLon = [on[0] + 0.003, on[1]]; // about 330 m
  assert.equal(needsApproach(rb, far), true);
  assert.ok(distanceToLineM(rb, far) > APPROACH_MIN_M);
});

test("the approach and the roadbook are one line, with the stops moved along", () => {
  const rb = roadbook();
  const approach = approachLine(rb);
  const joined = withApproach(rb, approach, false);
  assert.ok(joined.approachM > 2000, `approach ${joined.approachM}`);
  assert.ok(Math.abs(joined.totalM - rb.totalM - joined.approachM) < 40);
  assert.ok(Math.abs(joined.stops[0]!.atM - joined.approachM) < 1);
  assert.ok(Math.abs(joined.stops[1]!.atM - (rb.stops[1]!.atM + joined.approachM)) < 1);
  assert.equal(joined.approachDirect, false);
  assert.ok((approachFeature(joined)?.geometry.coordinates.length ?? 0) >= approach.length - 1);
  assert.equal(approachFeature(rb), null);
});

test("on the approach: phase, distance to the start, then the roadbook takes over", () => {
  const rb = roadbook();
  const joined = withApproach(rb, approachLine(rb), false);
  const nav = createNavigator(joined);
  const early = nav.update(fixAt(pointAt(joined.roadbook.line, joined.cumulativeM, 500), 60, 1000));
  assert.equal(early.phase, "approach");
  assert.ok(Math.abs(early.toStartM - (joined.approachM - 500)) < 3);
  assert.equal(early.offRoute, false);
  const onRoadbook = nav.update(
    fixAt(pointAt(joined.roadbook.line, joined.cumulativeM, joined.approachM + 200), 60, 2000),
  );
  assert.equal(onRoadbook.phase, "ride");
  assert.equal(onRoadbook.toStartM, 0);
});

test("an approach with a turn gives instructions and warnings like the roadbook", () => {
  const rb = roadbook();
  const route = endingAt(
    drawLine([{ straight: 1500 }, { arc: 15, deg: 90, dir: "right" }, { straight: 500 }]),
    rb.roadbook.line[0]!,
  );
  const joined = withApproach(rb, route, false);
  const turn = joined.maneuvers[0]!;
  assert.equal(turn.direction, "right");
  assert.ok(turn.atM < joined.approachM);
});

test("a straight-line approach says so and cannot be left", () => {
  const rb = roadbook();
  const start = rb.roadbook.line[0]!;
  const rider: LatLon = [start[0], start[1] - 0.05]; // about 3.5 km west
  const joined = withApproach(rb, [rider], true);
  assert.equal(joined.approachDirect, true);
  const nav = createNavigator(joined);
  nav.update(fixAt(rider, 15, 0));
  const aside: LatLon = [rider[0] + 0.002, rider[1] + 0.01]; // well off the straight line
  nav.update(fixAt(aside, 15, 1000));
  nav.update(fixAt(aside, 15, 2000));
  const s = nav.update(fixAt(aside, 15, 3000));
  assert.equal(s.phase, "approach");
  assert.equal(s.offRoute, false);
  assert.match(s.instruction.text, /^Straight to the start /);
});

const okFetch = (shape: string) =>
  (async () => ({ ok: true, json: async () => ({ trip: { legs: [{ shape }] } }) })) as any;

test("routeToStart reads the leg shape", async () => {
  const pts: LatLon[] = [
    [50.4, 3.1],
    [50.41, 3.12],
    [50.4552, 3.2038],
  ];
  const line = await routeToStart([50.4, 3.1], [50.4552, 3.2038], { fetchImpl: okFetch(encode(pts)) });
  assert.equal(line?.length, 3);
});

test("routeToStart says who it is to the public Valhalla server: a User-Agent and an X-Client-Id", async () => {
  let headers: Record<string, string> = {};
  const spy = (async (_url: string, init: { headers: Record<string, string> }) => {
    headers = init.headers;
    return { ok: false };
  }) as any;
  await routeToStart([50.4, 3.1], [50.45, 3.2], { fetchImpl: spy });
  assert.match(headers["User-Agent"]!, /^MobileMotoRide\//);
  assert.equal(headers["X-Client-Id"], "motoride");
});

test("routeToStart gives null on an HTTP error, a bad body, a network error and a timeout", async () => {
  const from: LatLon = [50.4, 3.1];
  const to: LatLon = [50.45, 3.2];
  assert.equal(await routeToStart(from, to, { fetchImpl: (async () => ({ ok: false })) as any }), null);
  assert.equal(
    await routeToStart(from, to, { fetchImpl: (async () => ({ ok: true, json: async () => ({}) })) as any }),
    null,
  );
  assert.equal(
    await routeToStart(from, to, { fetchImpl: (async () => Promise.reject(new Error("offline"))) as any }),
    null,
  );
  const hang = ((_: unknown, init: RequestInit) =>
    new Promise((_resolve, reject) =>
      init.signal?.addEventListener("abort", () => reject(new Error("aborted"))),
    )) as any;
  assert.equal(await routeToStart(from, to, { fetchImpl: hang, timeoutMs: 20 }), null);
});

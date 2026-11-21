import assert from "node:assert/strict";
import { test } from "node:test";
import { APPROACH_MIN_M, distanceToLineM, needsApproach, withApproach } from "../src/core/approach.ts";
import { haversineM } from "../src/core/geo.ts";
import { createNavigator } from "../src/core/navigator.ts";
import { approachFeature } from "../src/core/geojson.ts";
import { decodePolyline } from "../src/core/polyline.ts";
import { prepareRoadbook } from "../src/core/roadbook.ts";
import { pointAt } from "../src/core/track.ts";
import { resetServersWithoutRoute, routesToPlace, routeToStart } from "../src/services/valhalla.ts";
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

test("routeToStart sends the rider's heading, so the route starts in their direction of travel", async () => {
  let body: any = null;
  const spy = (async (_url: string, init: { body: string }) => {
    body = JSON.parse(init.body);
    return { ok: false };
  }) as any;
  await routeToStart([50.4, 3.1], [50.45, 3.2], { fetchImpl: spy, headingDeg: 87.6 });
  assert.equal(body.locations[0].heading, 88);
  assert.equal(body.locations[0].heading_tolerance, 60);
  assert.equal(body.locations[1].heading, undefined);
  await routeToStart([50.4, 3.1], [50.45, 3.2], { fetchImpl: spy });
  assert.equal(body.locations[0].heading, undefined, "no heading, nothing sent");
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

test("routesToPlace asks the fastest, the one without motorway and the shortest, and reads their time and length", async () => {
  const bodies: any[] = [];
  const pts: LatLon[] = [
    [50.4, 3.1],
    [50.41, 3.12],
  ];
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)));
    return {
      ok: true,
      json: async () => ({
        trip: { legs: [{ shape: encode(pts) }], summary: { time: 600 + bodies.length, length: 12.5 } },
      }),
    };
  }) as unknown as typeof fetch;
  const routes = await routesToPlace([50.4, 3.1], [50.41, 3.12], { fetchImpl });
  assert.deepEqual(
    routes.map((r) => r.kind),
    ["fastest", "noMotorway", "shortest"],
  );
  assert.equal(routes[0]!.lengthM, 12_500);
  assert.ok(routes[0]!.timeS > 600);
  const options = bodies.map((b) => b.costing_options.motorcycle);
  assert.deepEqual(options, [{ use_highways: 1 }, { use_highways: 0 }, { shortest: true }]);
});

test("routesToPlace leaves out a way that failed, and gives none when all fail", async () => {
  let n = 0;
  const pts: LatLon[] = [
    [50.4, 3.1],
    [50.41, 3.12],
  ];
  const flaky = (async () => {
    n++;
    if (n === 2) return { ok: false };
    return { ok: true, json: async () => ({ trip: { legs: [{ shape: encode(pts) }] } }) };
  }) as unknown as typeof fetch;
  const routes = await routesToPlace([50.4, 3.1], [50.41, 3.12], { fetchImpl: flaky });
  assert.deepEqual(
    routes.map((r) => r.kind),
    ["fastest", "shortest"],
  );
  assert.ok(routes[0]!.timeS > 0, "a route with no summary still has a time");
  const down = (async () => {
    throw new Error("offline");
  }) as unknown as typeof fetch;
  assert.deepEqual(await routesToPlace([50.4, 3.1], [50.41, 3.12], { fetchImpl: down }), []);
});

test("routesToPlace adds the other roads Valhalla gives for the best route, as alternatives", async () => {
  const pts = (n: number): LatLon[] => [
    [50.4, 3.1],
    [50.41 + n / 100, 3.12],
  ];
  const requests: any[] = [];
  const fetchImpl = (async (_u: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    requests.push(body);
    const trip = (n: number, time: number) => ({
      legs: [{ shape: encode(pts(n)) }],
      summary: { time, length: 10 + n },
    });
    return {
      ok: true,
      json: async () => ({
        trip: trip(0, 600),
        ...(body.alternates ? { alternates: [{ trip: trip(1, 800) }, { trip: trip(2, 900) }] } : {}),
      }),
    };
  }) as unknown as typeof fetch;
  const routes = await routesToPlace([50.4, 3.1], [50.41, 3.12], { fetchImpl });
  assert.deepEqual(
    routes.map((r) => r.kind),
    ["fastest", "noMotorway", "shortest", "alternative", "alternative"],
  );
  assert.equal(requests.filter((r) => r.alternates).length, 1, "only the best route is asked for other roads");
  assert.equal(routes[3]!.timeS, 800);
});

// ---- Routes come from the rider's server first (ADR 0054)

const serverSetting = { url: "https://ride.example.org", token: "mrt_abc" };
const tripBody = (pts: LatLon[]) => ({ trip: { legs: [{ shape: encode(pts) }], summary: { time: 600, length: 5 } } });
const reply = (status: number, body: unknown = {}) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response;
const PTS: LatLon[] = [
  [50.4, 3.1],
  [50.45, 3.2],
];

test("a rider with a server gets the route from it, with their token, and the public service is not called", async () => {
  resetServersWithoutRoute();
  const urls: string[] = [];
  let auth = "";
  const fetchImpl = (async (url: string, init: RequestInit) => {
    urls.push(url);
    auth = (init.headers as Record<string, string>)["Authorization"] ?? "";
    return reply(200, tripBody(PTS));
  }) as unknown as typeof fetch;
  const line = await routeToStart(PTS[0]!, PTS[1]!, { fetchImpl, server: serverSetting });
  assert.equal(line?.length, 2);
  assert.deepEqual(urls, ["https://ride.example.org/route"]);
  assert.equal(auth, "Bearer mrt_abc");
});

test("a server without /route sends the route to the public service, and is not asked again", async () => {
  resetServersWithoutRoute();
  const urls: string[] = [];
  const fetchImpl = (async (url: string) => {
    urls.push(url);
    return url.startsWith(serverSetting.url) ? reply(404) : reply(200, tripBody(PTS));
  }) as unknown as typeof fetch;
  assert.equal((await routeToStart(PTS[0]!, PTS[1]!, { fetchImpl, server: serverSetting }))?.length, 2);
  assert.equal((await routeToStart(PTS[0]!, PTS[1]!, { fetchImpl, server: serverSetting }))?.length, 2);
  assert.deepEqual(
    urls.map((u) => new URL(u).hostname),
    ["ride.example.org", "valhalla1.openstreetmap.de", "valhalla1.openstreetmap.de"],
  );
});

test("a busy, down or silent server falls back to the public service, and is asked again next time", async () => {
  resetServersWithoutRoute();
  for (const failure of [() => reply(503), () => reply(429), () => Promise.reject(new Error("offline"))]) {
    const urls: string[] = [];
    const fetchImpl = (async (url: string) => {
      urls.push(url);
      return url.startsWith(serverSetting.url) ? failure() : reply(200, tripBody(PTS));
    }) as unknown as typeof fetch;
    assert.equal((await routeToStart(PTS[0]!, PTS[1]!, { fetchImpl, server: serverSetting }))?.length, 2);
    assert.equal(urls.length, 2);
  }
  // A server that only answers late.
  const slow = (async (url: string, init: RequestInit) =>
    url.startsWith(serverSetting.url)
      ? new Promise<Response>((_, reject) => init.signal?.addEventListener("abort", () => reject(new Error("aborted"))))
      : reply(200, tripBody(PTS))) as unknown as typeof fetch;
  assert.equal(
    (await routeToStart(PTS[0]!, PTS[1]!, { fetchImpl: slow, server: serverSetting, timeoutMs: 30 }))?.length,
    2,
  );
});

test("a server that finds no road between the places is believed: the public service is not asked", async () => {
  resetServersWithoutRoute();
  const urls: string[] = [];
  const fetchImpl = (async (url: string) => {
    urls.push(url);
    return reply(422, { error: "no_route" });
  }) as unknown as typeof fetch;
  assert.equal(await routeToStart(PTS[0]!, PTS[1]!, { fetchImpl, server: serverSetting }), null);
  assert.equal(urls.length, 1);
});

test("the three ways go to the server in the same request the public service gets", async () => {
  resetServersWithoutRoute();
  const sent: Array<{ url: string; body: any }> = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    sent.push({ url, body: JSON.parse(String(init.body)) });
    return reply(200, tripBody(PTS));
  }) as unknown as typeof fetch;
  await routesToPlace(PTS[0]!, PTS[1]!, { fetchImpl, server: serverSetting });
  assert.equal(sent.length, 3);
  assert.ok(sent.every((s) => s.url === "https://ride.example.org/route"));
  const ways = sent.map((s) => JSON.stringify(s.body.costing_options?.motorcycle)).sort();
  assert.deepEqual(
    ways,
    [
      JSON.stringify({ shortest: true }),
      JSON.stringify({ use_highways: 0 }),
      JSON.stringify({ use_highways: 1 }),
    ].sort(),
  );
});

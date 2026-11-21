import { decodePolyline } from "../core/polyline.ts";
import { type RouteCandidate, type RouteKind } from "../core/routeChoices.ts";
import { cumulativeDistances } from "../core/track.ts";
import type { LatLon } from "../core/types.ts";

const ROUTE_URL = "https://valhalla1.openstreetmap.de/route";
// Contact-style agent: some public instances reject free-text agents (same as agentRide).
const USER_AGENT = "MobileMotoRide/0.0.0 (+https://github.com/bhoudebert/mobile-motoride)";
/** The public Valhalla server asks apps that use it to say who they are, beside the User-Agent (FOSSGIS demo server notice). */
export const CLIENT_ID = "motoride";

export interface RouteOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** The rider's heading: the route starts in that direction when the road allows, rather than sending them back. */
  headingDeg?: number;
}

interface Costing {
  /** Valhalla's motorcycle options: `use_highways` 0 to 1, `shortest`. */
  [option: string]: number | boolean;
}

interface Answer {
  line: LatLon[];
  timeS: number;
  lengthM: number;
}

type Trip = { legs?: { shape?: string }[]; summary?: { time?: number; length?: number } };

function answerOf(trip: Trip | undefined): Answer | null {
  const shape = trip?.legs?.[0]?.shape;
  const line = shape ? decodePolyline(shape) : [];
  if (line.length < 2) return null;
  const { time, length } = trip?.summary ?? {};
  return {
    line,
    timeS: typeof time === "number" && Number.isFinite(time) ? time : 0,
    lengthM: typeof length === "number" && Number.isFinite(length) ? length * 1000 : 0,
  };
}

/** What Valhalla answers: the best route, then the `alternates` other roads it was asked for. */
async function requestRoutes(
  from: LatLon,
  to: LatLon,
  costing: Costing,
  options: RouteOptions,
  alternates = 0,
): Promise<Answer[]> {
  const { fetchImpl = fetch, timeoutMs = 10_000, headingDeg } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(ROUTE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        "X-Client-Id": CLIENT_ID,
        Accept: "application/json",
      },
      body: JSON.stringify({
        locations: [
          {
            lat: from[0],
            lon: from[1],
            ...(headingDeg === undefined ? {} : { heading: Math.round(headingDeg) % 360, heading_tolerance: 60 }),
          },
          { lat: to[0], lon: to[1] },
        ],
        costing: "motorcycle",
        ...(Object.keys(costing).length ? { costing_options: { motorcycle: costing } } : {}),
        ...(alternates > 0 ? { alternates } : {}),
        directions_type: "none",
      }),
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { trip?: Trip; alternates?: { trip?: Trip }[] };
    const all = [
      answerOf(body.trip),
      ...(Array.isArray(body.alternates) ? body.alternates.map((a) => answerOf(a?.trip)) : []),
    ];
    return all.filter((a): a is Answer => a !== null);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One motorcycle route from `from` to `to` on the public Valhalla service (ADR 0008), or null
 * when it cannot be had in time: the caller falls back to a straight line.
 */
export async function routeToStart(from: LatLon, to: LatLon, options: RouteOptions = {}): Promise<LatLon[] | null> {
  return (await requestRoutes(from, to, {}, options))[0]?.line ?? null;
}

/** The ways asked for, as Valhalla's motorcycle options (ADR 0053). */
const KIND_COSTING: Record<NamedKind, Costing> = {
  fastest: { use_highways: 1 },
  noMotorway: { use_highways: 0 },
  shortest: { shortest: true },
};
type NamedKind = Exclude<RouteKind, "alternative">;
const NAMED_KINDS: NamedKind[] = ["fastest", "noMotorway", "shortest"];
/** How many other roads the best route is asked with. */
const ALTERNATES = 2;

/**
 * The routes to a place by the three ways (fastest, without motorway, shortest), asked together; a way that could not be had
 * is left out. A route whose time is not known is given the time of its length at 60 km/h.
 */
export async function routesToPlace(from: LatLon, to: LatLon, options: RouteOptions = {}): Promise<RouteCandidate[]> {
  const answers = await Promise.all(
    NAMED_KINDS.map((kind) =>
      requestRoutes(from, to, KIND_COSTING[kind], options, kind === "fastest" ? ALTERNATES : 0),
    ),
  );
  const out: RouteCandidate[] = [];
  const add = (kind: RouteKind, a: Answer) => {
    const lengthM = a.lengthM || cumulativeDistances(a.line).at(-1) || 0;
    out.push({ kind, line: a.line, lengthM, timeS: a.timeS || Math.round(lengthM / (60 / 3.6)) });
  };
  NAMED_KINDS.forEach((kind, i) => {
    if (answers[i]![0]) add(kind, answers[i]![0]!);
  });
  // The other roads of the best route: they fill the choice where the three ways follow the same road.
  const fastest = answers[NAMED_KINDS.indexOf("fastest")]!;
  for (const a of fastest.slice(1)) add("alternative", a);
  return out;
}

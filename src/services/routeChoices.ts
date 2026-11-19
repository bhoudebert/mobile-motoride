import type { ServerSetting } from "../core/liveShare.ts";
import { choicePoints, distinctRoutes, MAX_CHOICES, rankRoutes, type RouteChoice } from "../core/routeChoices.ts";
import type { LatLon } from "../core/types.ts";
import { fetchCapabilities } from "./capabilities.ts";
import { fetchTraffic } from "./traffic.ts";
import { routesToPlace } from "./valhalla.ts";

export interface ChooseOptions {
  fetchImpl?: typeof fetch;
  /** How long the traffic is waited for: a slow server does not hold the rider back. */
  trafficTimeoutMs?: number;
}

/** What the traffic of the rider's server may be used for: a server, and traffic not turned off (spec traffic). */
export interface TrafficUse {
  server: ServerSetting | null;
  enabled: boolean;
}

/**
 * The routes to a place, once each road, the one to ride first the first (spec destination-routing, "Choose between routes"). The time of each
 * is that of the road plus the delay of its jams when the rider's server has traffic; otherwise their own. Empty when none could be had.
 */
export async function chooseRoutes(
  from: LatLon,
  to: LatLon,
  use: TrafficUse,
  options: ChooseOptions = {},
): Promise<RouteChoice[]> {
  const { fetchImpl, trafficTimeoutMs = 6000 } = options;
  const routes = distinctRoutes(await routesToPlace(from, to, fetchImpl ? { fetchImpl } : {})).slice(0, MAX_CHOICES);
  const { server } = use;
  if (routes.length < 2 || !server || !use.enabled) return rankRoutes(routes, null);
  const net = { timeoutMs: trafficTimeoutMs, ...(fetchImpl ? { fetchImpl } : {}) };
  const caps = await fetchCapabilities(server, net);
  if (caps?.traffic !== true) return rankRoutes(routes, null);
  const traffic = await Promise.all(
    routes.map(async (r) => {
      const points = choicePoints(r.line);
      const answer = await fetchTraffic(
        server,
        points.map((p, i) => ({ distM: i, atM: i, lat: p.lat, lon: p.lon })),
        net,
      );
      return answer ? { points, levels: answer.levels } : null;
    }),
  );
  return rankRoutes(routes, traffic);
}

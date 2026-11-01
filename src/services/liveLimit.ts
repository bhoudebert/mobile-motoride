import { limitFromTrace } from "../core/liveLimit.ts";
import type { TraceResponse } from "../core/enrich.ts";
import type { SpeedLimit } from "../core/limits.ts";
import type { LatLon } from "../core/types.ts";
import { CLIENT_ID } from "./valhalla.ts";

const TRACE_URL = "https://valhalla1.openstreetmap.de/trace_attributes";
const USER_AGENT = "MobileMotoRide/0.0.0 (+https://github.com/bhoudebert/mobile-motoride)";

/**
 * The limit of the road under a short trail of positions, from the public Valhalla map matching (as ADR 0026 does for
 * a GPX), or null when it cannot be had in time: the caller keeps what it had.
 */
export async function traceLimit(
  trail: LatLon[],
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<SpeedLimit | null> {
  const { fetchImpl = fetch, timeoutMs = 6_000 } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(TRACE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        "X-Client-Id": CLIENT_ID,
        Accept: "application/json",
      },
      body: JSON.stringify({
        shape: trail.map(([lat, lon]) => ({ lat, lon })),
        shape_match: "map_snap",
        costing: "motorcycle",
        filters: {
          action: "include",
          attributes: [
            "edge.speed_limit",
            "edge.road_class",
            "edge.density",
            "edge.names",
            "node.admin_index",
            "admin.country_code",
            "admin.state_code",
          ],
        },
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return limitFromTrace((await res.json()) as TraceResponse);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

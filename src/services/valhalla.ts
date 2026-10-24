import { decodePolyline } from "../core/polyline.ts";
import type { LatLon } from "../core/types.ts";

const ROUTE_URL = "https://valhalla1.openstreetmap.de/route";
// Contact-style agent: some public instances reject free-text agents (same as agentRide).
const USER_AGENT = "MobileMotoRide/0.0.0 (+https://github.com/bhoudebert/mobile-motoride)";
/** The public Valhalla server asks apps that use it to say who they are, beside the User-Agent (FOSSGIS demo server notice). */
export const CLIENT_ID = "motoride";

export interface RouteOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * One motorcycle route from `from` to `to` on the public Valhalla service (ADR 0008), or null
 * when it cannot be had in time: the caller falls back to a straight line.
 */
export async function routeToStart(from: LatLon, to: LatLon, options: RouteOptions = {}): Promise<LatLon[] | null> {
  const { fetchImpl = fetch, timeoutMs = 10_000 } = options;
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
          { lat: from[0], lon: from[1] },
          { lat: to[0], lon: to[1] },
        ],
        costing: "motorcycle",
        directions_type: "none",
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { trip?: { legs?: { shape?: string }[] } };
    const shape = body.trip?.legs?.[0]?.shape;
    const line = shape ? decodePolyline(shape) : [];
    return line.length >= 2 ? line : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

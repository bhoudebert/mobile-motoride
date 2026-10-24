import type { ServerSetting } from "../core/liveShare.ts";
import { fetchCapabilities } from "./capabilities.ts";
import { parseTraffic, type TrafficLevel, type TrafficPoint } from "../core/traffic.ts";

export interface TrafficOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/** Whether the rider's server has a traffic source (its health answer says so); false when it cannot be told. */
export async function serverHasTraffic(server: ServerSetting, options: TrafficOptions = {}): Promise<boolean> {
  return (await fetchCapabilities(server, options))?.traffic === true;
}

export type TrafficAnswer = { levels: TrafficLevel[]; budget: boolean } | null;

/**
 * The levels of traffic at the points, from the rider's own server (ADR 0040), or null when it could not be had. The points are on
 * the road ahead: they go to the server the rider chose and to nobody else.
 */
export async function fetchTraffic(
  server: ServerSetting,
  points: TrafficPoint[],
  options: TrafficOptions = {},
): Promise<TrafficAnswer> {
  const { fetchImpl = fetch, timeoutMs = 12_000 } = options;
  if (points.length === 0) return null;
  try {
    const res = await fetchImpl(`${server.url}/traffic`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${server.token}` },
      body: JSON.stringify({ points: points.map((p) => [p.lat, p.lon]) }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    const levels = parseTraffic(body, points.length);
    if (!levels) return null;
    return { levels, budget: (body as { budget?: unknown }).budget !== false };
  } catch {
    return null;
  }
}

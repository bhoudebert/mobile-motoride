import type { OverpassElement } from "../core/enrich.ts";

// Public Overpass servers shed load with 429 and 504 and differ in latency: alternate between the main one and mirrors.
const OVERPASS_ATTEMPTS: Array<{ url: string; waitMs: number }> = [
  { url: "https://overpass-api.de/api/interpreter", waitMs: 0 },
  { url: "https://overpass.openstreetmap.fr/api/interpreter", waitMs: 0 },
  { url: "https://z.overpass-api.de/api/interpreter", waitMs: 2000 },
  { url: "https://overpass.openstreetmap.fr/api/interpreter", waitMs: 4000 },
];
export const USER_AGENT = "MobileMotoRide/0.0.0 (+https://github.com/bhoudebert/mobile-motoride)";

export async function post(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** The elements of one Overpass query, or null when no server could answer it. */
export async function overpass(
  fetchImpl: typeof fetch,
  query: string,
  timeoutMs: number,
  pause: (ms: number) => Promise<void>,
  /** How many of the servers to try: a search the rider waits for tries two, a roadbook being completed all four. */
  attempts = OVERPASS_ATTEMPTS.length,
): Promise<OverpassElement[] | null> {
  for (const { url, waitMs } of OVERPASS_ATTEMPTS.slice(0, attempts)) {
    if (waitMs) await pause(waitMs);
    try {
      const res = await post(
        fetchImpl,
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": USER_AGENT },
          body: `data=${encodeURIComponent(query)}`,
        },
        timeoutMs,
      );
      if (!res.ok) continue;
      const body = (await res.json()) as { elements?: OverpassElement[]; remark?: string };
      // A remark means the query was cut short: what it returned is partial.
      if (body.remark) continue;
      return body.elements ?? [];
    } catch {
      // The next server.
    }
  }
  return null;
}

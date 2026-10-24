import { MAX_PLACES, placesOf, type Place } from "../core/destination.ts";

const SEARCH_URL = "https://nominatim.openstreetmap.org/search";
// Nominatim's usage policy asks for an identifying agent (same as the routing service).
const USER_AGENT = "MobileMotoRide/0.0.0 (+https://github.com/bhoudebert/mobile-motoride)";

export interface SearchOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * The places that match a query on Nominatim (ADR 0022), or null when the search could not be made: the caller says
 * so. One request per submitted search, never as the rider types.
 */
export async function searchPlaces(query: string, options: SearchOptions = {}): Promise<Place[] | null> {
  const { fetchImpl = fetch, timeoutMs = 10_000 } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `${SEARCH_URL}?${new URLSearchParams({ q: query, format: "jsonv2", limit: String(MAX_PLACES) })}`;
    const res = await fetchImpl(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return placesOf(await res.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

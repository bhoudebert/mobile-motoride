import { parseForecast, type HourForecast } from "../core/weather.ts";

const URL_BASE = "https://api.met.no/weatherapi/locationforecast/2.0/compact";
// MET Norway asks for an identifying agent, a pause between requests it answered, and no more precision than needed.
const USER_AGENT = "MobileMotoRide/0.0.0 (+https://github.com/bhoudebert/mobile-motoride)";
/** A place is asked for with a hundredth of a degree (about a kilometre): enough for the weather, and less than the position. */
const DECIMALS = 2;
const FALLBACK_TTL_MS = 10 * 60_000;

export interface ForecastOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  now?: () => number;
}

interface Kept {
  hours: HourForecast[];
  until: number;
}
const kept = new Map<string, Kept>();

/** Forget what was kept (the tests). */
export const clearForecasts = (): void => kept.clear();

const key = (lat: number, lon: number) => `${lat.toFixed(DECIMALS)},${lon.toFixed(DECIMALS)}`;

/**
 * The hourly forecast for a place from MET Norway (ADR 0037), or null when it could not be had. What the service answered is kept
 * until it says it will have changed (its Expires header), or ten minutes: the same place is not asked for twice in that time.
 */
export async function fetchForecast(
  lat: number,
  lon: number,
  options: ForecastOptions = {},
): Promise<HourForecast[] | null> {
  const { fetchImpl = fetch, timeoutMs = 10_000, now = Date.now } = options;
  const k = key(lat, lon);
  const hit = kept.get(k);
  if (hit && hit.until > now()) return hit.hours;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = `${URL_BASE}?lat=${lat.toFixed(DECIMALS)}&lon=${lon.toFixed(DECIMALS)}`;
    const res = await fetchImpl(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return hit?.hours ?? null;
    const hours = parseForecast(await res.json());
    if (hours.length === 0) return null;
    const expires = Date.parse(res.headers?.get?.("expires") ?? "");
    kept.set(k, { hours, until: Number.isFinite(expires) && expires > now() ? expires : now() + FALLBACK_TTL_MS });
    return hours;
  } catch {
    return hit?.hours ?? null;
  } finally {
    clearTimeout(timer);
  }
}

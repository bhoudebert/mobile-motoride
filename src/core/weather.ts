import { pointAt } from "./track.ts";
import type { LatLon } from "./types.ts";

// ---- The forecast ahead on the route (spec weather, ADR 0037)

/** One hour of a forecast at one place. */
export interface HourForecast {
  /** Start of the hour, ms since 1970. */
  time: number;
  tempC: number | null;
  /** Rain (or melted snow) over the hour, mm. */
  precipMm: number | null;
  /** The weather service's name for the sky ("lightrain_day"), kept to tell a thunderstorm or snow from rain. */
  symbol: string | null;
  windMps: number | null;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const obj = (v: unknown): Record<string, unknown> | null =>
  typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;

/** The hours of a MET Norway "locationforecast compact" answer; anything that is not an hour is left out. */
export function parseForecast(body: unknown): HourForecast[] {
  const series = obj(obj(body)?.["properties"])?.["timeseries"];
  if (!Array.isArray(series)) return [];
  const out: HourForecast[] = [];
  for (const entry of series) {
    const e = obj(entry);
    const time = Date.parse(String(e?.["time"] ?? ""));
    const data = obj(e?.["data"]);
    if (!Number.isFinite(time) || !data) continue;
    const instant = obj(obj(data["instant"])?.["details"]);
    const next1 = obj(data["next_1_hours"]);
    const next6 = obj(data["next_6_hours"]);
    // The hours after the first days only have the 6 hours: their rain is spread over six hours.
    const sixMm = num(obj(next6?.["details"])?.["precipitation_amount"]);
    out.push({
      time,
      tempC: num(instant?.["air_temperature"]),
      precipMm: num(obj(next1?.["details"])?.["precipitation_amount"]) ?? (sixMm === null ? null : sixMm / 6),
      symbol: (obj(next1?.["summary"])?.["symbol_code"] ?? obj(next6?.["summary"])?.["symbol_code"] ?? null) as
        string | null,
      windMps: num(instant?.["wind_speed"]),
    });
  }
  return out.sort((a, b) => a.time - b.time);
}

const HOUR_MS = 3_600_000;
/** An hour of forecast stands for a moment up to this far from it. */
const NEAREST_MS = 90 * 60_000;

/** The forecast for a moment: the hour it falls in; else the nearest within 90 minutes; else nothing. */
export function forecastAt(hours: HourForecast[], atMs: number): HourForecast | null {
  let best: HourForecast | null = null;
  let bestGap = Infinity;
  for (const h of hours) {
    const gap =
      atMs >= h.time && atMs < h.time + HOUR_MS
        ? 0
        : Math.min(Math.abs(atMs - h.time), Math.abs(atMs - (h.time + HOUR_MS)));
    if (gap < bestGap) {
      best = h;
      bestGap = gap;
    }
  }
  return best && bestGap <= NEAREST_MS ? best : null;
}

// ---- What it means for a rider

export type Condition = "dry" | "light" | "rain" | "heavy" | "storm" | "snow" | "ice";

/** Rain per hour, mm: under 0.2 is dry, over 1 is rain, over 4 is heavy. */
export const LIGHT_MM = 0.2;
export const RAIN_MM = 1;
export const HEAVY_MM = 4;
/** Rain at or under this temperature is ice on the road. */
export const ICE_C = 2;

export function conditionOf(h: HourForecast): Condition {
  const symbol = h.symbol ?? "";
  const mm = h.precipMm ?? 0;
  if (symbol.includes("thunder")) return "storm";
  if (symbol.includes("snow") || symbol.includes("sleet")) return "snow";
  if (mm >= LIGHT_MM && h.tempC !== null && h.tempC <= ICE_C) return "ice";
  if (mm >= HEAVY_MM) return "heavy";
  if (mm >= RAIN_MM) return "rain";
  if (mm >= LIGHT_MM) return "light";
  return "dry";
}

/** What a rider is warned of: more than a drizzle. */
export const isAlert = (c: Condition): boolean => c !== "dry" && c !== "light";

// ---- Along the route

export interface SamplePoint {
  /** Metres ahead of the rider along the roadbook. */
  distM: number;
  /** Where along the roadbook. */
  atM: number;
  lat: number;
  lon: number;
  /** When the rider is expected there, ms since 1970. */
  etaMs: number;
}

/** How far apart the points are, how far ahead they go, and the speed taken when the rider is slow or standing, m/s. */
export const SAMPLE_SPACING_M = 15_000;
export const SAMPLE_AHEAD_M = 60_000;
export const ASSUMED_MPS = 16;

/** The places to ask about: here, then every 15 km up to 60 km ahead, ending at the finish when it is nearer. */
export function samplePoints(
  line: LatLon[],
  cumulativeM: number[],
  progressM: number,
  totalM: number,
  speedMps: number | null,
  nowMs: number,
): SamplePoint[] {
  const v = Math.max(speedMps ?? 0, ASSUMED_MPS);
  const here = Math.max(0, Math.min(progressM, totalM));
  const reach = Math.min(SAMPLE_AHEAD_M, totalM - here);
  const dists: number[] = [];
  for (let d = 0; d <= reach; d += SAMPLE_SPACING_M) dists.push(d);
  if (dists[dists.length - 1]! < reach - 1000) dists.push(reach);
  return dists.map((d) => {
    const [lat, lon] = pointAt(line, cumulativeM, here + d);
    return { distM: d, atM: here + d, lat, lon, etaMs: nowMs + (d / v) * 1000 };
  });
}

export interface Weighed {
  point: SamplePoint;
  /** Null when the forecast could not be had for it. */
  forecast: HourForecast | null;
  condition: Condition | null;
}

export const weigh = (point: SamplePoint, hours: HourForecast[] | null): Weighed => {
  const forecast = hours ? forecastAt(hours, point.etaMs) : null;
  return { point, forecast, condition: forecast ? conditionOf(forecast) : null };
};

export interface Outlook {
  /** The sky where the rider is; null when unknown. */
  now: Condition | null;
  here: Weighed | null;
  /** The first place ahead where it turns bad (and was not bad before it); null when nothing is coming. */
  coming: Weighed | null;
  /** Where the bad weather the rider is in ends, when it does within the horizon. */
  clearing: Weighed | null;
  /** The coldest temperature on the way, °C. */
  minTempC: number | null;
  /** The points, so the card can list them. */
  points: Weighed[];
}

/** What to tell of the points, in order: the weather here, what comes, when a wet stretch ends. */
export function outlookOf(points: Weighed[]): Outlook {
  const first = points[0] ?? null;
  const now = first?.condition ?? null;
  const inAlert = now !== null && isAlert(now);
  let coming: Weighed | null = null;
  let clearing: Weighed | null = null;
  for (const p of points.slice(1)) {
    if (p.condition === null) continue;
    if (!inAlert && coming === null && isAlert(p.condition)) coming = p;
    if (inAlert && clearing === null && !isAlert(p.condition)) clearing = p;
  }
  const temps = points.map((p) => p.forecast?.tempC).filter((t): t is number => t !== null && t !== undefined);
  return { now, here: first, coming, clearing, minTempC: temps.length ? Math.min(...temps) : null, points };
}

/** What to say, once for each stretch of bad weather: it is within 30 km and the rider is not in it already. */
export const ANNOUNCE_WITHIN_M = 30_000;

export interface WeatherAnnouncement {
  condition: Condition;
  distM: number;
}

/** `said` holds what was said since the sky last was clear; it is emptied by the caller when nothing is coming. */
export function weatherAnnouncement(outlook: Outlook, said: ReadonlySet<Condition>): WeatherAnnouncement | null {
  const c = outlook.coming;
  if (!c || c.condition === null || c.point.distM > ANNOUNCE_WITHIN_M || said.has(c.condition)) return null;
  return { condition: c.condition, distM: c.point.distM };
}

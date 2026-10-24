import type { CountrySegment } from "./types.ts";
import { formatNumber, t } from "./i18n/index.ts";

/**
 * What the app may say about a fixed speed camera in a country (spec danger-zones, ADR 0021):
 * `exact` its place and distance, `zones` only a danger zone that does not give its place away, `off` nothing.
 */
export type CameraPolicy = "exact" | "zones" | "off";

/**
 * By ISO country code. A country that is not here is `off` until someone has checked it, with the research in
 * docs/danger-zones-by-country.md; Italy and the United Kingdom are to be confirmed before a public release.
 */
export const CAMERA_POLICIES: Record<string, CameraPolicy> = {
  FR: "zones",
  BE: "exact",
  LU: "exact",
  NL: "exact",
  ES: "exact",
  IT: "exact",
  GB: "exact",
  DE: "off",
  CH: "off",
};

export const policyOf = (country: string | null | undefined): CameraPolicy =>
  (country ? CAMERA_POLICIES[country.toUpperCase()] : undefined) ?? "off";

const STRICTNESS: Record<CameraPolicy, number> = { off: 0, zones: 1, exact: 2 };

/** The stricter of two policies: a camera in one country and a rider in another follow the one that allows less. */
export const stricter = (a: CameraPolicy, b: CameraPolicy): CameraPolicy => (STRICTNESS[a] <= STRICTNESS[b] ? a : b);

/**
 * The shortest danger zone France accepts, by the kind of road (protocol of 28 July 2011): 300 m in a built-up area,
 * 2 km on an ordinary road, 4 km on a motorway. The kind is read from the limit of the camera.
 */
export function zoneLengthM(limitKmh: number | null): number {
  if (limitKmh !== null && limitKmh <= 50) return 300;
  if (limitKmh !== null && limitKmh >= 100) return 4000;
  return 2000;
}

/**
 * Where the camera sits in its zone, as a share of the zone's length from its start, 0.25 to 0.75. It comes from the
 * camera's own coordinates, so it is the same on every ride and no zone is centred on its camera.
 */
export function zoneShare(lat: number, lon: number): number {
  const h = Math.abs(Math.sin(lat * 12.9898 + lon * 78.233) * 43758.5453);
  return 0.25 + 0.5 * (h - Math.floor(h));
}

/** The country at `m` along the line, or null where the roadbook says nothing. */
export function countryAt(segments: CountrySegment[], m: number): string | null {
  for (const s of segments) if (m >= s.startM && m < s.endM) return s.code;
  const last = segments[segments.length - 1];
  return last && m === last.endM ? last.code : null;
}

/** "300 metres", "2 kilometres", "2.5 kilometres": how long a zone is, for the voice and the screen. */
export function spanText(m: number): string {
  if (m < 1000) return t("nav.span.m", { n: Math.max(10, Math.round(m / 10) * 10) });
  const km = Math.round(m / 100) / 10;
  return t("nav.span.km", { n: formatNumber(km, { maximumFractionDigits: 1 }), count: km });
}

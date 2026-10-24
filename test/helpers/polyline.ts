import type { LatLon } from "../../src/core/types.ts";

/** Encode points as a polyline of precision 6, the inverse of decodePolyline. */
export function encodePolyline(points: LatLon[]): string {
  let out = "";
  let lastLat = 0;
  let lastLon = 0;
  const put = (value: number) => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    while (v >= 0x20) {
      out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    out += String.fromCharCode(v + 63);
  };
  for (const [lat, lon] of points) {
    const la = Math.round(lat * 1e6);
    const lo = Math.round(lon * 1e6);
    put(la - lastLat);
    put(lo - lastLon);
    lastLat = la;
    lastLon = lo;
  }
  return out;
}

/** A `motoride-roadbook` file as text, for tests. */
export function roadbookFile(line: LatLon[], extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    format: "motoride-roadbook",
    version: 1,
    name: "Test ride",
    line: encodePolyline(line),
    // Belgium unless a test says otherwise: where a camera may be warned of by its place (ADR 0021).
    countries: [{ from: 0, to: line.length - 1, code: "BE" }],
    ...extra,
  });
}

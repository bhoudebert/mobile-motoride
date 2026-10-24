import { unproject } from "../../src/core/geo.ts";
import type { Fix, LatLon } from "../../src/core/types.ts";

export const REF: LatLon = [50.45, 3.2];

type Piece = { straight: number } | { arc: number; deg: number; dir: "left" | "right" };

/** A line drawn by a turtle that starts heading east: straights and arcs, a point every `step` metres. */
export function drawLine(pieces: Piece[], step = 5): LatLon[] {
  let x = 0;
  let y = 0;
  let heading = 0; // radians, 0 = east, counter-clockwise
  const pts: [number, number][] = [[x, y]];
  for (const p of pieces) {
    if ("straight" in p) {
      const n = Math.max(1, Math.round(p.straight / step));
      for (let i = 0; i < n; i++) {
        x += Math.cos(heading) * (p.straight / n);
        y += Math.sin(heading) * (p.straight / n);
        pts.push([x, y]);
      }
    } else {
      const sign = p.dir === "left" ? 1 : -1;
      const arcLen = p.arc * ((p.deg * Math.PI) / 180);
      const n = Math.max(1, Math.round(arcLen / step));
      for (let i = 0; i < n; i++) {
        const dTheta = (arcLen / n / p.arc) * sign;
        const mid = heading + dTheta / 2;
        x += Math.cos(mid) * 2 * p.arc * Math.sin(Math.abs(dTheta) / 2);
        y += Math.sin(mid) * 2 * p.arc * Math.sin(Math.abs(dTheta) / 2);
        heading += dTheta;
        pts.push([x, y]);
      }
    }
  }
  return pts.map((q) => unproject(q, REF));
}

export function fixAt(p: LatLon, speedKmh = 60, time = 0): Fix {
  return { lat: p[0], lon: p[1], speedMps: speedKmh / 3.6, accuracyM: 5, time };
}

/** Deterministic noise in [-1, 1]. */
export function noise(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

import type { LatLon } from "./types.ts";

/** A line segment to draw: its middle, its length and its angle (radians), in the units of the box it was fitted to. */
export interface ThumbSegment {
  x: number;
  y: number;
  length: number;
  angle: number;
}

/**
 * The shape of a roadbook drawn as segments that fit a box, north up, with room `pad` all round and the line kept in
 * proportion (a degree of longitude is shorter than one of latitude). At most `maxPoints` points are used.
 */
export function thumbSegments(line: LatLon[], width: number, height: number, pad = 12, maxPoints = 48): ThumbSegment[] {
  if (line.length < 2 || width <= 2 * pad || height <= 2 * pad) return [];
  const step = Math.max(1, Math.ceil(line.length / maxPoints));
  const kept = line.filter((_, i) => i % step === 0 || i === line.length - 1);
  const lat0 = (kept.reduce((s, p) => s + p[0], 0) / kept.length) * (Math.PI / 180);
  const flat = kept.map(([lat, lon]) => ({ x: lon * Math.cos(lat0), y: -lat }));
  const minX = Math.min(...flat.map((p) => p.x));
  const maxX = Math.max(...flat.map((p) => p.x));
  const minY = Math.min(...flat.map((p) => p.y));
  const maxY = Math.max(...flat.map((p) => p.y));
  const spanX = maxX - minX || 1e-9;
  const spanY = maxY - minY || 1e-9;
  const scale = Math.min((width - 2 * pad) / spanX, (height - 2 * pad) / spanY);
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  const at = flat.map((p) => ({ x: offX + (p.x - minX) * scale, y: offY + (p.y - minY) * scale }));
  const out: ThumbSegment[] = [];
  for (let i = 1; i < at.length; i++) {
    const a = at[i - 1]!;
    const b = at[i]!;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < 0.5) continue;
    out.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, length, angle: Math.atan2(b.y - a.y, b.x - a.x) });
  }
  return out;
}

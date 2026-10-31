// Draws the marks of the two ends of a roadbook on the map (spec ride-navigation, "Start and finish"):
//   assets/route-start.png   a green disc with a white arrow: where it begins
//   assets/route-finish.png  a dark disc with a checkered flag: where it ends
//   assets/route-loop.png    the checkered flag inside a green ring: a loop, where it begins and ends
// Plain pictures (not distance fields), white-edged so they read on the light and the dark look. Run:
//   node scripts/make-route-icons.ts
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const SIZE = 96;
const SUPER = 4;
const GREEN: Rgb = [24, 160, 88];
const DARK: Rgb = [28, 43, 34];
const WHITE: Rgb = [255, 255, 255];
type Rgb = [number, number, number];
type Layer = (x: number, y: number) => Rgb | null;

const disc =
  (cx: number, cy: number, r: number, color: Rgb): Layer =>
  (x, y) =>
    Math.hypot(x - cx, y - cy) <= r ? color : null;
const polygon =
  (points: [number, number][], color: Rgb): Layer =>
  (x, y) => {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [xi, yi] = points[i]!;
      const [xj, yj] = points[j]!;
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside ? color : null;
  };
/** An n x n checkered square, white and dark, inside a disc of radius r around the centre. */
const checkered =
  (cx: number, cy: number, half: number, n: number, r: number): Layer =>
  (x, y) => {
    if (Math.hypot(x - cx, y - cy) > r || Math.abs(x - cx) > half || Math.abs(y - cy) > half) return null;
    const i = Math.floor(((x - (cx - half)) / (2 * half)) * n);
    const j = Math.floor(((y - (cy - half)) / (2 * half)) * n);
    return (i + j) % 2 === 0 ? WHITE : DARK;
  };

const C = SIZE / 2;
const ICONS: Record<string, Layer[]> = {
  start: [
    disc(C, C, 46, WHITE),
    disc(C, C, 40, GREEN),
    polygon(
      [
        [38, 26],
        [38, 70],
        [72, 48],
      ],
      WHITE,
    ),
  ],
  finish: [disc(C, C, 46, WHITE), disc(C, C, 40, DARK), checkered(C, C, 26, 4, 36)],
  loop: [
    disc(C, C, 46, WHITE),
    disc(C, C, 40, GREEN),
    disc(C, C, 27, WHITE),
    disc(C, C, 24, DARK),
    checkered(C, C, 17, 4, 24),
  ],
};

const render = (layers: Layer[]): Buffer => {
  const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let covered = 0;
      for (let sy = 0; sy < SUPER; sy++) {
        for (let sx = 0; sx < SUPER; sx++) {
          const x = px + (sx + 0.5) / SUPER;
          const y = py + (sy + 0.5) / SUPER;
          let hit: Rgb | null = null;
          for (const layer of layers) hit = layer(x, y) ?? hit;
          if (hit) {
            r += hit[0];
            g += hit[1];
            b += hit[2];
            covered++;
          }
        }
      }
      const o = py * (SIZE * 4 + 1) + 1 + px * 4;
      if (covered > 0) {
        raw[o] = Math.round(r / covered);
        raw[o + 1] = Math.round(g / covered);
        raw[o + 2] = Math.round(b / covered);
      }
      raw[o + 3] = Math.round((255 * covered) / (SUPER * SUPER));
    }
  }
  return raw;
};

const crc = (buf: Buffer): number => {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
};
const chunk = (type: string, data: Buffer): Buffer => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc(body), 8 + data.length);
  return out;
};
const png = (raw: Buffer): Buffer => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(SIZE, 0);
  header.writeUInt32BE(SIZE, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

for (const [name, layers] of Object.entries(ICONS)) {
  writeFileSync(new URL(`../assets/route-${name}.png`, import.meta.url), png(render(layers)));
  console.log(`assets/route-${name}.png written`);
}

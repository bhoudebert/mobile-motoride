// Draws assets/chevron.png: the bold white chevron that marks the way along the stretch ahead of the rider on the map
// (spec ride-navigation, "Direction on the line"). White, with a dark outline so it reads on the light and the dark look.
// It points right, the way an icon laid along a line is turned. Run: node scripts/make-chevron.ts
import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const SIZE = 64;
const SUPER = 4;
const OUTLINE = 3.2;
/** A thick ">" in a 64 x 64 square. */
const SHAPE: [number, number][] = [
  [12, 6],
  [30, 6],
  [54, 32],
  [30, 58],
  [12, 58],
  [36, 32],
];

const inside = (x: number, y: number): boolean => {
  let c = false;
  for (let i = 0, j = SHAPE.length - 1; i < SHAPE.length; j = i++) {
    const [xi, yi] = SHAPE[i]!;
    const [xj, yj] = SHAPE[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const distToEdge = (x: number, y: number): number => {
  let best = Infinity;
  for (let i = 0; i < SHAPE.length; i++) {
    const [ax, ay] = SHAPE[i]!;
    const [bx, by] = SHAPE[(i + 1) % SHAPE.length]!;
    const t = Math.max(
      0,
      Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)),
    );
    best = Math.min(best, Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay))));
  }
  return best;
};

const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
for (let py = 0; py < SIZE; py++) {
  raw[py * (SIZE * 4 + 1)] = 0;
  for (let px = 0; px < SIZE; px++) {
    let fill = 0;
    let ring = 0;
    for (let sy = 0; sy < SUPER; sy++) {
      for (let sx = 0; sx < SUPER; sx++) {
        const x = px + (sx + 0.5) / SUPER;
        const y = py + (sy + 0.5) / SUPER;
        if (inside(x, y)) fill++;
        else if (distToEdge(x, y) <= OUTLINE) ring++;
      }
    }
    const n = SUPER * SUPER;
    const alpha = (fill + ring) / n;
    // White inside, a dark green ring around it; the pixel is the mix of the two by coverage.
    const white = fill / Math.max(1, fill + ring);
    const o = py * (SIZE * 4 + 1) + 1 + px * 4;
    raw[o] = Math.round(255 * white + 22 * (1 - white));
    raw[o + 1] = Math.round(255 * white + 35 * (1 - white));
    raw[o + 2] = Math.round(255 * white + 27 * (1 - white));
    raw[o + 3] = Math.round(255 * alpha);
  }
}

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
const header = Buffer.alloc(13);
header.writeUInt32BE(SIZE, 0);
header.writeUInt32BE(SIZE, 4);
header[8] = 8;
header[9] = 6;
writeFileSync(
  new URL("../assets/chevron.png", import.meta.url),
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]),
);
console.log("assets/chevron.png written");

// The roadbooks kept for the tests (test/fixtures/roadbooks), pushed to a local agentRide server (../agentRide), as a
// rider's tool would. Shared by the device smoke (a throwaway server) and `npm run dev:server` (the rider's dev server).
import { readdirSync, readFileSync } from "node:fs";
import type { Roadbook } from "../../src/core/types.ts";
import { encodePolyline } from "../../test/helpers/polyline.ts";

/** Real roadbooks made by agentRide, in file order. */
export function fixtureRoadbooks(): Roadbook[] {
  const dir = new URL("../../test/fixtures/roadbooks/", import.meta.url);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(new URL(f, dir), "utf8")) as Roadbook);
}

/** A fixture roadbook as the file agentRide hands out (`motoride-roadbook`, docs/roadbook-format.md). */
export function fileOf(rb: Roadbook, n: number): string {
  const { id: _id, line, ...rest } = rb;
  return JSON.stringify({
    format: "motoride-roadbook",
    version: 1,
    ...rest,
    line: encodePolyline(line),
    origin: { app: "agentRide", roadbook: n, name: rb.name },
  });
}

/** Push every fixture roadbook (PUT /roadbooks, agentRide's pushed roadbooks); how many the server accepted. */
export async function pushFixtures(base: string, token: string): Promise<number> {
  let pushed = 0;
  for (const [i, rb] of fixtureRoadbooks().entries()) {
    const res = await fetch(`${base}/roadbooks`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: fileOf(rb, i + 1),
    });
    if (res.ok) pushed++;
  }
  return pushed;
}

/** What the server lists for this rider (GET /roadbooks), or null when it cannot be read. */
export async function listedCount(base: string, token: string): Promise<number | null> {
  const res = await fetch(`${base}/roadbooks`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
  if (!res?.ok) return null;
  const body = (await res.json()) as { roadbooks?: unknown[] };
  return body.roadbooks?.length ?? null;
}

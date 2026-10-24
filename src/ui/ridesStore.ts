import { Directory, File, Paths } from "expo-file-system";
import {
  parseMeta,
  rideId,
  rideToGpx,
  serializeMeta,
  summarizeTrack,
  trackDistanceM,
  worthKeeping,
  type RideMeta,
  type RideState,
  type TrackPoint,
} from "../core/recording.ts";
import { parseRideGpx } from "../core/review.ts";
import type { RoadbookOrigin } from "../core/types.ts";

const folder = () => new Directory(Paths.document, "rides");
const file = (name: string) => new File(folder(), name);
const ensure = () => {
  const dir = folder();
  if (!dir.exists) dir.create({ intermediates: true });
};
async function put(name: string, text: string) {
  ensure();
  const f = file(name);
  if (!f.exists) f.create();
  await f.write(text);
}

/** What a ride is called while it runs: written about once a minute, so a closed app loses little (spec ride-recording). */
export interface Checkpoint {
  roadbookId: string;
  roadbookName: string;
  origin?: RoadbookOrigin;
  startedAt: number;
  completed: boolean;
  points: TrackPoint[];
}

const CHECKPOINT = "in-progress.json";

export async function writeCheckpoint(c: Checkpoint): Promise<void> {
  try {
    await put(CHECKPOINT, JSON.stringify({ v: 1, ...c }));
  } catch {
    // A checkpoint that cannot be written is not worth stopping the ride for.
  }
}

export async function clearCheckpoint(): Promise<void> {
  const f = file(CHECKPOINT);
  if (f.exists) f.delete();
}

/** Save a track as a GPX with its meta; null when it is not worth keeping (spec ride-recording). */
export async function saveRide(c: Checkpoint, endedAt: number, state: RideState): Promise<RideMeta | null> {
  if (!worthKeeping(c.points)) return null;
  const meta: RideMeta = {
    id: rideId(c.startedAt, c.roadbookName),
    roadbookId: c.roadbookId,
    roadbookName: c.roadbookName,
    ...(c.origin ? { origin: c.origin } : {}),
    startedAt: c.startedAt,
    endedAt,
    distanceM: trackDistanceM(c.points),
    points: c.points.length,
    state,
    ...summarizeTrack(c.points),
  };
  await put(`${meta.id}.gpx`, rideToGpx(meta, c.points));
  await put(`${meta.id}.json`, serializeMeta(meta));
  return meta;
}

/** The ride a closed app left behind, saved as recovered; null when there is none worth keeping. */
export async function recoverRide(): Promise<RideMeta | null> {
  try {
    const f = file(CHECKPOINT);
    if (!f.exists) return null;
    const c = JSON.parse(await f.text()) as Checkpoint & { v?: number };
    f.delete();
    if (c.v !== 1 || !Array.isArray(c.points) || c.points.length < 2) return null;
    return await saveRide(c, c.points[c.points.length - 1]!.time, c.completed ? "completed" : "recovered");
  } catch {
    return null;
  }
}

/** The recorded rides, newest first; one whose meta cannot be read is left out. */
export async function listRides(): Promise<RideMeta[]> {
  try {
    const dir = folder();
    if (!dir.exists) return [];
    const out: RideMeta[] = [];
    for (const entry of dir.list()) {
      if (!(entry instanceof File) || !entry.name.endsWith(".json") || entry.name === CHECKPOINT) continue;
      try {
        const meta = parseMeta(await entry.text());
        if (meta && file(`${meta.id}.gpx`).exists) out.push(meta);
      } catch {
        // Unreadable: skipped.
      }
    }
    return out.sort((a, b) => b.startedAt - a.startedAt);
  } catch {
    return [];
  }
}

export async function deleteRide(id: string): Promise<void> {
  for (const name of [`${id}.gpx`, `${id}.json`]) {
    const f = file(name);
    if (f.exists) f.delete();
  }
}

/** The points of a recorded ride, read back from its GPX (spec ride-review); null when the file cannot be read. */
export async function readRidePoints(id: string): Promise<TrackPoint[] | null> {
  try {
    const f = file(`${id}.gpx`);
    return f.exists ? parseRideGpx(await f.text()) : null;
  } catch {
    return null;
  }
}

/** The address of a ride's GPX, for the share sheet. */
export const gpxUri = (id: string): string => file(`${id}.gpx`).uri;

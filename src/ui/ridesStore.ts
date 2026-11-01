import { detachedRide, type LibraryId } from "../core/serverIdentity.ts";
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
import { metaFromGpx, parseRideGpx } from "../core/review.ts";
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
  const created = !f.exists;
  if (created) f.create();
  try {
    await f.write(text);
  } catch (e) {
    // A file this call made and could not fill is not left empty behind: an empty track is not a ride.
    if (created) f.delete();
    throw e;
  }
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

/** Where a checkpoint is put aside when its ride could not be saved, so a ride that follows cannot overwrite it. */
const UNSAVED = (startedAt: number) => `unsaved-${startedAt}.json`;

/**
 * The ride could not be saved: keep what was written while it ran. The checkpoint is renamed (copied, then deleted) so the next
 * ride's checkpoint does not replace it; if even that fails it stays where it is. `recoverRides` saves it at the next launch.
 */
export async function keepUnsaved(startedAt: number): Promise<void> {
  try {
    const f = file(CHECKPOINT);
    if (!f.exists) return;
    await put(UNSAVED(startedAt), await f.text());
    f.delete();
  } catch {
    // It stays as in-progress.json: still there for the next launch.
  }
}

/** The rides a closed app, or a save that failed, left behind, each saved as recovered; empty when there is none worth keeping. */
export async function recoverRides(): Promise<RideMeta[]> {
  const out: RideMeta[] = [];
  try {
    const dir = folder();
    const left = dir
      .list()
      .filter((e) => e instanceof File && (e.name === CHECKPOINT || /^unsaved-\d+\.json$/.test(e.name)));
    for (const f of left as File[]) {
      try {
        const c = JSON.parse(await f.text()) as Checkpoint & { v?: number };
        if (c.v !== 1 || !Array.isArray(c.points) || c.points.length < 2) {
          f.delete();
          continue;
        }
        const meta = await saveRide(c, c.points[c.points.length - 1]!.time, c.completed ? "completed" : "recovered");
        // Deleted only once the track is on the phone: a failed save leaves it for the next launch.
        f.delete();
        if (meta) out.push(meta);
      } catch {
        // Unreadable or not savable now: left in place, tried again at the next launch.
      }
    }
  } catch {
    // No folder to read.
  }
  return out;
}

/**
 * The recorded rides, newest first. A ride is its track; its summary (`.json`) is what the list reads. A track with no summary,
 * or one that cannot be read (a save cut between the two files), is listed all the same: the summary is rebuilt from the GPX and
 * written back. The track is never touched, and one that cannot be read as a ride is left alone and left out.
 */
export async function listRides(): Promise<RideMeta[]> {
  try {
    const dir = folder();
    if (!dir.exists) return [];
    const out: RideMeta[] = [];
    const entries = dir.list().filter((e): e is File => e instanceof File);
    const listed = new Set<string>();
    for (const entry of entries) {
      if (!entry.name.endsWith(".json") || entry.name === CHECKPOINT || entry.name.startsWith("unsaved-")) continue;
      try {
        const meta = parseMeta(await entry.text());
        if (meta && file(`${meta.id}.gpx`).exists) {
          out.push(meta);
          listed.add(meta.id);
        }
      } catch {
        // Unreadable: its track, if there is one, is looked at below.
      }
    }
    for (const entry of entries) {
      if (!entry.name.endsWith(".gpx")) continue;
      const id = entry.name.slice(0, -".gpx".length);
      if (listed.has(id)) continue;
      try {
        const meta = metaFromGpx(id, await entry.text());
        if (!meta) continue;
        out.push(meta);
        await put(`${id}.json`, serializeMeta(meta)).catch(() => {});
      } catch {
        // Not a track we can read: left alone.
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

/** The text of a ride's GPX, exactly as kept, for the server; null when the file cannot be read. */
export async function readRideGpx(id: string): Promise<string | null> {
  try {
    const f = file(`${id}.gpx`);
    return f.exists ? await f.text() : null;
  } catch {
    return null;
  }
}

/**
 * Keep on the phone a ride that came down from the server: the GPX exactly as the server holds it, and its summary rebuilt from
 * it, marked as on the server (so it is not sent again). Null when the file is not a ride. The track goes first, as for a
 * ride recorded here: a cut leaves a track the list can still rebuild.
 */
export async function saveDownloaded(
  id: string,
  gpx: string,
  uploadedAt: number,
  serverKey?: string,
): Promise<RideMeta | null> {
  const meta = metaFromGpx(id, gpx);
  if (!meta) return null;
  const next: RideMeta = { ...meta, uploadedAt, serverRideId: id, ...(serverKey ? { serverKey } : {}) };
  await put(`${id}.gpx`, gpx);
  await put(`${id}.json`, serializeMeta(next));
  return next;
}

/** Remember that a ride is on the rider's server: written beside the ride, never undone by anything the phone does. */
export async function markUploaded(
  id: string,
  serverRideId: string,
  at: number,
  serverKey?: string,
): Promise<RideMeta | null> {
  try {
    const f = file(`${id}.json`);
    const meta = f.exists ? parseMeta(await f.text()) : null;
    if (!meta) return null;
    const next: RideMeta = { ...meta, uploadedAt: at, serverRideId, ...(serverKey ? { serverKey } : {}) };
    await put(`${id}.json`, serializeMeta(next));
    return next;
  } catch {
    return null;
  }
}

/** The address of a ride's GPX, for the share sheet. */
export const gpxUri = (id: string): string => file(`${id}.gpx`).uri;

/**
 * The rides sent to a server that is not the one in use become rides of the phone only (ADR 0049): the recording stays, its
 * server link and sent mark go. Returns how many changed.
 */
export async function detachRides(current: LibraryId | null): Promise<number> {
  let changed = 0;
  for (const meta of await listRides()) {
    const next = detachedRide(meta, current);
    if (!next) continue;
    await put(`${meta.id}.json`, serializeMeta(next));
    changed++;
  }
  return changed;
}

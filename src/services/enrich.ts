import {
  camerasFromElements,
  completed,
  foundFromTraces,
  thinIndexes,
  type OverpassElement,
  type TracedChunk,
  type TraceResponse,
} from "../core/enrich.ts";
import { cumulativeDistances } from "../core/track.ts";
import type { Roadbook } from "../core/types.ts";
import { t } from "../core/i18n/index.ts";
import { overpass, post, USER_AGENT } from "./overpass.ts";
import { CLIENT_ID } from "./valhalla.ts";

const TRACE_URL = "https://valhalla1.openstreetmap.de/trace_attributes";
/** The line is matched about every 30 m, in pieces of this many points (about 45 km). */
const MATCH_SPACING_M = 30;
const MATCH_PIECE = 1500;
/** Cameras are asked for along the line, a point every 600 m (Overpass measures to the line between points), 40 at a time. */
const CAMERA_SPACING_M = 600;
const CAMERA_PIECE = 40;
const CAMERA_RADIUS_M = 60;

export class EnrichError extends Error {}

export interface EnrichOptions {
  fetchImpl?: typeof fetch;
  onProgress?: (share: number, what: string) => void;
  timeoutMs?: number;
  /** Waits between attempts on another server; the tests do not wait. */
  pause?: (ms: number) => Promise<void>;
}

/** One piece of the line matched to the roads. */
async function trace(
  fetchImpl: typeof fetch,
  points: Array<{ lat: number; lon: number }>,
  timeoutMs: number,
): Promise<TraceResponse> {
  let res: Response;
  try {
    res = await post(
      fetchImpl,
      TRACE_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": USER_AGENT,
          "X-Client-Id": CLIENT_ID,
          Accept: "application/json",
        },
        body: JSON.stringify({
          shape: points,
          shape_match: "map_snap",
          costing: "motorcycle",
          filters: {
            action: "include",
            attributes: [
              "edge.length",
              "edge.speed_limit",
              "edge.road_class",
              "edge.density",
              "edge.names",
              "edge.begin_shape_index",
              "edge.end_shape_index",
              "edge.roundabout",
              "edge.drive_on_right",
              "edge.begin_heading",
              "edge.end_heading",
              "node.intersecting_edge.begin_heading",
              "node.intersecting_edge.driveability",
              "node.admin_index",
              "admin.country_code",
              "admin.state_code",
              "shape",
            ],
          },
        }),
      },
      timeoutMs,
    );
  } catch {
    throw new EnrichError(t("home.err.routingDown"));
  }
  if (res.status === 429) throw new EnrichError(t("home.err.routingBusy"));
  if (!res.ok) throw new EnrichError(t("home.err.routingNoMatch", { status: res.status }));
  return (await res.json()) as TraceResponse;
}

/** The cameras near the line, or null when the service cannot say (the roadbook is then completed without them). */
async function cameras(
  fetchImpl: typeof fetch,
  rb: Roadbook,
  cum: number[],
  timeoutMs: number,
  progress: (share: number) => void,
  pause: (ms: number) => Promise<void>,
): Promise<unknown[] | null> {
  const sparse = thinIndexes(cum, CAMERA_SPACING_M);
  const elements: OverpassElement[] = [];
  let missed = false;
  for (let start = 0; start < sparse.length - 1; start += CAMERA_PIECE - 1) {
    const piece = sparse.slice(start, start + CAMERA_PIECE);
    const coords = piece.map((i) => `${rb.line[i]![0].toFixed(5)},${rb.line[i]![1].toFixed(5)}`).join(",");
    const query = `[out:json][timeout:30];(nwr["highway"="speed_camera"](around:${CAMERA_RADIUS_M},${coords}););out center tags;`;
    const found = await overpass(fetchImpl, query, timeoutMs, pause);
    if (found) elements.push(...found);
    else missed = true;
    progress(Math.min(1, (start + CAMERA_PIECE) / sparse.length));
  }
  // A stretch no server could answer for leaves the cameras of the rest, but the rider is told some are missing.
  return missed ? null : camerasFromElements(elements);
}

/**
 * Add what a GPX lacks (spec roadbook-library, ADR 0026): limits, countries and roundabouts from Valhalla, cameras from
 * Overpass. Throws an EnrichError when the roads cannot be matched; when only the cameras are missing the roadbook is
 * still completed and `camerasMissing` says so.
 */
export async function enrichRoadbook(
  rb: Roadbook,
  options: EnrichOptions = {},
): Promise<{ roadbook: Roadbook; camerasMissing: boolean }> {
  const {
    fetchImpl = fetch,
    onProgress = () => {},
    timeoutMs = 35_000,
    pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
  } = options;
  const cum = cumulativeDistances(rb.line);
  const idx = thinIndexes(cum, MATCH_SPACING_M);
  const chunks: TracedChunk[] = [];
  const pieces = Math.max(1, Math.ceil((idx.length - 1) / (MATCH_PIECE - 1)));
  for (let start = 0, n = 0; start < idx.length - 1; start += MATCH_PIECE - 1, n++) {
    const piece = idx.slice(start, start + MATCH_PIECE);
    onProgress((n / pieces) * 0.6, "Matching the roads");
    const answer = await trace(
      fetchImpl,
      piece.map((i) => ({ lat: rb.line[i]![0], lon: rb.line[i]![1] })),
      timeoutMs,
    );
    chunks.push({ from: piece[0]!, to: piece.at(-1)!, trace: answer });
  }
  onProgress(0.6, "Looking for cameras");
  const found = foundFromTraces(rb.line, chunks);
  const cams = await cameras(
    fetchImpl,
    rb,
    cum,
    timeoutMs,
    (s) => onProgress(0.6 + 0.4 * s, "Looking for cameras"),
    pause,
  );
  onProgress(1, "Done");
  return { roadbook: completed(rb, found, cams), camerasMissing: cams === null };
}

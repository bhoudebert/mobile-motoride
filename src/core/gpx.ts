import { validLatLon } from "./geo.ts";
import type { LatLon, Roadbook, Stop } from "./types.ts";

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();

function attr(attrs: string, name: string): number {
  const m = new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`).exec(attrs);
  return m ? Number(m[1]) : NaN;
}

function tag(xml: string, name: string): string {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(xml);
  return m?.[1] ? decode(m[1]) : "";
}

/** Points of one element kind (`wpt`, `trkpt`, `rtept`) with their optional `<name>`. */
function points(xml: string, kind: string): Stop[] {
  const out: Stop[] = [];
  const re = new RegExp(`<${kind}\\b([^>]*?)(?:/>|>([\\s\\S]*?)</${kind}>)`, "g");
  for (const m of xml.matchAll(re)) {
    const lat = attr(m[1] ?? "", "lat");
    const lon = attr(m[1] ?? "", "lon");
    if (validLatLon(lat, lon)) out.push({ lat, lon, name: tidyStopName(tag(m[2] ?? "", "name")) });
  }
  return out;
}

const COORDS = "-?\\d{1,3}\\.\\d+,\\s*-?\\d{1,3}\\.\\d+";
const NUMBERED_COORDS = new RegExp(`^(\\d+)\\.\\s*${COORDS}$`);
const ENDPOINT_COORDS = new RegExp(`^(Start|Finish):\\s*${COORDS}$`);

/**
 * A stop named only by its coordinates ("1. 50.60485,3.61783", "Start: 50.4552,3.20384") reads and sounds badly
 * when it is shown or spoken: "Point 1", "Start". Any real name is left alone.
 */
export function tidyStopName(name: string): string {
  const numbered = NUMBERED_COORDS.exec(name.trim());
  if (numbered) return `Point ${numbered[1]}`;
  const endpoint = ENDPOINT_COORDS.exec(name.trim());
  if (endpoint) return endpoint[1]!;
  return name;
}

export function slugify(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "roadbook"
  );
}

/**
 * Read the GPX subset agentRide writes: stops from `wpt` (or `rtept`), the line
 * from `trkpt` (or `rtept`). Regex based on purpose: React Native has no DOM.
 */
export function parseGpx(xml: string, id?: string): Roadbook {
  const meta = tag(xml, "metadata");
  const trk = tag(xml, "trk");
  const rte = tag(xml, "rte");
  const name = tag(meta, "name") || tag(trk, "name") || tag(rte, "name") || "Roadbook";
  const description = tag(meta, "desc");

  const track = points(xml, "trkpt");
  const route = points(xml, "rtept");
  const waypoints = points(xml, "wpt");

  const line: LatLon[] = (track.length ? track : route).map((p) => [p.lat, p.lon]);
  if (line.length < 2) throw new Error(`GPX has ${line.length} usable line point(s); at least 2 are needed`);

  const stops = waypoints.length ? waypoints : route;
  return { id: id ?? slugify(name), name, description, stops, line };
}

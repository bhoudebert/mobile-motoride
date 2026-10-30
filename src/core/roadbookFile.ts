import { decodePolyline } from "./polyline.ts";
import { slugify, tidyStopName } from "./gpx.ts";
import type {
  Camera,
  CountryStretch,
  Junction,
  LaneTurn,
  LimitStretch,
  Roadbook,
  RoadbookOrigin,
  Stop,
} from "./types.ts";

export const FORMAT = "motoride-roadbook";
export const SUPPORTED_VERSION = 1;

const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const str = (v: unknown): v is string => typeof v === "string";
const obj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function stopsOf(v: unknown): Stop[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((s) =>
    obj(s) && num(s["lat"]) && num(s["lon"]) && Math.abs(s["lat"]) <= 90 && Math.abs(s["lon"]) <= 180
      ? [
          {
            lat: s["lat"],
            lon: s["lon"],
            name: str(s["name"]) ? tidyStopName(s["name"]) : "",
            ...(s["kind"] === "stop" || s["kind"] === "waypoint" ? { kind: s["kind"] } : {}),
          },
        ]
      : [],
  );
}

export function limitsOf(v: unknown, lastIndex: number): LimitStretch[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((l): LimitStretch[] => {
    if (!obj(l) || !num(l["from"]) || !num(l["to"]) || !num(l["kmh"])) return [];
    const { from, to, kmh } = l as { from: number; to: number; kmh: number };
    if (
      !Number.isInteger(from) ||
      !Number.isInteger(to) ||
      from < 0 ||
      to > lastIndex ||
      to <= from ||
      kmh <= 0 ||
      kmh > 200
    )
      return [];
    return [{ from, to, kmh, posted: l["posted"] === true, ...(str(l["road"]) ? { road: l["road"] } : {}) }];
  });
}

export function countriesOf(v: unknown, lastIndex: number): CountryStretch[] {
  if (!Array.isArray(v)) return [];
  return v
    .flatMap((c): CountryStretch[] => {
      if (!obj(c) || !num(c["from"]) || !num(c["to"]) || !str(c["code"]) || !/^[A-Za-z]{2}$/.test(c["code"])) return [];
      const { from, to } = c as { from: number; to: number };
      if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to > lastIndex || to <= from) return [];
      return [{ from, to, code: c["code"].toUpperCase() }];
    })
    .sort((a, b) => a.from - b.from);
}

export function originOf(v: unknown): RoadbookOrigin | undefined {
  if (!obj(v) || !str(v["app"]) || !v["app"]) return undefined;
  const whole = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0;
  return {
    app: v["app"],
    ...(whole(v["roadbook"]) ? { roadbook: v["roadbook"] } : {}),
    ...(whole(v["ride"]) ? { ride: v["ride"] } : {}),
    ...(str(v["name"]) ? { name: v["name"] } : {}),
  };
}

export function camerasOf(v: unknown): Camera[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((c): Camera[] => {
    if (!obj(c) || !num(c["lat"]) || !num(c["lon"]) || Math.abs(c["lat"]) > 90 || Math.abs(c["lon"]) > 180) return [];
    const b = c["bearing"];
    return [
      {
        lat: c["lat"],
        lon: c["lon"],
        kmh: num(c["kmh"]) && c["kmh"] > 0 ? c["kmh"] : null,
        bearing: num(b) && b >= 0 && b <= 360 ? b % 360 : null,
        direction: c["direction"] === "both" ? "both" : null,
      },
    ];
  });
}

const LANE_TURNS: readonly string[] = ["left", "slight_left", "through", "slight_right", "right", "uturn"];
const int = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;

/**
 * The exits in the order the rider meets them, and the number of the one to take. Traffic circulates counterclockwise
 * where it keeps right (the first exit is the first on the right) and clockwise where it keeps left (the first on the
 * left), starting from the entry, which lies behind the rider at 180 degrees.
 */
function exitsInOrder(bearings: number[], take: number, left: boolean): { exits: number[]; exit: number } {
  const normal = bearings.map((b) => ((b % 360) + 360) % 360);
  // A U-turn exit (straight behind) is the last one, a whole circle round.
  const sweep = (b: number) => (left ? (b - 180 + 360) % 360 : (180 - b + 360) % 360) || 360;
  const order = normal.map((b, i) => ({ b, i })).sort((x, y) => sweep(x.b) - sweep(y.b));
  return { exits: order.map((o) => o.b), exit: order.findIndex((o) => o.i === take) + 1 };
}

export function junctionsOf(v: unknown, lastIndex: number): Junction[] {
  if (!Array.isArray(v)) return [];
  const read = (j: unknown): Junction[] => {
    if (!obj(j)) return [];
    const at = j["at"];
    if (!int(at, 0, lastIndex)) return [];
    if (j["kind"] === "roundabout") {
      const { to, exits, take } = j;
      if (!int(to, 0, lastIndex) || to <= at) return [];
      if (!Array.isArray(exits) || exits.length < 2 || exits.length > 8 || !exits.every((e) => num(e))) return [];
      if (!int(take, 0, exits.length - 1)) return [];
      const left = j["traffic"] === "left";
      return [{ kind: "roundabout", at, to, ...exitsInOrder(exits, take, left) }];
    }
    if (j["kind"] === "lanes") {
      const { count, use, turns } = j;
      if (!int(count, 2, 8) || !Array.isArray(use) || use.length < 1 || use.length >= count) return [];
      if (!use.every((u) => int(u, 0, count - 1)) || new Set(use).size !== use.length) return [];
      const lanes = [...use].sort((a, b) => a - b);
      const arrows =
        Array.isArray(turns) && turns.length === count && turns.every((t) => str(t) && LANE_TURNS.includes(t))
          ? { turns: turns as LaneTurn[] }
          : {};
      return [{ kind: "lanes", at, count, use: lanes, ...arrows }];
    }
    return [];
  };
  return v.flatMap(read).sort((a, b) => a.at - b.at);
}

/** Read a `motoride-roadbook` file (docs/roadbook-format.md). Optional parts that are broken are dropped, the file is kept. */
export function parseRoadbookFile(text: string, id?: string): Roadbook {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new Error("the roadbook file is not JSON");
  }
  if (!obj(doc) || doc["format"] !== FORMAT) throw new Error(`not a ${FORMAT} file`);
  const version = doc["version"];
  if (!num(version)) throw new Error("the roadbook file has no version");
  if (version > SUPPORTED_VERSION) throw new Error(`version ${version} is newer than this app understands`);
  if (!str(doc["line"])) throw new Error("the roadbook file has no line");
  const line = decodePolyline(doc["line"]);
  if (line.length < 2) throw new Error(`the roadbook file line has ${line.length} point(s); at least 2 are needed`);
  const name = str(doc["name"]) && doc["name"] ? doc["name"] : "Roadbook";
  return {
    id: id ?? slugify(name),
    name,
    description: str(doc["description"]) ? doc["description"] : "",
    stops: stopsOf(doc["stops"]),
    line,
    limits: limitsOf(doc["limits"], line.length - 1),
    cameras: camerasOf(doc["cameras"]),
    junctions: junctionsOf(doc["junctions"], line.length - 1),
    countries: countriesOf(doc["countries"], line.length - 1),
    ...(originOf(doc["origin"]) ? { origin: originOf(doc["origin"])! } : {}),
    ...(str(doc["generatedAt"]) && Number.isFinite(Date.parse(doc["generatedAt"]))
      ? { generatedAt: doc["generatedAt"] }
      : {}),
  };
}

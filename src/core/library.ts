import { parseGpx, slugify } from "./gpx.ts";
import { parseRoadbookFile } from "./roadbookFile.ts";
import type { Roadbook } from "./types.ts";
import { t } from "./i18n/index.ts";

/** What the rider sees when a file cannot be imported: the problem, in words. */
export class ImportError extends Error {}

/** The most that is read: a roadbook is 100 to 250 KB, a long GPX a few MB. */
export const MAX_IMPORT_BYTES = 15 * 1024 * 1024;

/** A short, stable name for a route: the same name and line give the same id, so importing twice replaces. */
export function libraryId(name: string, line: ReadonlyArray<readonly [number, number]>): string {
  let h = 0x811c9dc5;
  const feed = (s: string) => {
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  };
  feed(name);
  feed(String(line.length));
  const step = Math.max(1, Math.floor(line.length / 60));
  for (let i = 0; i < line.length; i += step) feed(`${line[i]![0].toFixed(5)},${line[i]![1].toFixed(5)}`);
  return `${slugify(name)}-${h.toString(36)}`;
}

/**
 * A roadbook from the text of a file, a `motoride-roadbook` file or a GPX told apart by what is inside, never by the
 * name (spec roadbook-library). `nameHint` names a file that does not name itself. Throws an ImportError that says
 * what is wrong.
 */
export function parseImport(text: string, nameHint = ""): Roadbook {
  if (text.length > MAX_IMPORT_BYTES) throw new ImportError(t("home.err.tooBig"));
  const body = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).trimStart();
  let rb: Roadbook;
  try {
    if (body.startsWith("{")) rb = parseRoadbookFile(body);
    else if (/<gpx[\s>]/i.test(body.slice(0, 4000))) rb = parseGpx(body);
    else throw new ImportError(t("home.err.notRoadbook"));
  } catch (e) {
    if (e instanceof ImportError) throw e;
    throw new ImportError(e instanceof Error ? `${e.message}.`.replace(/\.\.$/, ".") : t("home.err.unreadable"));
  }
  // A file that does not name itself takes the name of the file it came from.
  const name = rb.name === "Roadbook" && nameHint ? nameFromFile(nameHint) : rb.name;
  return { ...rb, name, id: libraryId(name, rb.line) };
}

/** "my ride.motoride.json" → "my ride". */
export function nameFromFile(file: string): string {
  const last = file.split(/[\\/]/).pop() ?? file;
  return (
    decodeURIComponent(
      last
        .replace(/\.(motoride\.json|json|gpx|xml)$/i, "")
        .replace(/[_]+/g, " ")
        .trim(),
    ) || "Roadbook"
  );
}

/** The address a `mobilemotoride://import?url=…` link asks for, only http or https; null for anything else. */
export function importUrlOf(link: string): string | null {
  const m = /^mobilemotoride:\/\/import\?(.*)$/i.exec(link);
  if (!m) return null;
  const raw = new URLSearchParams(m[1]).get("url");
  if (!raw) return null;
  return /^https?:\/\/[^\s]+$/i.test(raw) ? raw : null;
}

/** Whether a link is a request to import, valid or not. */
export const isImportLink = (link: string): boolean => /^mobilemotoride:\/\/import\b/i.test(link);

/** A link the app is asked to open as a file: a shared or "opened with" file. */
export const isFileLink = (link: string): boolean => /^(content|file):\/\//i.test(link);

/** A roadbook kept on the phone, with when it was imported. */
export interface ImportedRoadbook {
  roadbook: Roadbook;
  importedAt: number;
  /** `pending`: the speed limits, countries and cameras could not be added yet; the list offers to try again. */
  completion?: "pending";
}

export const serializeStored = (entry: ImportedRoadbook): string => JSON.stringify({ v: 1, ...entry });

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** A kept roadbook read back; null for anything that is not one, so a damaged file is skipped, never thrown. */
export function parseStored(text: string): ImportedRoadbook | null {
  try {
    const raw = JSON.parse(text) as { v?: unknown; importedAt?: unknown; roadbook?: Record<string, unknown> };
    const rb = raw.roadbook;
    if (raw.v !== 1 || !finite(raw.importedAt) || !rb || typeof rb !== "object") return null;
    const { id, name, description, stops, line } = rb as Record<string, unknown>;
    if (typeof id !== "string" || typeof name !== "string" || !Array.isArray(stops) || !Array.isArray(line))
      return null;
    if (line.length < 2 || !line.every((p) => Array.isArray(p) && finite(p[0]) && finite(p[1]))) return null;
    return {
      importedAt: raw.importedAt,
      ...((raw as { completion?: unknown }).completion === "pending" ? { completion: "pending" as const } : {}),
      roadbook: { ...(rb as unknown as Roadbook), description: typeof description === "string" ? description : "" },
    };
  } catch {
    return null;
  }
}

import { Directory, File, Paths } from "expo-file-system";
import { serializeRoadbookFile } from "../core/roadbookFile.ts";
import { slugify } from "../core/gpx.ts";
import type { Roadbook } from "../core/types.ts";
import { parseStored, serializeStored, type ImportedRoadbook } from "../core/library.ts";

const folder = () => new Directory(Paths.document, "library");
const fileOf = (id: string) => new File(folder(), `${id}.json`);

/** The roadbooks kept on the phone, newest first; a file that cannot be read is left out (spec roadbook-library). */
export async function listImported(): Promise<ImportedRoadbook[]> {
  try {
    const dir = folder();
    if (!dir.exists) return [];
    const out: ImportedRoadbook[] = [];
    for (const entry of dir.list()) {
      if (!(entry instanceof File) || !entry.name.endsWith(".json")) continue;
      try {
        const kept = parseStored(await entry.text());
        if (kept) out.push(kept);
      } catch {
        // Unreadable: skipped.
      }
    }
    return out.sort((a, b) => b.importedAt - a.importedAt);
  } catch {
    return [];
  }
}

export async function saveImported(entry: ImportedRoadbook): Promise<void> {
  const dir = folder();
  if (!dir.exists) dir.create({ intermediates: true });
  const file = fileOf(entry.roadbook.id);
  if (!file.exists) file.create();
  await file.write(serializeStored(entry));
}

export async function deleteImported(id: string): Promise<void> {
  const file = fileOf(id);
  if (file.exists) file.delete();
}

/** The text of a file the system hands over by address: a shared or "opened with" file, or one the picker chose. */
export async function readFileText(uri: string): Promise<string> {
  return new File(uri).text();
}

/**
 * A roadbook written as a `motoride-roadbook` file in the cache, ready for the share sheet (Save to Files, a drive, a mail):
 * the file another phone, or this one later, can import. Returns its address.
 */
export function writeRoadbookFile(roadbook: Roadbook): string {
  const dir = new Directory(Paths.cache, "roadbook-files");
  if (!dir.exists) dir.create({ intermediates: true });
  const file = new File(dir, `${slugify(roadbook.name) || "roadbook"}.motoride.json`);
  if (!file.exists) file.create();
  file.write(serializeRoadbookFile(roadbook));
  return file.uri;
}

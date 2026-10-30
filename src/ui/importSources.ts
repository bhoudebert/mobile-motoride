import * as DocumentPicker from "expo-document-picker";
import { t } from "../core/i18n/index.ts";
import { ImportError, MAX_IMPORT_BYTES } from "../core/library.ts";
import { readFileText } from "./libraryStore.ts";

/** A file's text and the name it came with. */
export interface PickedText {
  text: string;
  name: string;
  /** The stamp a server gave this version, when it came from one. */
  stamp?: string;
}

/** Ask the rider for a file; null when they leave the picker without one. */
export async function pickFile(): Promise<PickedText | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  if (asset.size !== undefined && asset.size > MAX_IMPORT_BYTES) throw new ImportError(t("home.import.tooBig"));
  return { text: await readFileText(asset.uri), name: asset.name };
}

/** A file the system opened the app with (a `content://` or `file://` address). */
export async function readOpened(uri: string): Promise<PickedText> {
  return { text: await readFileText(uri), name: decodeURIComponent(uri.split("/").pop() ?? "") };
}

/** A file at an http or https address (spec roadbook-library): what `mobilemotoride://import?url=…` asks for. */
export async function download(url: string, timeoutMs = 20_000): Promise<PickedText> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new ImportError(t("home.import.answered", { status: res.status }));
    const text = await res.text();
    return { text, name: decodeURIComponent(url.split("?")[0]!.split("/").pop() ?? "") };
  } catch (e) {
    if (e instanceof ImportError) throw e;
    throw new ImportError(t("home.import.downloadFailed"));
  } finally {
    clearTimeout(timer);
  }
}

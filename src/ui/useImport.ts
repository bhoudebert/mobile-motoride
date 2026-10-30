import { useCallback, useEffect, useRef, useState } from "react";
import { Linking } from "react-native";
import { t } from "../core/i18n/index.ts";
import { ImportError, importUrlOf, isFileLink, isImportLink, parseImport, placeImport } from "../core/library.ts";
import type { ImportedRoadbook } from "../core/library.ts";
import type { Roadbook } from "../core/types.ts";
import { deleteImported, listImported, saveImported } from "./libraryStore.ts";
import { download, pickFile, readOpened, type PickedText } from "./importSources.ts";
import { needsCompletion } from "../core/enrich.ts";
import { EnrichError, enrichRoadbook } from "../services/enrich.ts";

/** Ask the services for what a GPX lacks; the roadbook as it was, and what to tell the rider, when they cannot give it. */
async function complete(
  rb: Roadbook,
  setNotice: (n: ImportNotice) => void,
): Promise<{ roadbook: Roadbook; problem: string | null }> {
  setNotice({ kind: "busy", text: t("home.import.adding", { percent: 0 }) });
  try {
    const { roadbook, camerasMissing } = await enrichRoadbook(rb, {
      onProgress: (share) =>
        setNotice({ kind: "busy", text: t("home.import.adding", { percent: Math.round(share * 100) }) }),
    });
    return {
      roadbook,
      problem: camerasMissing ? t("home.import.camerasMissing") : null,
    };
  } catch (e) {
    const why = e instanceof EnrichError ? e.message : t("home.import.servicesDown");
    return { roadbook: rb, problem: t("home.import.withoutLimits", { why }) };
  }
}

export type ImportNotice =
  { kind: "busy"; text?: string } | { kind: "error"; text: string } | { kind: "info"; text: string } | null;

/**
 * The roadbooks kept on the phone and the ways to bring one in: a file picked, a file the phone opens the app with,
 * and an import link (spec roadbook-library). A roadbook that comes in is kept and handed to `onImported`.
 */
export function useImport(onImported: (rb: Roadbook) => void) {
  const [items, setItems] = useState<ImportedRoadbook[]>([]);
  const [notice, setNotice] = useState<ImportNotice>(null);
  const seen = useRef(new Set<string>());
  const itemsRef = useRef<ImportedRoadbook[]>([]);
  itemsRef.current = items;
  const handler = useRef(onImported);
  handler.current = onImported;

  useEffect(() => {
    let live = true;
    listImported().then((list) => live && setItems(list));
    return () => {
      live = false;
    };
  }, []);

  /** Read, check and keep: the one place every way of importing ends. */
  const finish = useCallback(async (get: () => Promise<PickedText | null>) => {
    setNotice({ kind: "busy" });
    try {
      const picked = await get();
      if (!picked) return setNotice(null);
      const imported = parseImport(picked.text, picked.name);
      const place = placeImport(imported, await listImported());
      if (place.kind === "older") {
        // Never downgrade silently: the newer copy stays, and is the one that opens.
        setNotice({ kind: "info", text: t("home.import.older", { name: place.kept.roadbook.name }) });
        return handler.current(place.kept.roadbook);
      }
      const parsed = place.kind === "replace" ? { ...imported, id: place.id } : imported;
      // A GPX has no limits, countries or cameras: ask for them once, now, while there is a network (ADR 0026).
      const { roadbook: rb, problem } = needsCompletion(parsed)
        ? await complete(parsed, setNotice)
        : { roadbook: parsed, problem: null };
      const entry: ImportedRoadbook = {
        roadbook: rb,
        importedAt: Date.now(),
        ...(problem ? { completion: "pending" as const } : {}),
      };
      await saveImported(entry);
      setItems((list) => [entry, ...list.filter((i) => i.roadbook.id !== rb.id)]);
      setNotice(problem ? { kind: "error", text: problem } : null);
      handler.current(rb);
    } catch (e) {
      if (!(e instanceof ImportError)) console.warn("The import failed", e);
      setNotice({
        kind: "error",
        text: e instanceof ImportError ? e.message : t("home.import.unreadable"),
      });
    }
  }, []);

  const pick = useCallback(() => finish(pickFile), [finish]);

  const handleLink = useCallback(
    (link: string | null | undefined) => {
      if (!link || seen.current.has(link)) return;
      if (isImportLink(link)) {
        seen.current.add(link);
        const url = importUrlOf(link);
        if (!url) return setNotice({ kind: "error", text: t("home.import.badLink") });
        void finish(() => download(url));
      } else if (isFileLink(link)) {
        seen.current.add(link);
        void finish(() => readOpened(link));
      }
    },
    [finish],
  );

  useEffect(() => {
    Linking.getInitialURL()
      .then(handleLink)
      .catch(() => {});
    const sub = Linking.addEventListener("url", (e) => handleLink(e.url));
    return () => sub.remove();
  }, [handleLink]);

  /** Try again to add what a GPX lacks, from the list. */
  const retry = useCallback(async (id: string) => {
    const current = itemsRef.current.find((i) => i.roadbook.id === id);
    if (!current) return;
    const { roadbook, problem } = await complete(current.roadbook, setNotice);
    const entry: ImportedRoadbook = {
      roadbook,
      importedAt: current.importedAt,
      ...(problem ? { completion: "pending" as const } : {}),
    };
    await saveImported(entry);
    setItems((list) => list.map((i) => (i.roadbook.id === id ? entry : i)));
    setNotice(problem ? { kind: "error", text: problem } : null);
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteImported(id);
    setItems((list) => list.filter((i) => i.roadbook.id !== id));
  }, []);

  return { items, notice, dismiss: () => setNotice(null), pick, remove, retry };
}

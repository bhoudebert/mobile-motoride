import { detachedRoadbook, type LibraryId } from "../core/serverIdentity.ts";
import { libraryKeyOf } from "./libraryIdentity.ts";
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
import { fetchServerRoadbook } from "../services/serverRoadbooks.ts";
import type { ServerRoadbook } from "../core/serverRoadbooks.ts";
import type { ServerSetting } from "../core/liveShare.ts";

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
  | { kind: "busy"; text?: string }
  | { kind: "error"; text: string }
  | { kind: "info"; text: string; action?: { label: string; onPress: () => void } }
  | null;

/**
 * The roadbooks kept on the phone and the ways to bring one in: a file picked, a file the phone opens the app with,
 * and an import link (spec roadbook-library). A roadbook that comes in is kept and handed to `onImported`.
 */
export function useImport(onImported: (rb: Roadbook) => void) {
  const [items, setItems] = useState<ImportedRoadbook[]>([]);
  const [notice, setNotice] = useState<ImportNotice>(null);
  const [fetching, setFetching] = useState<number | null>(null);
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
  const finish = useCallback(async (get: () => Promise<PickedText | null>, open = true) => {
    setNotice({ kind: "busy" });
    try {
      const picked = await get();
      if (!picked) return setNotice(null);
      const imported = parseImport(picked.text, picked.name);
      const place = placeImport(imported, await listImported());
      if (place.kind === "older") {
        // Never downgrade silently: the newer copy stays, and is the one that opens.
        setNotice({ kind: "info", text: t("home.import.older", { name: place.kept.roadbook.name }) });
        return open ? handler.current(place.kept.roadbook) : undefined;
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
        ...(picked.stamp ? { serverStamp: picked.stamp } : {}),
        ...(picked.serverId !== undefined ? { serverId: picked.serverId } : {}),
        ...(picked.serverKey ? { serverKey: picked.serverKey } : {}),
      };
      await saveImported(entry);
      setItems((list) => [entry, ...list.filter((i) => i.roadbook.id !== rb.id)]);
      // A roadbook brought down for the rider who is looking at the list (an update asked for) does not open its ride.
      setNotice(
        problem
          ? { kind: "error", text: problem }
          : open
            ? null
            : { kind: "info", text: t("home.server.downloaded", { name: rb.name }) },
      );
      if (open) handler.current(rb);
    } catch (e) {
      if (!(e instanceof ImportError)) console.warn("The import failed", e);
      setNotice({
        kind: "error",
        text: e instanceof ImportError ? e.message : t("home.import.unreadable"),
      });
    }
  }, []);

  const pick = useCallback(() => finish(pickFile), [finish]);

  /**
   * Fetch a roadbook from the rider's server and keep it, replacing the copy of the same origin (spec roadbook-library).
   * "slow": the server is still making the file (the first one of a roadbook is made on the first request and a long route
   * takes minutes); nothing is kept, the rider is told it is being prepared, and the caller asks the server to prepare it.
   */
  const fromServer = useCallback(
    async (server: ServerSetting, listed: ServerRoadbook, open = true): Promise<"done" | "slow"> => {
      setFetching(listed.id);
      try {
        // No file yet: nothing to fetch, and a request would wait for the build. The caller asks the server to prepare it.
        if (!listed.ready) {
          setNotice({ kind: "info", text: t("home.server.preparing", { name: listed.name }) });
          return "slow";
        }
        setNotice({ kind: "busy" });
        const got = await fetchServerRoadbook(server, listed.id);
        if (!got.ok && got.reason === "slow") {
          setNotice({ kind: "info", text: t("home.server.preparing", { name: listed.name }) });
          return "slow";
        }
        await finish(async () => {
          if (!got.ok) throw new ImportError(t(`home.server.problem.${got.reason}`));
          return {
            text: got.text,
            name: `${listed.name}.motoride.json`,
            stamp: got.stamp ?? listed.stamp,
            serverId: listed.id,
            serverKey: await libraryKeyOf(server),
          };
        }, open);
        return "done";
      } finally {
        setFetching(null);
      }
    },
    [finish],
  );

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
      ...(current.serverStamp ? { serverStamp: current.serverStamp } : {}),
      ...(current.serverId !== undefined ? { serverId: current.serverId } : {}),
      ...(current.serverKey ? { serverKey: current.serverKey } : {}),
    };
    await saveImported(entry);
    setItems((list) => list.map((i) => (i.roadbook.id === id ? entry : i)));
    setNotice(problem ? { kind: "error", text: problem } : null);
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteImported(id);
    setItems((list) => list.filter((i) => i.roadbook.id !== id));
  }, []);

  /** The copies kept from a server that is not the one in use become roadbooks of the phone only (ADR 0049). */
  const detach = useCallback(async (current: LibraryId | null) => {
    const changed: ImportedRoadbook[] = [];
    for (const item of await listImported()) {
      const next = detachedRoadbook(item, current);
      if (!next) continue;
      await saveImported(next);
      changed.push(next);
    }
    if (changed.length > 0)
      setItems((list) => list.map((i) => changed.find((c) => c.roadbook.id === i.roadbook.id) ?? i));
  }, []);

  return { items, notice, dismiss: () => setNotice(null), pick, remove, retry, fromServer, fetching, detach };
}

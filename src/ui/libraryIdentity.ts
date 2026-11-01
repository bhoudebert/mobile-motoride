import { useEffect, useState } from "react";
import { keyOf, libraryId, type LibraryId } from "../core/serverIdentity.ts";
import type { ServerSetting } from "../core/liveShare.ts";
import { getMe } from "../services/hostedServer.ts";

/** What the server says the rider is, kept per address and token for the life of the app: a rider reference changes nothing. */
const known = new Map<string, string | null>();
const cacheKey = (s: ServerSetting) => `${s.url} ${s.token}`;

/**
 * The library the server in use holds (ADR 0049): its address, and the rider reference its `/me` gives. A server that does not
 * answer, or gives none, makes an identity by address alone; one that cannot be reached is not remembered, so the next ask tries again.
 */
export async function libraryIdOf(server: ServerSetting): Promise<LibraryId> {
  const key = cacheKey(server);
  if (known.has(key)) return libraryId(server.url, known.get(key) ?? null);
  const r = await getMe(server);
  if (r.ok) known.set(key, r.value.riderRef);
  else if (r.reason === "refused" || r.reason === "failed") known.set(key, null);
  return libraryId(server.url, r.ok ? r.value.riderRef : null);
}

export const libraryKeyOf = async (server: ServerSetting): Promise<string> => keyOf(await libraryIdOf(server));

/** For tests. */
export const forgetLibraryIdentities = () => known.clear();

/**
 * The identity of the server in use, at once by address and then with the rider reference when `/me` answers; null with no
 * server. It is worked out in the render itself, so a screen that has just seen a server never sees the identity of none.
 */
export function useLibraryId(server: ServerSetting | null): LibraryId | null {
  const [found, setFound] = useState<{ key: string; rider: string | null } | null>(null);
  useEffect(() => {
    if (!server) return;
    let live = true;
    void libraryIdOf(server).then(
      (id) =>
        live && setFound({ key: cacheKey(server), rider: id.rider ? (known.get(cacheKey(server)) ?? null) : null }),
    );
    return () => {
      live = false;
    };
  }, [server?.url, server?.token]);
  if (!server) return null;
  return libraryId(server.url, found?.key === cacheKey(server) ? found.rider : null);
}

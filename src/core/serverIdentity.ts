import type { ImportedRoadbook } from "./library.ts";
import type { RideMeta } from "./recording.ts";

/**
 * Which library a copy kept from a server came from (spec roadbook-library, "Changing server keeps what is on the phone",
 * ADR 0049): a hash of the server's address and one of the opaque rider reference its `GET /me` gives (empty while it gives
 * none), written `address.rider`. Never the token. The same rider on another phone has the same key.
 */
export interface LibraryId {
  address: string;
  rider: string;
}

/** A small, fast hash of a text, in hex: enough to tell libraries apart; it is not a secret. */
function hash(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return ((h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0")).slice(0, 12);
}

export const libraryId = (url: string, riderRef: string | null): LibraryId => ({
  address: hash(url.toLowerCase()),
  rider: riderRef ? hash(riderRef) : "",
});

export const keyOf = (id: LibraryId): string => `${id.address}.${id.rider}`;

/** Whether a copy with this key came from the library `current`, which may not be known to the rider yet (`rider` empty). */
export function belongsTo(copyKey: string | undefined, current: LibraryId | null): boolean {
  if (!current || !copyKey) return false;
  const [address = "", rider = ""] = copyKey.split(".");
  if (address !== current.address) return false;
  return !rider || !current.rider || rider === current.rider;
}

const linked = (e: ImportedRoadbook) => e.serverId !== undefined || e.serverStamp !== undefined;

/**
 * The copy as a roadbook of the phone only, when it was kept from a server that is not `current`: the file stays, its number,
 * stamp and key are dropped. Null when nothing changes (not from a server, or from the server in use).
 */
export function detachedRoadbook(e: ImportedRoadbook, current: LibraryId | null): ImportedRoadbook | null {
  if (!linked(e) && e.serverKey === undefined) return null;
  if (belongsTo(e.serverKey, current)) return null;
  const { serverId: _id, serverStamp: _stamp, serverKey: _key, ...rest } = e;
  return rest;
}

/** The same for a ride: its server id, its "sent" mark and its key are dropped; the recording stays. */
export function detachedRide(m: RideMeta, current: LibraryId | null): RideMeta | null {
  if (m.uploadedAt === undefined && m.serverRideId === undefined && m.serverKey === undefined) return null;
  if (belongsTo(m.serverKey, current)) return null;
  const { uploadedAt: _at, serverRideId: _id, serverKey: _key, ...rest } = m;
  return rest;
}

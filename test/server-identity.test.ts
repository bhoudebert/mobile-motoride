import assert from "node:assert/strict";
import { test } from "node:test";
import { parseStored, serializeStored, type ImportedRoadbook } from "../src/core/library.ts";
import { parseMeta, serializeMeta, type RideMeta } from "../src/core/recording.ts";
import { belongsTo, detachedRide, detachedRoadbook, keyOf, libraryId } from "../src/core/serverIdentity.ts";
import type { Roadbook } from "../src/core/types.ts";

const roadbook: Roadbook = {
  id: "loop",
  name: "Loop",
  description: "",
  stops: [],
  line: [
    [50, 3],
    [50.1, 3.1],
  ],
};
const copy = (extra: Partial<ImportedRoadbook> = {}): ImportedRoadbook => ({ roadbook, importedAt: 1, ...extra });
const ride = (extra: Partial<RideMeta> = {}): RideMeta => ({
  id: "r",
  roadbookId: "loop",
  roadbookName: "Loop",
  startedAt: 1,
  endedAt: 2,
  distanceM: 10,
  points: 3,
  state: "completed",
  ...extra,
});

const A = libraryId("https://a.example.org", "rr-1111");
const A2 = libraryId("https://a.example.org", "rr-1111");
const B = libraryId("https://b.example.org", "rr-1111");
const A_OTHER_RIDER = libraryId("https://a.example.org", "rr-2222");

test("a library is told by its address and its rider reference, the same for the same rider, never by the token", () => {
  assert.equal(keyOf(A), keyOf(A2));
  assert.notEqual(keyOf(A), keyOf(B));
  assert.notEqual(keyOf(A), keyOf(A_OTHER_RIDER));
  assert.equal(libraryId("https://A.example.org", null).address, A.address, "the address is read without its case");
  assert.equal(libraryId("https://a.example.org", null).rider, "");
  assert.ok(!keyOf(A).includes("rr-1111"));
});

test("a copy belongs to the library it came from; an unknown rider reference does not tell a library apart", () => {
  assert.equal(belongsTo(keyOf(A), A), true);
  assert.equal(belongsTo(keyOf(A), B), false);
  assert.equal(belongsTo(keyOf(A), A_OTHER_RIDER), false);
  assert.equal(
    belongsTo(keyOf(libraryId("https://a.example.org", null)), A),
    true,
    "kept before the reference was known",
  );
  assert.equal(belongsTo(keyOf(A), libraryId("https://a.example.org", null)), true, "reference not known yet");
  assert.equal(belongsTo(keyOf(A), null), false, "no server");
  assert.equal(belongsTo(undefined, A), false, "kept before libraries had an identity");
});

test("removing the server turns every copy from it into a roadbook of the phone only, the file kept", () => {
  const kept = copy({ serverId: 7, serverStamp: "aaa", serverKey: keyOf(A) });
  const local = detachedRoadbook(kept, null)!;
  assert.equal(local.serverId, undefined);
  assert.equal(local.serverStamp, undefined);
  assert.equal(local.serverKey, undefined);
  assert.equal(local.roadbook, roadbook);
  assert.equal(local.importedAt, 1);
});

test("a copy kept before identities existed belongs to no server: it is detached, whether there is a server or not", () => {
  const legacy = copy({ serverId: 7, serverStamp: "aaa" });
  assert.equal(detachedRoadbook(legacy, null)?.serverId, undefined);
  assert.equal(detachedRoadbook(legacy, A)?.serverId, undefined);
  assert.equal(detachedRoadbook(copy({ serverStamp: "aaa" }), A)?.serverStamp, undefined);
});

test("nothing changes for a copy of the server in use, or for a roadbook that never came from a server", () => {
  assert.equal(detachedRoadbook(copy({ serverId: 7, serverStamp: "a", serverKey: keyOf(A) }), A), null);
  assert.equal(detachedRoadbook(copy(), A), null);
  assert.equal(detachedRoadbook(copy(), null), null);
});

test("switching to another server detaches the copies of the first, and number 7 is no longer matched", () => {
  const fromA = copy({ serverId: 7, serverStamp: "a", serverKey: keyOf(A) });
  assert.equal(detachedRoadbook(fromA, B)?.serverId, undefined);
});

test("the same for rides: the recording stays, the link and the sent mark go", () => {
  const sent = ride({ uploadedAt: 5, serverRideId: "r", serverKey: keyOf(A) });
  const local = detachedRide(sent, null)!;
  assert.deepEqual([local.uploadedAt, local.serverRideId, local.serverKey], [undefined, undefined, undefined]);
  assert.equal(local.distanceM, 10);
  assert.equal(detachedRide(sent, A), null);
  assert.equal(detachedRide(sent, B)?.uploadedAt, undefined);
  assert.equal(detachedRide(ride({ uploadedAt: 5, serverRideId: "r" }), A)?.uploadedAt, undefined, "legacy");
  assert.equal(detachedRide(ride(), A), null);
});

test("the key is kept with the copy and read back", () => {
  const back = parseStored(serializeStored(copy({ serverId: 7, serverKey: "abc.def" })))!;
  assert.equal(back.serverKey, "abc.def");
  const meta = parseMeta(serializeMeta(ride({ uploadedAt: 5, serverRideId: "r", serverKey: "abc.def" })))!;
  assert.equal(meta.serverKey, "abc.def");
});

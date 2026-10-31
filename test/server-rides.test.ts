import assert from "node:assert/strict";
import { test } from "node:test";
import type { RideMeta } from "../src/core/recording.ts";
import { mergeRides, parseServerRides, type ServerRide } from "../src/core/serverRides.ts";

const wire = {
  id: "2026-10-30T13-49-32-coutiches",
  name: "Coutiches loop",
  startedAt: "2026-10-30T13:49:32.767Z",
  endedAt: "2026-10-30T15:49:32.767Z",
  distanceKm: 74.3,
  points: 7000,
  roadbook: { id: 3, name: "Coutiches loop" },
  bytes: 1_200_000,
  uploadedAt: "2026-10-30T16:00:00.000Z",
  state: "completed",
  climbM: 412,
  peakLeftDeg: 38,
  peakRightDeg: 41,
};

test("a server's rides are read: ISO dates become milliseconds, kilometres metres, and the optional parts are kept", () => {
  const [r] = parseServerRides({ rides: [wire] });
  assert.deepEqual(r, {
    id: wire.id,
    name: "Coutiches loop",
    startedAt: Date.UTC(2026, 9, 30, 13, 49, 32, 767),
    endedAt: Date.UTC(2026, 9, 30, 15, 49, 32, 767),
    distanceM: 74_300,
    points: 7000,
    uploadedAt: Date.UTC(2026, 9, 30, 16, 0, 0),
    bytes: 1_200_000,
    state: "completed",
    climbM: 412,
    peakLeftDeg: 38,
    peakRightDeg: 41,
  });
});

test("what is not a ride is left out, and what the server leaves out stays out", () => {
  const list = parseServerRides({
    rides: [
      { ...wire, id: "no-dates", startedAt: "yesterday" },
      null,
      { ...wire, id: "", name: "x" },
      { id: "min", startedAt: wire.startedAt, endedAt: wire.endedAt, distanceKm: 5 },
      { ...wire, id: "odd", state: "flying", climbM: "a lot" },
    ],
  });
  assert.deepEqual(
    list.map((r) => r.id),
    ["min", "odd"],
  );
  assert.equal(list[0]!.name, "min");
  assert.equal(list[0]!.state, undefined);
  assert.equal(list[0]!.uploadedAt, Date.parse(wire.startedAt));
  assert.equal(list[1]!.state, undefined);
  assert.equal(list[1]!.climbM, undefined);
  assert.deepEqual(parseServerRides(null), []);
  assert.deepEqual(parseServerRides({}), []);
});

const mine = (id: string, startedAt: number, extra: Partial<RideMeta> = {}): RideMeta => ({
  id,
  roadbookId: "rb",
  roadbookName: id,
  startedAt,
  endedAt: startedAt + 3_600_000,
  distanceM: 50_000,
  points: 100,
  state: "completed",
  ...extra,
});
const theirs = (id: string, startedAt: number): ServerRide => ({
  id,
  name: id,
  startedAt,
  endedAt: startedAt + 3_600_000,
  distanceM: 50_000,
  points: 100,
  uploadedAt: startedAt + 4_000_000,
});

test("one row for a ride that is on the phone and on the server, a row for each of the others, newest first", () => {
  const rows = mergeRides([mine("both", 2000), mine("phone", 1000)], [theirs("both", 2000), theirs("server", 3000)]);
  assert.deepEqual(
    rows.map((r) => [r.id, r.place]),
    [
      ["server", "server"],
      ["both", "both"],
      ["phone", "phone"],
    ],
  );
  // The phone's own summary is what the card shows when it has one.
  assert.equal(rows[1]!.ride, rows[1]!.local);
  assert.equal(rows[0]!.local, undefined);
  assert.equal(rows[0]!.ride.roadbookName, "server");
});

test("when the server answers it is the truth: a ride marked uploaded that it does not list is on the phone only", () => {
  const sent = mine("sent", 1000, { uploadedAt: 5000, serverRideId: "sent" });
  assert.equal(mergeRides([sent], [])[0]!.place, "phone");
  assert.equal(mergeRides([sent], [theirs("sent", 1000)])[0]!.place, "both");
});

test("when it does not (no server, offline) the phone's own mark is used and nothing is added", () => {
  const sent = mine("sent", 1000, { uploadedAt: 5000, serverRideId: "sent" });
  const rows = mergeRides([sent, mine("alone", 500)], null);
  assert.deepEqual(
    rows.map((r) => [r.id, r.place]),
    [
      ["sent", "both"],
      ["alone", "phone"],
    ],
  );
});

test("a ride deleted on the phone that the server keeps is a server row again", () => {
  const rows = mergeRides([], [theirs("gone", 1000)]);
  assert.deepEqual(
    rows.map((r) => [r.id, r.place]),
    [["gone", "server"]],
  );
});

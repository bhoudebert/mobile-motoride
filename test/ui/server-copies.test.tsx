import { render, screen, fireEvent } from "@testing-library/react-native";
import App from "../../App.tsx";
import { keyOf, libraryId } from "../../src/core/serverIdentity.ts";
import { serializeStored } from "../../src/core/library.ts";
import { serializeMeta, type RideMeta } from "../../src/core/recording.ts";
import { forgetLibraryIdentities } from "../../src/ui/libraryIdentity.ts";
import { resetServerSetting, saveServer } from "../../src/ui/serverSetting.ts";
import { dirs, files, resetFiles } from "./filesystem.mock.ts";
import { flush } from "./flush.ts";
import { fixtureRoadbooks } from "../fixtures/roadbooks.ts";
import { stored } from "./securestore.mock.ts";

// Spec roadbook-library and ride-recording, "Changing server keeps what is on the phone".
const fetchMock = globalThis.fetch as unknown as jest.Mock;
const SERVER = { url: "https://rides.example.org", token: "mrt_" + "A".repeat(43) };
const OTHER = { url: "https://other.example.org", token: "mrt_" + "B".repeat(43) };
const roadbook = fixtureRoadbooks[0]!;
const bookFile = `file:///document/library/${roadbook.id}.json`;
const rideFile = "file:///document/rides/ride-1.json";

const ride = (extra: Partial<RideMeta> = {}): RideMeta => ({
  id: "ride-1",
  roadbookId: roadbook.id,
  roadbookName: roadbook.name,
  startedAt: 1,
  endedAt: 2,
  distanceM: 10,
  points: 3,
  state: "completed",
  ...extra,
});
const keep = (book: object, meta: RideMeta) => {
  dirs.add("file:///document/library");
  dirs.add("file:///document/rides");
  files.set(bookFile, serializeStored({ roadbook, importedAt: 1, ...book }));
  files.set(rideFile, serializeMeta(meta));
  files.set("file:///document/rides/ride-1.gpx", "<gpx/>");
};
const book = () => JSON.parse(files.get(bookFile)!);
const meta = () => JSON.parse(files.get(rideFile)!);

beforeEach(async () => {
  resetFiles();
  await resetServerSetting();
  forgetLibraryIdentities();
  stored.clear();
  // The server answers its health and /me with a rider reference.
  fetchMock.mockImplementation(async (url: string) => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () =>
      String(url).endsWith("/me")
        ? { hosted: false, riderRef: "rr-0123456789abcdef", traffic: { mode: "open" }, library: {} }
        : { roadbooks: [], rides: [] },
  }));
});
afterEach(() => fetchMock.mockImplementation(() => Promise.resolve({ ok: true })));

test("no server: a roadbook and a ride that were marked as from a server become the phone's own, files kept", async () => {
  keep(
    { serverId: 7, serverStamp: "aaa", serverKey: keyOf(libraryId(SERVER.url, null)) },
    ride({ uploadedAt: 5, serverRideId: "ride-1" }),
  );
  await render(<App />);
  await flush();
  expect(book().serverId).toBeUndefined();
  expect(book().serverStamp).toBeUndefined();
  expect(book().serverKey).toBeUndefined();
  expect(book().roadbook.name).toBe(roadbook.name);
  expect(meta().uploadedAt).toBeUndefined();
  expect(meta().serverRideId).toBeUndefined();
  expect(meta().distanceM).toBe(10);
  await fireEvent.press(screen.getByLabelText("Roadbooks"));
  expect(screen.getByText("Imported from a file")).toBeTruthy();
  expect(screen.queryByText("From your server")).toBeNull();
});

test("copies kept before libraries had an identity belong to no server: detached at once", async () => {
  keep({ serverId: 7, serverStamp: "aaa" }, ride({ uploadedAt: 5, serverRideId: "ride-1" }));
  await saveServer(SERVER);
  await render(<App />);
  await flush();
  expect(book().serverId).toBeUndefined();
  expect(meta().serverRideId).toBeUndefined();
});

test("the server in use keeps its copies and their links", async () => {
  const key = keyOf(libraryId(SERVER.url, "rr-0123456789abcdef"));
  keep(
    { serverId: 7, serverStamp: "aaa", serverKey: key },
    ride({ uploadedAt: 5, serverRideId: "ride-1", serverKey: key }),
  );
  await saveServer(SERVER);
  await render(<App />);
  await flush();
  expect(book().serverId).toBe(7);
  expect(meta().serverRideId).toBe("ride-1");
});

test("another server: the first one's copies become the phone's own, so its number 7 matches nothing", async () => {
  const key = keyOf(libraryId(SERVER.url, "rr-0123456789abcdef"));
  keep(
    { serverId: 7, serverStamp: "aaa", serverKey: key },
    ride({ uploadedAt: 5, serverRideId: "ride-1", serverKey: key }),
  );
  await saveServer(OTHER);
  await render(<App />);
  await flush();
  expect(book().serverId).toBeUndefined();
  expect(meta().uploadedAt).toBeUndefined();
});

test("nothing is touched before the stored setting has been read", async () => {
  const key = keyOf(libraryId(SERVER.url, "rr-0123456789abcdef"));
  keep(
    { serverId: 7, serverStamp: "aaa", serverKey: key },
    ride({ uploadedAt: 5, serverRideId: "ride-1", serverKey: key }),
  );
  stored.set("server-setting", JSON.stringify(SERVER));
  await render(<App />);
  await flush();
  expect(book().serverId).toBe(7);
});

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import App from "../../App.tsx";
import { RideScreen } from "../../src/ui/RideScreen.tsx";
import { dirs, File, files, resetFiles } from "./filesystem.mock.ts";
import * as location from "./location.mock.ts";
import { resetMapMock } from "./maplibre.mock.tsx";
import { isAvailableAsync, shareAsync, state as sharing } from "./sharing.mock.ts";
import { Accelerometer, Gyroscope, resetSensors } from "./sensors.mock.ts";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { flush, seconds } from "./flush.ts";
import { at, endRide, revealButtons, skippableRoadbook } from "./helpers.ts";
import { parseGpx } from "../../src/core/gpx.ts";
import { rideToGpx, serializeMeta, type RideMeta, type TrackPoint } from "../../src/core/recording.ts";
import type { PreparedRoadbook } from "../../src/core/types.ts";
import { resetServerSetting, saveServer } from "../../src/ui/serverSetting.ts";
import { stored } from "./securestore.mock.ts";

const folder = "file:///document/rides/";
const gpxFiles = () => [...files.keys()].filter((k) => k.startsWith(folder) && k.endsWith(".gpx"));
const metaOf = (uri: string): RideMeta => JSON.parse(files.get(uri.replace(/\.gpx$/, ".json"))!);

let clock = Date.UTC(2026, 9, 19, 9, 0, 0);
beforeEach(async () => {
  stored.clear();
  await resetServerSetting();
  jest.useFakeTimers();
  resetMapMock();
  resetFiles();
  resetSensors();
  await AsyncStorage.clear();
  sharing.available = true;
  sharing.fail = false;
  shareAsync.mockClear();
  location.state.permission = "granted";
  location.state.watcher = null;
  clock = Date.UTC(2026, 9, 19, 9, 0, 0);
});
afterEach(() => jest.useRealTimers());

const startGps = async (rb: PreparedRoadbook, onRideSaved = jest.fn()) => {
  const here = at(rb, 100);
  location.state.position = { latitude: here[0], longitude: here[1] };
  await render(<RideScreen rb={rb} onBack={() => {}} onRideSaved={onRideSaved} />);
  await fireEvent.press(screen.getByText("Start"));
  await flush();
  return onRideSaved;
};
/** Ride from `fromM` to `toM`, a fix every 100 m at 54 km/h. */
const rideTo = async (rb: PreparedRoadbook, fromM: number, toM: number) => {
  for (let m = fromM; m <= toM; m += 100) {
    const p = at(rb, m);
    await act(async () => location.pushFix(p[0], p[1], 15, (clock += 6000), 90));
  }
};

test("a ride ended early is saved as it is: a GPX of what was ridden, marked stopped, and the rider is told", async () => {
  const rb = skippableRoadbook();
  const saved = await startGps(rb);
  await rideTo(rb, 100, 1500);
  await endRide();
  await flush();
  expect(gpxFiles()).toHaveLength(1);
  const uri = gpxFiles()[0]!;
  const gpx = files.get(uri)!;
  const track = parseGpx(gpx);
  expect(track.line.length).toBe(15);
  expect(gpx).toContain(`name="${rb.roadbook.name}"`);
  expect(gpx).toContain('state="stopped"');
  const meta = metaOf(uri);
  expect(meta.state).toBe("stopped");
  expect(meta.roadbookId).toBe(rb.roadbook.id);
  expect(meta.distanceM).toBeGreaterThan(1300);
  expect(saved).toHaveBeenCalledTimes(1);
  expect(saved.mock.calls[0]![0].id).toBe(meta.id);
});

test("a ride that reaches the end is saved as completed", async () => {
  const rb = skippableRoadbook();
  await startGps(rb);
  await rideTo(rb, 100, rb.totalM - 150);
  const end = at(rb, rb.totalM);
  await act(async () => location.pushFix(end[0], end[1], 0, (clock += 6000), 90));
  await endRide();
  await flush();
  expect(metaOf(gpxFiles()[0]!).state).toBe("completed");
});

test("a pause does not end the ride: one track, with the pause in it", async () => {
  const rb = skippableRoadbook();
  await startGps(rb);
  await rideTo(rb, 100, 800);
  await revealButtons();
  await fireEvent.press(screen.getByText("Pause"));
  await flush();
  expect(gpxFiles()).toHaveLength(0);
  await revealButtons();
  await fireEvent.press(screen.getByLabelText("Resume the ride"));
  await flush();
  await rideTo(rb, 900, 1500);
  await endRide();
  await flush();
  expect(gpxFiles()).toHaveLength(1);
  expect(metaOf(gpxFiles()[0]!).points).toBe(15);
});

test("a demo and a scripted ride leave nothing behind", async () => {
  const rb = skippableRoadbook();
  await render(<RideScreen rb={rb} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Demo"));
  await seconds(30);
  await endRide();
  await flush();
  expect(gpxFiles()).toHaveLength(0);
});

test("a ride of a few metres, or none, is not kept", async () => {
  const rb = skippableRoadbook();
  const saved = await startGps(rb);
  const p = at(rb, 100);
  await act(async () => location.pushFix(p[0], p[1], 0, (clock += 6000), 90));
  await endRide();
  await flush();
  expect(gpxFiles()).toHaveLength(0);
  expect(saved).not.toHaveBeenCalled();
});

test("leaving the ride screen in the middle of a ride saves it too", async () => {
  const rb = skippableRoadbook();
  const saved = await startGps(rb);
  await rideTo(rb, 100, 1000);
  await screen.unmount();
  await flush();
  expect(gpxFiles()).toHaveLength(1);
  expect(saved).toHaveBeenCalledTimes(1);
});

test("poor fixes are left out of the track", async () => {
  const rb = skippableRoadbook();
  await startGps(rb);
  await rideTo(rb, 100, 600);
  const p = at(rb, 700);
  await act(async () => {
    // A fix with an accuracy of 120 m.
    location.state.watcher?.({
      coords: { latitude: p[0], longitude: p[1], speed: 15, accuracy: 120, heading: 90 },
      timestamp: (clock += 6000),
    });
  });
  await rideTo(rb, 800, 1000);
  await endRide();
  await flush();
  expect(metaOf(gpxFiles()[0]!).points).toBe(9);
});

test("while it runs the ride is written to the phone about once a minute", async () => {
  const rb = skippableRoadbook();
  await startGps(rb);
  await rideTo(rb, 100, 1500);
  const checkpoint = files.get(`${folder}in-progress.json`);
  expect(checkpoint).toBeDefined();
  const saved = JSON.parse(checkpoint!);
  expect(saved.roadbookId).toBe(rb.roadbook.id);
  expect(saved.points.length).toBeGreaterThan(5);
  await endRide();
  await flush();
  expect(files.has(`${folder}in-progress.json`)).toBe(false);
});

test("a ride the app was closed during is saved as recovered at the next launch, and the rider is told", async () => {
  const points = Array.from({ length: 12 }, (_, i) => ({
    lat: 50.45,
    lon: 3.2 + i * 0.001,
    time: clock + i * 6000,
    speedMps: 14,
  }));
  files.set(
    `${folder}in-progress.json`,
    JSON.stringify({
      v: 1,
      roadbookId: "loop",
      roadbookName: "Cut short loop",
      startedAt: clock,
      completed: false,
      points,
    }),
  );
  await render(<App />);
  await flush();
  expect(
    screen.getByText(/^A ride that was cut short was recovered: .*\. Find it under My rides in the menu\.$/),
  ).toBeTruthy();
  expect(gpxFiles()).toHaveLength(1);
  expect(metaOf(gpxFiles()[0]!).state).toBe("recovered");
  expect(files.has(`${folder}in-progress.json`)).toBe(false);
});

test("My rides lists the rides newest first with their state, shares the GPX and deletes after a question", async () => {
  const mk = (id: string, name: string, at: number, state: RideMeta["state"]): RideMeta => ({
    id,
    roadbookId: id,
    roadbookName: name,
    startedAt: at,
    endedAt: at + 3_600_000,
    distanceM: 54_321,
    points: 100,
    state,
  });
  const old = mk("2026-10-01T08-00-00-old", "Old loop", Date.UTC(2026, 9, 1, 8), "completed");
  const recent = mk("2026-10-18T08-00-00-new", "New loop", Date.UTC(2026, 9, 18, 8), "stopped");
  for (const m of [old, recent]) {
    files.set(`${folder}${m.id}.gpx`, "<gpx/>");
    files.set(`${folder}${m.id}.json`, serializeMeta(m));
  }
  files.set(`${folder}2026-10-02T08-00-00-broken.json`, "{nope");
  dirs.add("file:///document/rides");
  await render(<App />);
  await flush();
  await fireEvent.press(screen.getByLabelText("Open the menu"));
  await fireEvent.press(screen.getByLabelText("My rides"));
  await flush(25);
  const names = screen.getAllByText(/ loop$/).map((n) => n.props.children);
  expect(names).toEqual(["New loop", "Old loop"]);
  expect(screen.getByText("Stopped early")).toBeTruthy();
  expect(screen.getByText("Completed")).toBeTruthy();
  expect(screen.getAllByText(/54\.3 km · 1 h 00$/)).toHaveLength(2);

  await fireEvent.press(screen.getByLabelText("Share the ride of New loop"));
  await flush();
  expect(shareAsync).toHaveBeenCalledWith(
    `${folder}${recent.id}.gpx`,
    expect.objectContaining({ mimeType: "application/gpx+xml" }),
  );

  await fireEvent.press(screen.getByLabelText("Delete Old loop ride?"));
  // Never sent to a server: the question says it is a loss.
  expect(screen.getByText("This ride is only on this phone. If you delete it, it is lost for good.")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Keep it"));
  expect(screen.getByText("Old loop")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Delete Old loop ride?"));
  await fireEvent.press(screen.getByLabelText("Delete the ride of Old loop"));
  await flush();
  expect(screen.queryByText("Old loop")).toBeNull();
  expect(files.has(`${folder}${old.id}.gpx`)).toBe(false);
  expect(files.has(`${folder}${old.id}.json`)).toBe(false);
});

test("sharing that is not possible, or that fails, is said", async () => {
  const m: RideMeta = {
    id: "r",
    roadbookId: "r",
    roadbookName: "Odd loop",
    startedAt: 1,
    endedAt: 2,
    distanceM: 1000,
    points: 2,
    state: "completed",
  };
  files.set(`${folder}r.gpx`, "<gpx/>");
  files.set(`${folder}r.json`, serializeMeta(m));
  dirs.add("file:///document/rides");
  await render(<App />);
  await flush();
  await fireEvent.press(screen.getByLabelText("Open the menu"));
  await fireEvent.press(screen.getByLabelText("My rides"));
  await flush(25);
  sharing.available = false;
  await fireEvent.press(screen.getByLabelText("Share the ride of Odd loop"));
  await flush();
  expect(screen.getByText("This phone cannot share files from the app.")).toBeTruthy();
  sharing.available = true;
  sharing.fail = true;
  await fireEvent.press(screen.getByLabelText("Share the ride of Odd loop"));
  await flush();
  expect(screen.getByText("The file could not be shared.")).toBeTruthy();
  expect(isAvailableAsync).toHaveBeenCalled();
});

test("with no ride the list says where they come from", async () => {
  await render(<App />);
  await flush();
  await fireEvent.press(screen.getByLabelText("Open the menu"));
  await fireEvent.press(screen.getByLabelText("My rides"));
  await flush(25);
  expect(screen.getByText("The rides you make with the GPS are saved here, finished or not.")).toBeTruthy();
});

test("the altitudes of the fixes go into the GPX and the climb into the list of rides", async () => {
  const rb = skippableRoadbook();
  await startGps(rb);
  // 100 m on, 3 m higher, at 54 km/h
  for (let m = 100, i = 0; m <= 1500; m += 100, i++) {
    const p = at(rb, m);
    await act(async () => location.pushFix(p[0], p[1], 15, (clock += 6000), 90, 200 + i * 3));
  }
  await endRide();
  await flush();
  const uri = gpxFiles()[0]!;
  const gpx = files.get(uri)!;
  expect(gpx).toContain("<ele>200.0</ele>");
  expect(gpx).toContain("<ele>239.0</ele>");
  expect(gpx).not.toContain("motoride:lean");
  const meta = metaOf(uri);
  expect(meta.climbM).toBeGreaterThan(25);
  expect(meta.peakLeftDeg).toBeUndefined();
});

test("a ride made with lean on keeps the lean, the G and the peaks with each point, and the list says the peaks", async () => {
  await AsyncStorage.setItem(
    "instruments",
    JSON.stringify({ on: true, widgets: { compass: true, altitude: true, slope: true, lean: true, braking: true } }),
  );
  await AsyncStorage.setItem(
    "instruments-calibration",
    JSON.stringify({
      up: { x: 0, y: 1, z: 0 },
      forward: { x: 0, y: 0, z: -1 },
      right: { x: 1, y: 0, z: 0 },
      at: Date.UTC(2026, 9, 21, 10, 0),
    }),
  );
  const rb = skippableRoadbook();
  await startGps(rb);
  // a left corner at 54 km/h with a turning rate of 0.31 rad/s, then upright
  for (let m = 100, i = 0; m <= 1500; m += 100, i++) {
    for (let k = 0; k < 40; k++) {
      Gyroscope.emit({ x: 0, y: i < 8 ? 0.2 : 0, z: 0 });
      Accelerometer.emit({ x: 0, y: 1, z: 0 });
    }
    const p = at(rb, m);
    await act(async () => location.pushFix(p[0], p[1], 15, (clock += 6000), 90, 300));
  }
  await endRide();
  await flush();
  const uri = gpxFiles()[0]!;
  const gpx = files.get(uri)!;
  expect(gpx).toMatch(/<motoride:lean>\d+\.\d<\/motoride:lean>/);
  expect(gpx).toMatch(/<motoride:latg>\d\.\d\d<\/motoride:latg>/);
  expect(gpx).toMatch(/<motoride:brakeg>-?\d\.\d\d<\/motoride:brakeg>/);
  expect(gpx).toMatch(/<motoride:turn>-?\d\.\d{3}<\/motoride:turn>/);
  const meta = metaOf(uri);
  // sin(lean) = 15 x 0.2 / 9.81: about 18 degrees to the left, none to the right
  expect(meta.peakLeftDeg).toBeGreaterThanOrEqual(15);
  expect(meta.peakLeftDeg).toBeLessThanOrEqual(19);
  expect(meta.peakRightDeg).toBe(0);
  expect(meta.climbM).toBe(0);
  await render(<App />);
  await flush();
});

test("My rides says the climb and the peak leans of a ride that has them", async () => {
  const m: RideMeta = {
    id: "2026-10-18T08-00-00-new",
    roadbookId: "new",
    roadbookName: "New loop",
    startedAt: Date.UTC(2026, 9, 18, 8),
    endedAt: Date.UTC(2026, 9, 18, 9),
    distanceM: 54_321,
    points: 100,
    state: "completed",
    climbM: 412,
    peakLeftDeg: 38,
    peakRightDeg: 41,
  };
  files.set(`${folder}${m.id}.gpx`, "<gpx/>");
  files.set(`${folder}${m.id}.json`, serializeMeta(m));
  dirs.add("file:///document/rides");
  await render(<App />);
  await flush();
  await fireEvent.press(screen.getByLabelText("Open the menu"));
  await fireEvent.press(screen.getByLabelText("My rides"));
  await flush(25);
  expect(screen.getByText("Climb 412 m · Lean 38° L · 41° R")).toBeTruthy();
});

test("pulling My rides down reads the rides again", async () => {
  dirs.add("file:///document/rides");
  await render(<App />);
  await flush();
  await fireEvent.press(screen.getByLabelText("Open the menu"));
  await fireEvent.press(screen.getByLabelText("My rides"));
  await flush(25);
  expect(screen.queryByText("Late loop")).toBeNull();

  const late: RideMeta = {
    id: "2026-10-18T08-00-00-late",
    roadbookId: "late",
    roadbookName: "Late loop",
    startedAt: Date.UTC(2026, 9, 18, 8),
    endedAt: Date.UTC(2026, 9, 18, 9),
    distanceM: 10_000,
    points: 10,
    state: "completed",
  };
  files.set(`${folder}${late.id}.gpx`, "<gpx/>");
  files.set(`${folder}${late.id}.json`, serializeMeta(late));
  await act(async () => screen.getByTestId("rides-list").props.refreshControl.props.onRefresh());
  await flush(25);
  expect(screen.getByText("Late loop")).toBeTruthy();
  expect(screen.getByTestId("rides-list").props.refreshControl.props.refreshing).toBe(false);
});

test("a ride whose save fails is not lost: its checkpoint is kept, and it is saved as recovered at the next launch", async () => {
  const rb = skippableRoadbook();
  await startGps(rb);
  await rideTo(rb, 100, 1500);
  expect(files.has(`${folder}in-progress.json`)).toBe(true);

  // The phone cannot write the track (disk full, a write cut): the ride must survive.
  const write = jest.spyOn(File.prototype, "write").mockImplementation(async function (this: File, text: string) {
    if (this.uri.endsWith(".gpx")) throw new Error("No space left on device");
    files.set(this.uri, text);
  });
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  await endRide();
  await flush();
  expect(gpxFiles()).toHaveLength(0);
  const kept = [...files.keys()].filter((k) => k.startsWith(folder) && /(in-progress|unsaved-.*)\.json$/.test(k));
  expect(kept).toHaveLength(1);
  expect(JSON.parse(files.get(kept[0]!)!).points.length).toBeGreaterThan(5);
  write.mockRestore();
  warn.mockRestore();

  // The next launch saves it.
  await screen.unmount();
  await render(<App />);
  await flush();
  expect(gpxFiles()).toHaveLength(1);
  expect(metaOf(gpxFiles()[0]!).state).toBe("recovered");
  expect([...files.keys()].some((k) => /(in-progress|unsaved-.*)\.json$/.test(k))).toBe(false);
});

test("a ride that was saved is no longer a checkpoint, and one too short to keep leaves nothing either", async () => {
  const rb = skippableRoadbook();
  await startGps(rb);
  await rideTo(rb, 100, 1500);
  await endRide();
  await flush();
  expect(gpxFiles()).toHaveLength(1);
  expect([...files.keys()].some((k) => /(in-progress|unsaved-.*)\.json$/.test(k))).toBe(false);
});

test("a track whose summary is missing is still listed, with its summary rebuilt from the GPX, and can be shared", async () => {
  const rb = skippableRoadbook();
  await startGps(rb);
  await rideTo(rb, 100, 1500);
  await endRide();
  await flush();
  await screen.unmount();
  const [gpxUri] = gpxFiles();
  const gpx = files.get(gpxUri!)!;
  const original = metaOf(gpxUri!);
  // The save was cut between the two files: the track is there, its summary is not.
  files.delete(gpxUri!.replace(/\.gpx$/, ".json"));

  await render(<App />);
  await flush();
  await fireEvent.press(screen.getByLabelText("Open the menu"));
  await fireEvent.press(screen.getByLabelText("My rides"));
  await flush(25);
  expect(screen.getByText(rb.roadbook.name)).toBeTruthy();
  expect(screen.getByText(original.state === "completed" ? "Completed" : "Stopped early")).toBeTruthy();
  // The track itself was not touched; the summary was written back for next time.
  expect(files.get(gpxUri!)).toBe(gpx);
  expect(files.has(gpxUri!.replace(/\.gpx$/, ".json"))).toBe(true);
  await fireEvent.press(screen.getByLabelText(`Share the ride of ${rb.roadbook.name}`));
  await flush();
  expect(shareAsync).toHaveBeenCalledWith(gpxUri, expect.objectContaining({ mimeType: "application/gpx+xml" }));
});

// Spec ride-recording, "Send it to the rider's server".
const SERVER = { url: "https://rides.example.org", token: "mrt_" + "A".repeat(43) };
const fetchMock = globalThis.fetch as unknown as jest.Mock;
const withServer = async () => saveServer(SERVER);
const calls = (method: string) => fetchMock.mock.calls.filter(([, init]) => init?.method === method);
/** The server takes a ride (201), or answers `status`. */
const serverTakes = (status = 201) =>
  fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
    if (init?.method === "PUT" && String(url).startsWith(SERVER.url))
      return {
        ok: status < 300,
        status,
        json: async () => ({
          id: decodeURIComponent(String(url).split("/rides/")[1]!),
          status: "created",
          roadbook: null,
        }),
      };
    return { ok: true };
  });
/** A ride the app was closed during: found at the launch and saved as recovered, with the notice. */
const leaveCheckpoint = (name = "Cut short loop") =>
  files.set(
    `${folder}in-progress.json`,
    JSON.stringify({
      v: 1,
      roadbookId: "loop",
      roadbookName: name,
      startedAt: clock,
      completed: false,
      points: Array.from({ length: 12 }, (_, i) => ({
        lat: 50.45,
        lon: 3.2 + i * 0.001,
        time: clock + i * 6000,
        speedMps: 14,
      })),
    }),
  );

test("with a server the notice of a saved ride offers to send it, and the ride is then marked as on the server", async () => {
  await withServer();
  serverTakes();
  leaveCheckpoint();
  await render(<App />);
  await flush();
  await fireEvent.press(screen.getByLabelText("Upload to server"));
  await flush();
  const [put] = calls("PUT");
  const [gpxUri] = gpxFiles();
  const meta = metaOf(gpxUri!);
  expect(calls("PUT")).toHaveLength(1);
  expect(put![0]).toBe(`${SERVER.url}/rides/${encodeURIComponent(meta.id)}`);
  // The file as it is kept, with the rider's token.
  expect(put![1].body).toBe(files.get(gpxUri!));
  expect(put![1].headers.Authorization).toBe(`Bearer ${SERVER.token}`);
  expect(screen.getByText("Ride uploaded to your server.")).toBeTruthy();
  expect(meta.serverRideId).toBe(meta.id);
  expect(typeof meta.uploadedAt).toBe("number");
});

test("without a server nothing is offered, and a server that refuses leaves the ride on the phone only", async () => {
  leaveCheckpoint();
  await render(<App />);
  await flush();
  expect(screen.getByText(/^A ride that was cut short was recovered/)).toBeTruthy();
  expect(screen.queryByLabelText("Upload to server")).toBeNull();
  expect(calls("PUT")).toHaveLength(0);
  await screen.unmount();

  await withServer();
  serverTakes(503);
  resetFiles();
  leaveCheckpoint("Another loop");
  await render(<App />);
  await flush();
  await fireEvent.press(screen.getByLabelText("Upload to server"));
  await flush();
  expect(
    screen.getByText("Your server did not take the ride. It is still on this phone: try again later."),
  ).toBeTruthy();
  const meta = metaOf(gpxFiles()[0]!);
  expect(meta.uploadedAt).toBeUndefined();
  expect(meta.serverRideId).toBeUndefined();
});

const openRides = async () => {
  await render(<App />);
  await flush();
  await fireEvent.press(screen.getByLabelText("Open the menu"));
  await fireEvent.press(screen.getByLabelText("My rides"));
  await flush(25);
};

test("My rides says which rides are only on the phone, sends one on request, and marks it", async () => {
  await withServer();
  serverTakes();
  const saved = (name: string, at: number): RideMeta => {
    const meta: RideMeta = {
      id: `2026-10-0${at}T08-00-00-${name.toLowerCase()}`,
      roadbookId: name,
      roadbookName: name,
      startedAt: Date.UTC(2026, 9, at, 8),
      endedAt: Date.UTC(2026, 9, at, 9),
      distanceM: 54_321,
      points: 100,
      state: "completed",
    };
    files.set(`${folder}${meta.id}.gpx`, "<gpx/>");
    files.set(`${folder}${meta.id}.json`, serializeMeta(meta));
    return meta;
  };
  const old = saved("Old", 1);
  saved("New", 2);
  files.set(
    `${folder}${old.id}.json`,
    serializeMeta({ ...old, uploadedAt: Date.UTC(2026, 9, 3, 12), serverRideId: old.id }),
  );
  dirs.add("file:///document/rides");
  await openRides();
  expect(screen.getAllByText("Only on this phone")).toHaveLength(1);
  expect(screen.getByText(/^On your server, sent /)).toBeTruthy();
  // One send action, for the ride that is not there yet.
  expect(screen.getAllByLabelText(/^Upload the ride of /)).toHaveLength(1);
  await fireEvent.press(screen.getByLabelText("Upload the ride of New to your server"));
  await flush(25);
  expect(calls("PUT")).toHaveLength(1);
  expect(screen.queryByText("Only on this phone")).toBeNull();
  expect(screen.queryByLabelText(/^Upload the ride of /)).toBeNull();
  expect(metaOf(`${folder}2026-10-02T08-00-00-new.gpx`).uploadedAt).toBeGreaterThan(0);
});

test("deleting a ride that was never sent is warned as a loss, one that was sent says it stays, and neither calls the server", async () => {
  await withServer();
  serverTakes();
  const mk = (name: string, at: number, extra: Partial<RideMeta> = {}) => {
    const meta: RideMeta = {
      id: `2026-10-0${at}T08-00-00-${name.toLowerCase()}`,
      roadbookId: name,
      roadbookName: name,
      startedAt: Date.UTC(2026, 9, at, 8),
      endedAt: Date.UTC(2026, 9, at, 9),
      distanceM: 54_321,
      points: 100,
      state: "completed",
      ...extra,
    };
    files.set(`${folder}${meta.id}.gpx`, "<gpx/>");
    files.set(`${folder}${meta.id}.json`, serializeMeta(meta));
  };
  mk("Sent", 1, { uploadedAt: Date.UTC(2026, 9, 3), serverRideId: "x" });
  mk("Alone", 2);
  dirs.add("file:///document/rides");
  await openRides();
  await fireEvent.press(screen.getByLabelText("Delete Alone ride?"));
  expect(screen.getByText("This ride is only on this phone. If you delete it, it is lost for good.")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Keep it"));
  await fireEvent.press(screen.getByLabelText("Delete Sent ride?"));
  expect(screen.getByText("Delete it from this phone? It stays on your server.")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Delete the ride of Sent"));
  await flush();
  expect([...files.keys()].some((k) => k.includes("-sent."))).toBe(false);
  expect([...files.keys()].some((k) => k.includes("-alone."))).toBe(true);
  // Deleting on the phone never touches the server.
  expect(calls("DELETE")).toHaveLength(0);
  expect(calls("PUT")).toHaveLength(0);
});

test("without a server a ride is still warned as a loss when deleted, and no upload is offered", async () => {
  const meta: RideMeta = {
    id: "2026-10-02T08-00-00-solo",
    roadbookId: "Solo",
    roadbookName: "Solo",
    startedAt: Date.UTC(2026, 9, 2, 8),
    endedAt: Date.UTC(2026, 9, 2, 9),
    distanceM: 54_321,
    points: 100,
    state: "completed",
  };
  files.set(`${folder}${meta.id}.gpx`, "<gpx/>");
  files.set(`${folder}${meta.id}.json`, serializeMeta(meta));
  dirs.add("file:///document/rides");
  await openRides();
  expect(screen.queryByLabelText(/^Upload the ride of /)).toBeNull();
  expect(screen.queryByText("Only on this phone")).toBeNull();
  await fireEvent.press(screen.getByLabelText("Delete Solo ride?"));
  expect(screen.getByText(/lost for good/)).toBeTruthy();
});

test("the actions of a ride are icons with a name for a screen reader, the delete alone at the end, and no word on them", async () => {
  await withServer();
  serverTakes();
  const mk = (name: string, day: number, extra: Partial<RideMeta> = {}) => {
    const meta: RideMeta = {
      id: `2026-10-0${day}T08-00-00-${name.toLowerCase()}`,
      roadbookId: name,
      roadbookName: name,
      startedAt: Date.UTC(2026, 9, day, 8),
      endedAt: Date.UTC(2026, 9, day, 9),
      distanceM: 54_321,
      points: 100,
      state: "completed",
      ...extra,
    };
    files.set(`${folder}${meta.id}.gpx`, "<gpx/>");
    files.set(`${folder}${meta.id}.json`, serializeMeta(meta));
  };
  mk("Sent", 1, { uploadedAt: Date.UTC(2026, 9, 3), serverRideId: "x" });
  mk("Alone", 2);
  dirs.add("file:///document/rides");
  await openRides();
  // No text links any more.
  for (const word of ["Review", "Upload to server", "Share", "Delete…", "Uploading…"])
    expect(screen.queryByText(word)).toBeNull();
  // A ride on the phone only: review, upload, share, then delete.
  const names = (id: string) =>
    screen
      .getAllByRole("button")
      .map((b) => b.props.accessibilityLabel as string)
      .filter((l) => l?.includes(id));
  expect(names("Alone")).toEqual([
    "Review Alone",
    "Upload the ride of Alone to your server",
    "Share the ride of Alone",
    "Delete Alone ride?",
  ]);
  // A ride already sent: its slot is a status, not a button, and it is still there so the others do not move.
  expect(screen.queryByLabelText("Upload the ride of Sent to your server")).toBeNull();
  expect(screen.getByLabelText(/^On your server, sent /)).toBeTruthy();
  // On the server too: the server copy can be removed on its own, apart from the delete of the phone's.
  expect(names("Sent")).toEqual([
    "Review Sent",
    "Share the ride of Sent",
    "Remove Sent ride from your server?",
    "Delete Sent ride?",
  ]);
  // While one is sent the others cannot be pressed, and the one sending shows it.
  const send = screen.getByLabelText("Upload the ride of Alone to your server");
  expect(send.props.accessibilityState).toMatchObject({ disabled: false });
});

// Spec ride-recording, "The rides of the server": the phone's rides and the server's, once each.
const track = (t0: number): TrackPoint[] =>
  Array.from({ length: 30 }, (_, i) => ({
    lat: 50.45 + i * 0.0004,
    lon: 3.2 + i * 0.0006,
    time: t0 + i * 6000,
    speedMps: 14,
  }));
const rideOf = (name: string, day: number, extra: Partial<RideMeta> = {}): RideMeta => ({
  id: `2026-10-${String(day).padStart(2, "0")}T08-00-00-${name.toLowerCase()}`,
  roadbookId: name,
  roadbookName: name,
  startedAt: Date.UTC(2026, 9, day, 8),
  endedAt: Date.UTC(2026, 9, day, 8) + 29 * 6000,
  distanceM: 5000,
  points: 30,
  state: "completed",
  ...extra,
});
const onPhone = (m: RideMeta) => {
  files.set(`${folder}${m.id}.gpx`, rideToGpx(m, track(m.startedAt)));
  files.set(`${folder}${m.id}.json`, serializeMeta(m));
  dirs.add("file:///document/rides");
};
const wireOf = (m: RideMeta, extra: Record<string, unknown> = {}) => ({
  id: m.id,
  name: m.roadbookName,
  startedAt: new Date(m.startedAt).toISOString(),
  endedAt: new Date(m.endedAt).toISOString(),
  distanceKm: m.distanceM / 1000,
  points: m.points,
  roadbook: null,
  bytes: 1000,
  uploadedAt: "2026-10-31T10:00:00.000Z",
  state: "completed",
  ...extra,
});
/** The server keeps `held` (rides, by id); the GPX it gives back is the ride's own. */
const serverKeeps = (held: RideMeta[]) =>
  fetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
    const u = String(url);
    if (!u.startsWith(SERVER.url)) return { ok: true };
    if (u === `${SERVER.url}/rides` && !init?.method)
      return { ok: true, status: 200, json: async () => ({ rides: held.map((m) => wireOf(m)) }) };
    const m = /\/rides\/([^/]+)$/.exec(u);
    const ride = held.find((h) => h.id === decodeURIComponent(m?.[1] ?? ""));
    if (m && init?.method === "DELETE") return { ok: true, status: 200, json: async () => ({}) };
    if (m && ride) return { ok: true, status: 200, text: async () => rideToGpx(ride, track(ride.startedAt)) };
    return { ok: false, status: 404 };
  });

test("the rides of the server are listed with those of the phone, a ride that is in both places once", async () => {
  await withServer();
  const both = rideOf("Both", 3);
  const phone = rideOf("Phone", 2);
  const server = rideOf("Server", 4);
  onPhone(both);
  onPhone(phone);
  serverKeeps([both, server]);
  await openRides();
  expect(screen.getAllByText("Both")).toHaveLength(1);
  expect(screen.getAllByText("Phone")).toHaveLength(1);
  expect(screen.getAllByText("Server")).toHaveLength(1);
  expect(screen.getByText("Only on your server")).toBeTruthy();
  expect(screen.getByText("Only on this phone")).toBeTruthy();
  expect(screen.getByText(/^On your server, sent /)).toBeTruthy();
  // Newest first, whatever the place.
  expect(screen.getAllByText(/^(Both|Phone|Server)$/).map((n) => n.props.children)).toEqual([
    "Server",
    "Both",
    "Phone",
  ]);
});

test("a ride only on the server is kept on the phone by Save, as the file it holds, and is then on both without a new send", async () => {
  await withServer();
  const server = rideOf("Server", 4);
  serverKeeps([server]);
  await openRides();
  expect(gpxFiles()).toHaveLength(0);
  await fireEvent.press(screen.getByLabelText("Save the ride of Server to this phone"));
  await flush(25);
  const [gpxUri] = gpxFiles();
  expect(gpxUri).toBe(`${folder}${server.id}.gpx`);
  // The file as the server holds it, and a summary built from it that says it is on the server.
  expect(files.get(gpxUri!)).toBe(rideToGpx(server, track(server.startedAt)));
  const meta = metaOf(gpxUri!);
  expect(meta.roadbookName).toBe("Server");
  expect(meta.serverRideId).toBe(server.id);
  expect(meta.uploadedAt).toBe(Date.parse("2026-10-31T10:00:00.000Z"));
  // One row, now on both: nothing to save, a status, and nothing was sent.
  expect(screen.getAllByText("Server")).toHaveLength(1);
  expect(screen.queryByLabelText("Save the ride of Server to this phone")).toBeNull();
  expect(screen.getByText(/^On your server, sent /)).toBeTruthy();
  expect(calls("PUT")).toHaveLength(0);
});

test("reviewing a ride only on the server keeps it on the phone and opens its review", async () => {
  await withServer();
  const server = rideOf("Server", 4);
  serverKeeps([server]);
  await openRides();
  await fireEvent.press(screen.getByLabelText("Review Server"));
  await flush(25);
  expect(gpxFiles()).toEqual([`${folder}${server.id}.gpx`]);
  expect(screen.getByLabelText("Back to My rides")).toBeTruthy();
});

test("deleting on the phone never calls the server, and the ride the server still keeps shows again as only on the server", async () => {
  await withServer();
  const both = rideOf("Both", 3);
  onPhone(both);
  serverKeeps([both]);
  await openRides();
  await fireEvent.press(screen.getByLabelText("Delete Both ride?"));
  expect(screen.getByText("Delete it from this phone? It stays on your server.")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Delete the ride of Both"));
  await flush(25);
  expect(gpxFiles()).toHaveLength(0);
  expect(calls("DELETE")).toHaveLength(0);
  expect(screen.getAllByText("Both")).toHaveLength(1);
  expect(screen.getByText("Only on your server")).toBeTruthy();
});

test("removing a ride from the server is its own question and its own call, and leaves the phone's copy alone", async () => {
  await withServer();
  const both = rideOf("Both", 3);
  const alone = rideOf("Alone", 4);
  onPhone(both);
  serverKeeps([both, alone]);
  await openRides();
  // Both: it stays on the phone.
  await fireEvent.press(screen.getByLabelText("Remove Both ride from your server?"));
  expect(screen.getByText("Remove it from your server? It stays on this phone.")).toBeTruthy();
  serverKeeps([alone]);
  await fireEvent.press(screen.getByLabelText("Remove the ride of Both from your server"));
  await flush(25);
  expect(calls("DELETE").map(([u]) => u)).toEqual([`${SERVER.url}/rides/${encodeURIComponent(both.id)}`]);
  expect(gpxFiles()).toEqual([`${folder}${both.id}.gpx`]);
  expect(screen.getAllByText("Only on this phone")).toHaveLength(1);
  // Only on the server: the question says it is lost for good.
  await fireEvent.press(screen.getByLabelText("Remove Alone ride from your server?"));
  expect(screen.getByText("This ride is only on your server. If you remove it, it is lost for good.")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Keep it"));
  expect(calls("DELETE")).toHaveLength(1);
});

test("when the server answers, a ride the phone thinks was sent but it does not keep is on the phone only again", async () => {
  await withServer();
  const sent = rideOf("Sent", 3, { uploadedAt: Date.UTC(2026, 9, 31), serverRideId: "x" });
  onPhone(sent);
  serverKeeps([]);
  await openRides();
  expect(screen.getByText("Only on this phone")).toBeTruthy();
  expect(screen.getByLabelText("Upload the ride of Sent to your server")).toBeTruthy();
});

test("with no server, or one that cannot be reached, the list is the phone's rides, with no error", async () => {
  const mine = rideOf("Mine", 3);
  onPhone(mine);
  await openRides();
  expect(screen.getAllByText("Mine")).toHaveLength(1);
  expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith("/rides"))).toBe(false);
  await screen.unmount();

  await withServer();
  fetchMock.mockImplementation(async () => {
    throw new TypeError("Network request failed");
  });
  await openRides();
  expect(screen.getAllByText("Mine")).toHaveLength(1);
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByText(/could not be reached/)).toBeNull();
});

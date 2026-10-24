import { act, fireEvent, render, screen } from "@testing-library/react-native";
import App from "../../App.tsx";
import { RideScreen } from "../../src/ui/RideScreen.tsx";
import { dirs, files, resetFiles } from "./filesystem.mock.ts";
import * as location from "./location.mock.ts";
import { resetMapMock } from "./maplibre.mock.tsx";
import { isAvailableAsync, shareAsync, state as sharing } from "./sharing.mock.ts";
import { Accelerometer, Gyroscope, resetSensors } from "./sensors.mock.ts";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { flush, seconds } from "./flush.ts";
import { at, endRide, revealButtons, skippableRoadbook } from "./helpers.ts";
import { parseGpx } from "../../src/core/gpx.ts";
import { serializeMeta, type RideMeta } from "../../src/core/recording.ts";
import type { PreparedRoadbook } from "../../src/core/types.ts";

const folder = "file:///document/rides/";
const gpxFiles = () => [...files.keys()].filter((k) => k.startsWith(folder) && k.endsWith(".gpx"));
const metaOf = (uri: string): RideMeta => JSON.parse(files.get(uri.replace(/\.gpx$/, ".json"))!);

let clock = Date.UTC(2026, 9, 19, 9, 0, 0);
beforeEach(async () => {
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
  expect(screen.getByText("Delete this ride?")).toBeTruthy();
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

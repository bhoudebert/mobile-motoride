import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import App from "../../App.tsx";
import { setLanguage } from "../../src/core/i18n/index.ts";
import { rideToGpx, serializeMeta, type RideMeta, type TrackPoint } from "../../src/core/recording.ts";
import { dirs, files, resetFiles } from "./filesystem.mock.ts";
import { flush } from "./flush.ts";
import { layers, resetMapMock, sources } from "./maplibre.mock.tsx";

// Spec ride-review: a recorded ride, read back from its GPX, shown on a map with its figures and a replay.
const folder = "file:///document/rides/";
const T0 = Date.UTC(2026, 9, 20, 9, 0, 0);
const M_PER_DEG = 111_320 * Math.cos((50 * Math.PI) / 180);

/** 120 s riding east: 20 m/s for 60 s then 35 m/s; a left corner at 30 s (38°), a hard stop at 90 s (0.7 G). */
const track = (gauges: boolean): TrackPoint[] => {
  let x = 0;
  return Array.from({ length: 120 }, (_, i): TrackPoint => {
    const v = i < 60 ? 20 : 35;
    x += v;
    return {
      lat: 50,
      lon: 3 + x / M_PER_DEG,
      time: T0 + i * 1000,
      speedMps: v,
      altitudeM: 100 + (i < 60 ? i : 120 - i) * 0.5,
      ...(gauges ? { leanDeg: i === 30 ? 38 : i === 100 ? -20 : 0, lateralG: 0.2, brakingG: i === 90 ? 0.7 : 0 } : {}),
    };
  });
};

const meta = (id: string, points: TrackPoint[]): RideMeta => ({
  id,
  roadbookId: "rb",
  roadbookName: "Test loop",
  startedAt: points[0]!.time,
  endedAt: points[points.length - 1]!.time,
  distanceM: 3000,
  points: points.length,
  state: "completed",
});

const put = (id: string, points: TrackPoint[], gpx?: string) => {
  const m = meta(id, points);
  files.set(`${folder}${id}.gpx`, gpx ?? rideToGpx(m, points));
  files.set(`${folder}${id}.json`, serializeMeta(m));
  dirs.add("file:///document/rides");
};

const openReview = async () => {
  await render(<App />);
  await flush();
  await fireEvent.press(screen.getByLabelText("Open the menu"));
  await fireEvent.press(screen.getByLabelText("My rides"));
  await flush(25);
  await fireEvent.press(screen.getByLabelText("Review Test loop"));
  await flush(25);
};

beforeEach(async () => {
  jest.useFakeTimers();
  resetMapMock();
  resetFiles();
  await AsyncStorage.clear();
  setLanguage("en");
});
afterEach(() => {
  setLanguage("en");
  jest.useRealTimers();
});

test("Review opens the ride with its figures, its speed colours and its marks, and Back returns to My rides", async () => {
  put("a", track(true));
  await openReview();
  expect(screen.getByText("Test loop")).toBeTruthy();
  expect(screen.getByLabelText("Distance: 3.3 km")).toBeTruthy();
  expect(screen.getByLabelText(/^Duration: 2 min$/)).toBeTruthy();
  expect(screen.getByLabelText("Top speed: 126 km/h")).toBeTruthy();
  expect(screen.getByLabelText(/^Climb: 28 m$/)).toBeTruthy();
  expect(screen.getByLabelText("Peak lean: 38° L · 20° R")).toBeTruthy();
  expect(screen.getByLabelText("Hardest braking: 0.70 G")).toBeTruthy();
  // 20 m/s is 72 km/h (class 2), 35 m/s is 126 km/h (class 3): two runs on the map.
  const speeds = (sources["trace"] as any).features.map((f: any) => f.properties.speed);
  expect(speeds).toEqual([2, 3]);
  expect(layers["trace"]).toBeTruthy();
  expect((sources["marks"] as any).features).toHaveLength(2);
  expect(screen.getByLabelText("Peak lean 38° L. Jump the replay there")).toBeTruthy();
  expect(screen.getByLabelText("Hardest braking 0.70 G. Jump the replay there")).toBeTruthy();
  expect(screen.getByText("Speed, km/h")).toBeTruthy();

  await fireEvent.press(screen.getByLabelText("Back to My rides"));
  expect(screen.getByText("My rides")).toBeTruthy();
});

test("a ride recorded without the gauges shows no lean and no G, and no marks", async () => {
  put("b", track(false));
  await openReview();
  expect(screen.getByLabelText("Top speed: 126 km/h")).toBeTruthy();
  expect(screen.queryByLabelText(/^Peak lean/)).toBeNull();
  expect(screen.queryByLabelText(/^Hardest braking/)).toBeNull();
  expect(screen.queryByLabelText(/^Lateral G/)).toBeNull();
  expect(sources["marks"]).toBeUndefined();
});

test("Play moves the marker along the track and ends on the last point, and Play again starts over", async () => {
  put("c", track(true));
  await openReview();
  const readout = () => screen.getByTestId("review-readout").props.children as string;
  expect(readout()).toMatch(/ · 72 km\/h · 100 m · Lean 0°$/);
  const startAt = (sources["cursor"] as any).geometry.coordinates[0];

  await fireEvent.press(screen.getByLabelText("Play"));
  expect(screen.getByLabelText("Pause")).toBeTruthy();
  await act(async () => {
    jest.advanceTimersByTime(1000); // x30: 30 s of the ride
  });
  expect((sources["cursor"] as any).geometry.coordinates[0]).toBeGreaterThan(startAt);
  expect(readout()).toMatch(/Lean 38° L/);

  await act(async () => {
    jest.advanceTimersByTime(10_000);
  });
  expect(screen.getByLabelText("Play")).toBeTruthy();
  expect(screen.getByLabelText("Position in the ride").props.accessibilityValue.now).toBe(100);

  await fireEvent.press(screen.getByLabelText("Play"));
  expect(screen.getByLabelText("Position in the ride").props.accessibilityValue.now).toBeLessThan(10);
  await fireEvent.press(screen.getByLabelText("Pause"));
  expect(screen.getByLabelText("Play")).toBeTruthy();
});

test("the replay speed goes ×30, ×100, ×300, ×10 and the bar jumps where it is touched", async () => {
  put("d", track(true));
  await openReview();
  await fireEvent.press(screen.getByLabelText("Replay speed ×30"));
  expect(screen.getByLabelText("Replay speed ×100")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Replay speed ×100"));
  await fireEvent.press(screen.getByLabelText("Replay speed ×300"));
  await fireEvent.press(screen.getByLabelText("Replay speed ×10"));
  expect(screen.getByLabelText("Replay speed ×30")).toBeTruthy();

  const bar = screen.getByTestId("review-seek");
  await fireEvent(bar, "layout", { nativeEvent: { layout: { width: 200 } } });
  await fireEvent(bar, "responderGrant", { nativeEvent: { locationX: 100 } });
  expect(screen.getByLabelText("Position in the ride").props.accessibilityValue.now).toBe(50);
  await fireEvent(bar, "responderMove", { nativeEvent: { locationX: 150 } });
  expect(screen.getByLabelText("Position in the ride").props.accessibilityValue.now).toBe(75);
  await fireEvent(bar, "accessibilityAction", { nativeEvent: { actionName: "decrement" } });
  expect(screen.getByLabelText("Position in the ride").props.accessibilityValue.now).toBe(70);
});

test("a mark jumps the replay to its point", async () => {
  put("e", track(true));
  await openReview();
  await fireEvent.press(screen.getByLabelText("Hardest braking 0.70 G. Jump the replay there"));
  expect(screen.getByTestId("review-readout").props.children).toMatch(/Braking 0\.70 G/);
});

test("a ride whose file is unreadable, or too short, says so", async () => {
  put("f", track(true), "not a gpx");
  await openReview();
  expect(screen.getByText("This ride has too few points to review.")).toBeTruthy();
});

test("a ride whose GPX is missing says it cannot be read", async () => {
  const points = track(true);
  put("g", points);
  files.delete(`${folder}g.gpx`);
  files.set(`${folder}g.gpx`, "x");
  files.delete(`${folder}g.gpx`);
  // listRides leaves a ride without a GPX out, so the screen is reached with the file gone after listing.
  await render(<App />);
  await flush();
  await fireEvent.press(screen.getByLabelText("Open the menu"));
  await fireEvent.press(screen.getByLabelText("My rides"));
  await flush(25);
  expect(screen.queryByLabelText("Review Test loop")).toBeNull();
});

test("the review is in French in French, with French figures", async () => {
  setLanguage("fr");
  put("h", track(true));
  await render(<App />);
  await flush();
  await fireEvent.press(screen.getByLabelText("Ouvrir le menu"));
  await fireEvent.press(screen.getByLabelText("Mes sorties"));
  await flush(25);
  await fireEvent.press(screen.getByLabelText("Revoir Test loop"));
  await flush(25);
  expect(screen.getByLabelText("Distance : 3,3 km")).toBeTruthy();
  expect(screen.getByLabelText("Vitesse maximale : 126 km/h")).toBeTruthy();
  expect(screen.getByLabelText("Inclinaison maximale : 38° G · 20° D")).toBeTruthy();
  expect(screen.getByLabelText("Freinage le plus fort : 0,70 G")).toBeTruthy();
  expect(screen.getByLabelText("Lecture")).toBeTruthy();
  expect(screen.getByLabelText("Retour à Mes sorties")).toBeTruthy();
});

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Vibration } from "react-native";
import * as Speech from "expo-speech";
import { RideScreen } from "../../src/ui/RideScreen.tsx";
import * as location from "./location.mock.ts";
import { resetMapMock, sources } from "./maplibre.mock.tsx";
import { flush, seconds } from "./flush.ts";
import { at, first, gpxRoadbook, limitedRoadbook } from "./helpers.ts";
import type { LatLon } from "../../src/core/types.ts";

let vibrate: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers();
  resetMapMock();
  location.state.permission = "granted";
  location.state.watcher = null;
  location.state.removed = 0;
  vibrate = jest.spyOn(Vibration, "vibrate").mockImplementation(() => {});
});
afterEach(() => {
  jest.useRealTimers();
  vibrate.mockRestore();
});

const start = async (rb = limitedRoadbook(), here?: LatLon) => {
  const p = here ?? at(rb, 100);
  location.state.position = { latitude: p[0], longitude: p[1] };
  await render(<RideScreen rb={rb} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Start"));
  await flush();
  return rb;
};
const push = (p: LatLon, kmh: number, time: number) => act(async () => location.pushFix(p[0], p[1], kmh / 3.6, time));
const sign = (label: RegExp | string) => screen.getByLabelText(label);

test("the sign is on screen before the ride, with an unknown limit", async () => {
  await render(<RideScreen rb={gpxRoadbook()} onBack={() => {}} />);
  expect(sign("Speed limit unknown")).toBeTruthy();
  expect(screen.getByText("?")).toBeTruthy();
});

test("a GPX roadbook has no limits: the sign says so during the ride and never says zero", async () => {
  const rb = gpxRoadbook();
  await start(rb, at(rb, 10_000));
  await push(at(rb, 10_000), 60, 1000);
  expect(sign("Speed limit unknown")).toBeTruthy();
  expect(screen.queryByText("0")).toBeNull();
  expect(vibrate).not.toHaveBeenCalled();
});

test("the limit of the road is on screen, with its next change", async () => {
  const rb = await start();
  await push(at(rb, 600), 40, 1000);
  expect(sign("Speed limit 50")).toBeTruthy();
  expect(screen.getByText("50")).toBeTruthy();
  expect(screen.getByText(/^then 80 · /)).toBeTruthy();
  expect(screen.queryByText("assumed")).toBeNull();
});

test("an assumed limit is marked as assumed", async () => {
  const rb = await start();
  await push(at(rb, 1400), 60, 1000);
  expect(sign("Speed limit 80, assumed")).toBeTruthy();
  expect(screen.getByText("assumed")).toBeTruthy();
});

test("going over turns the sign red, says so to a screen reader, and vibrates once", async () => {
  const rb = await start();
  await push(at(rb, 400), 49, 1000);
  expect(sign("Speed limit 50")).toBeTruthy();
  expect(vibrate).not.toHaveBeenCalled();
  await push(at(rb, 430), 56, 2000);
  expect(sign("Over the speed limit of 50")).toBeTruthy();
  expect(vibrate).toHaveBeenCalledTimes(1);
  await push(at(rb, 460), 58, 3000);
  expect(vibrate).toHaveBeenCalledTimes(1);
  await push(at(rb, 490), 51, 4000);
  expect(sign("Speed limit 50")).toBeTruthy();
});

test("it vibrates again only after ten seconds", async () => {
  const rb = await start();
  await push(at(rb, 400), 60, 1000);
  expect(vibrate).toHaveBeenCalledTimes(1);
  await push(at(rb, 420), 45, 2000);
  await push(at(rb, 440), 60, 3000);
  expect(vibrate).toHaveBeenCalledTimes(1);
  await push(at(rb, 460), 45, 12_000);
  await push(at(rb, 480), 60, 13_000);
  expect(vibrate).toHaveBeenCalledTimes(2);
});

test("nothing is spoken for the speed limit", async () => {
  const rb = await start();
  await push(at(rb, 400), 70, 1000);
  await push(at(rb, 430), 70, 2000);
  expect(Speech.speak).not.toHaveBeenCalled();
});

test("a fix without a speed never makes the sign red", async () => {
  const rb = await start();
  await act(async () =>
    location.state.watcher?.({
      coords: { latitude: at(rb, 400)[0], longitude: at(rb, 400)[1], speed: null, accuracy: 5 },
      timestamp: 1000,
    }),
  );
  expect(sign("Speed limit 50")).toBeTruthy();
  expect(vibrate).not.toHaveBeenCalled();
});

test("the limit follows the rider along the road", async () => {
  const rb = await start();
  await push(at(rb, 400), 40, 1000);
  expect(sign("Speed limit 50")).toBeTruthy();
  await push(at(rb, 1400), 40, 2000);
  expect(sign("Speed limit 80, assumed")).toBeTruthy();
  await push(at(rb, 2400), 40, 3000);
  expect(sign("Speed limit 90")).toBeTruthy();
});

test("the demo shows the limit and goes red when it rides faster than the road allows", async () => {
  await render(<RideScreen rb={limitedRoadbook()} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Demo"));
  await seconds(3);
  expect(screen.getByLabelText(/^Over the speed limit of/)).toBeTruthy();
  expect(vibrate).toHaveBeenCalled();
});

test("in Belgium a camera is warned once with its place and limit, spoken, counted down, drawn and cleared", async () => {
  const rb = limitedRoadbook();
  await start(rb, at(rb, 400));
  await push(at(rb, 1000), 60, 1000);
  expect(screen.queryByText("SPEED CAMERA")).toBeNull();
  await push(at(rb, 1450), 60, 2000);
  expect(screen.getByText("SPEED CAMERA")).toBeTruthy();
  expect(screen.getByText("550 m ahead · 70 km/h")).toBeTruthy();
  expect(Speech.speak).toHaveBeenCalledWith("Speed camera, 550 metres", expect.anything());
  await push(at(rb, 1600), 60, 3000);
  expect(screen.getByText("400 m ahead · 70 km/h")).toBeTruthy();
  expect(Speech.speak).toHaveBeenCalledTimes(1);
  expect(sources["cameras"].features).toHaveLength(1);
  await push(at(rb, 2100), 60, 4000);
  await push(at(rb, 2200), 60, 5000);
  expect(screen.queryByText("SPEED CAMERA")).toBeNull();
});

test("in France it is a danger zone for a stretch: no camera, no place, no countdown to it, nothing on the map", async () => {
  const rb = limitedRoadbook({ country: "FR" });
  const zone = rb.zones[0]!;
  await start(rb, at(rb, 400));
  await push(at(rb, zone.startM - 100), 60, 1000);
  expect(screen.queryByText("DANGER ZONE")).toBeNull();
  await push(at(rb, zone.startM + 20), 60, 2000);
  expect(screen.getByText("DANGER ZONE")).toBeTruthy();
  expect(screen.getByText(/ to go$/)).toBeTruthy();
  const said = (Speech.speak as jest.Mock).mock.calls.map((c) => c[0] as string);
  expect(said.some((t) => /^Danger zone for /.test(t))).toBe(true);
  expect(said.join(" ")).not.toMatch(/camera|radar/i);
  expect(screen.queryByText(/camera|radar/i)).toBeNull();
  expect(screen.queryByLabelText(/camera|radar/i)).toBeNull();
  expect(sources["cameras"].features).toHaveLength(0);
  await push(at(rb, zone.endM + 100), 60, 3000);
  expect(screen.queryByText("DANGER ZONE")).toBeNull();
});

test("in Germany nothing is said or drawn about a camera", async () => {
  const rb = limitedRoadbook({ country: "DE" });
  await start(rb, at(rb, 400));
  for (let m = 1000; m < 2400; m += 100) await push(at(rb, m), 60, m);
  expect(screen.queryByText(/SPEED CAMERA|DANGER ZONE/)).toBeNull();
  expect(sources["cameras"].features).toHaveLength(0);
});

test("a roadbook without cameras never shows a zone", async () => {
  const rb = limitedRoadbook({ cameras: false });
  await start(rb, at(rb, 400));
  for (let m = 1000; m < 2400; m += 100) await push(at(rb, m), 60, m);
  expect(screen.queryByText(/SPEED CAMERA|DANGER ZONE/)).toBeNull();
});

test("a real bundled roadbook shows a known limit all along the demo", async () => {
  const rb = first();
  expect(rb.limitSegments.length).toBeGreaterThan(50);
  await render(<RideScreen rb={rb} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Demo"));
  for (let i = 0; i < 60; i++) {
    await seconds(1);
    expect(screen.queryByLabelText("Speed limit unknown")).toBeNull();
  }
});

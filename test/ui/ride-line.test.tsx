import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { RideScreen } from "../../src/ui/RideScreen.tsx";
import { resetFiles } from "./filesystem.mock.ts";
import * as location from "./location.mock.ts";
import { layers, resetMapMock, sources } from "./maplibre.mock.tsx";
import { flush } from "./flush.ts";
import { at, bareRoadbook, first } from "./helpers.ts";

// Spec ride-navigation, "Direction on the line": chevrons, and the part already ridden pale.
beforeEach(async () => {
  jest.useFakeTimers();
  resetMapMock();
  resetFiles();
  await AsyncStorage.clear();
  location.state.permission = "granted";
  location.state.watcher = null;
});
afterEach(() => jest.useRealTimers());

const gradient = () => layers["line"].paint["line-gradient"] as unknown[];

test("before the ride the whole line is in one colour with small arrows, and no stretch is bright yet", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await flush(30);
  const g = gradient();
  expect(g.slice(0, 3)).toEqual(["interpolate", ["linear"], ["line-progress"]]);
  // 0 and 1, the same colour: nothing is ridden.
  expect(g[4]).toBe(g[6]);
  const arrows = layers["line-arrows"].layout;
  expect(arrows["symbol-spacing"]).toBe(90);
  expect(arrows["icon-size"][0]).toBe("interpolate");
  expect(sources["line-next"]).toBeUndefined();
});

test("the part ridden turns pale at the rider, and the pale part grows with the ride", async () => {
  const rb = first();
  const [lat, lon] = at(rb, 1_000);
  location.state.position = { latitude: lat, longitude: lon };
  await render(<RideScreen rb={rb} onBack={() => {}} />);
  await flush(30);
  await fireEvent.press(screen.getByText("Start"));
  await flush(30);
  const push = async (m: number) => {
    const [la, lo] = at(rb, m);
    await act(async () => location.pushFix(la, lo, 20, Date.now()));
  };
  await push(rb.totalM * 0.25);
  const quarter = gradient();
  await push(rb.totalM * 0.75);
  const threeQuarters = gradient();
  // behind, then ahead, with the step at the share ridden.
  expect(quarter[4]).not.toBe(quarter[quarter.length - 1]);
  expect(quarter[5] as number).toBeGreaterThan(0.2);
  expect(quarter[5] as number).toBeLessThan(0.3);
  expect(threeQuarters[5] as number).toBeGreaterThan(0.7);
  expect(threeQuarters[5] as number).toBeLessThan(0.8);
});

test("the 3 km just ahead of the rider are drawn again on top, bright, with bold chevrons, and move with the ride", async () => {
  const rb = first();
  const [lat, lon] = at(rb, 1_000);
  location.state.position = { latitude: lat, longitude: lon };
  await render(<RideScreen rb={rb} onBack={() => {}} />);
  await flush(30);
  await fireEvent.press(screen.getByText("Start"));
  await flush(30);
  const push = async (m: number) => {
    const [la, lo] = at(rb, m);
    await act(async () => location.pushFix(la, lo, 20, Date.now()));
  };
  await push(10_000);
  const first10 = sources["line-next"].geometry.coordinates as [number, number][];
  const near = (c: [number, number], m: number) => {
    const [la, lo] = at(rb, m);
    return Math.hypot(c[0] - lo, c[1] - la);
  };
  expect(near(first10[0]!, 10_000)).toBeLessThan(0.001);
  expect(near(first10[first10.length - 1]!, 13_000)).toBeLessThan(0.002);
  expect(layers["line-next-chevrons"].layout["icon-image"]).toBe("chevron");
  await push(20_000);
  const later = sources["line-next"].geometry.coordinates as [number, number][];
  expect(near(later[0]!, 20_000)).toBeLessThan(0.001);
  expect(later).not.toEqual(first10);
});

test("the map marks where a roadbook begins and ends: one mark for a loop, a start and a finish for a road", async () => {
  // The fixture roadbooks are loops.
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await flush(30);
  const marks = (sources["route-ends"] as any).features;
  expect(marks.map((f: any) => f.properties.icon)).toEqual(["route-loop"]);
  expect(layers["route-ends"].layout["icon-image"]).toEqual(["get", "icon"]);
});

test("a roadbook that is not a loop has a start and a finish", async () => {
  await render(<RideScreen rb={bareRoadbook()} onBack={() => {}} />);
  await flush(30);
  const marks = (sources["route-ends"] as any).features;
  expect(marks.map((f: any) => f.properties.icon)).toEqual(["route-finish", "route-start"]);
});

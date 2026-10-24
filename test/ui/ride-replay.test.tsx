import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Linking } from "react-native";
import { RideScreen } from "../../src/ui/RideScreen.tsx";
import { routeToStart } from "../../src/services/valhalla.ts";
import * as location from "./location.mock.ts";
import { resetMapMock } from "./maplibre.mock.tsx";
import { flush, seconds } from "./flush.ts";
import { bareRoadbook, gpxRoadbook, limitedRoadbook, skippableRoadbook, endRide, revealButtons } from "./helpers.ts";
import type { LatLon, PreparedRoadbook } from "../../src/core/types.ts";

const route = routeToStart as jest.Mock;
let handler: ((e: { url: string }) => void) | null = null;
let removed = 0;
let listen: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers();
  resetMapMock();
  handler = null;
  removed = 0;
  location.state.permission = "granted";
  location.state.watcher = null;
  location.state.position = null;
  location.requestForegroundPermissionsAsync.mockClear();
  location.watchPositionAsync.mockClear();
  route.mockReset();
  route.mockImplementation(() => new Promise(() => {}));
  listen = jest.spyOn(Linking, "addEventListener").mockImplementation(((_: string, h: (e: { url: string }) => void) => {
    handler = h;
    return { remove: () => void removed++ };
  }) as never);
});
afterEach(() => {
  jest.useRealTimers();
  listen.mockRestore();
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
});

const open = async (rb: PreparedRoadbook) => {
  await render(<RideScreen rb={rb} onBack={() => {}} />);
};
const link = async (scenario: string, wait = 4) => {
  await act(async () => handler!({ url: `mobilemotoride://replay/${scenario}` }));
  await flush();
  await seconds(wait);
};

test("the scripted GPS starts a ride without the GPS and without a permission dialog", async () => {
  await open(skippableRoadbook());
  await link("ride");
  expect(location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  expect(location.watchPositionAsync).not.toHaveBeenCalled();
  await revealButtons();
  expect(screen.getByText("End")).toBeTruthy();
  expect(screen.getByText(/^(Straight .+|Left in .+|Right in .+|U-turn in .+|Finish in .+)$/)).toBeTruthy();
});

test("approach: parked far from the start, it routes to the start once and says 'To the start'", async () => {
  const rb = skippableRoadbook();
  route.mockImplementation(async (from: LatLon, to: LatLon) => [from, to]);
  await open(rb);
  await link("approach");
  expect(route).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/^To the start · /)).toBeTruthy();
  expect(screen.getByTestId("source-approach")).toBeTruthy();
});

test("offroute: on the line, then 250 m off it, the way back is offered", async () => {
  await open(skippableRoadbook());
  await link("offroute", 8); // three seconds on the line, then three fixes off it
  expect(screen.getByText(/^Rejoin the route, \d+ m, /)).toBeTruthy();
  expect(screen.getByText(/^Off route · /)).toBeTruthy();
  expect(route).toHaveBeenCalledTimes(1);
});

test("wrongway: riding against the line says U-turn", async () => {
  await open(skippableRoadbook());
  await link("wrongway");
  expect(screen.getByText("U-turn, wrong way")).toBeTruthy();
});

test("skip: parked on the line, the next point can be skipped, and the skip goes through", async () => {
  const rb = skippableRoadbook();
  route.mockImplementation(async (from: LatLon, to: LatLon) => [from, to]);
  await open(rb);
  await link("skip");
  expect(screen.getByText("Skip 1. Mont")).toBeTruthy();
  await fireEvent.press(screen.getByText("Skip 1. Mont"));
  await fireEvent.press(screen.getByText("Skip"));
  await flush();
  await seconds(2);
  expect(screen.getByText(/^To 2\. Cassel · /)).toBeTruthy();
  expect(screen.getByText("Undo")).toBeTruthy();
});

test("zone: 550 m before the first danger zone, the zone is warned", async () => {
  await open(limitedRoadbook());
  await link("zone");
  expect(screen.getByText("SPEED CAMERA")).toBeTruthy();
});

test("a scenario the roadbook cannot play does nothing", async () => {
  await open(gpxRoadbook());
  await link("zone");
  expect(screen.getByText("Start")).toBeTruthy();
  expect(screen.queryByText("End")).toBeNull();
  await open(bareRoadbook());
  await link("skip");
  expect(screen.queryAllByText("End")).toHaveLength(0);
});

test("other links and unknown scenarios are ignored", async () => {
  await open(skippableRoadbook());
  await act(async () => handler!({ url: "mobilemotoride://replay/teleport" }));
  await act(async () => handler!({ url: "https://example.com/replay/ride" }));
  await act(async () => handler!({ url: "" }));
  await flush();
  expect(screen.getByText("Start")).toBeTruthy();
});

test("a scripted ride can be replaced by another, and Stop ends it", async () => {
  await open(skippableRoadbook());
  await link("ride");
  await link("wrongway");
  expect(screen.getByText("U-turn, wrong way")).toBeTruthy();
  await endRide();
  expect(screen.getByText("Start")).toBeTruthy();
  expect(screen.queryByText("U-turn, wrong way")).toBeNull();
});

test("after a scripted ride, Start uses the real GPS again, with its permission", async () => {
  const rb = skippableRoadbook();
  await open(rb);
  await link("wrongway");
  await endRide();
  location.state.position = { latitude: rb.roadbook.line[0]![0], longitude: rb.roadbook.line[0]![1] };
  await fireEvent.press(screen.getByText("Start"));
  await flush();
  expect(location.requestForegroundPermissionsAsync).toHaveBeenCalled();
  expect(location.watchPositionAsync).toHaveBeenCalled();
});

test("the listener goes when the screen goes", async () => {
  const view = await render(<RideScreen rb={skippableRoadbook()} onBack={() => {}} />);
  await act(async () => view.unmount());
  expect(removed).toBe(1);
});

test("a release build never listens: the scripted GPS is unreachable", async () => {
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
  await open(skippableRoadbook());
  expect(listen).not.toHaveBeenCalled();
  expect(handler).toBeNull();
});

test("startfrom: parked far away with the third route point chosen, it routes to that point, not to the start", async () => {
  const rb = skippableRoadbook();
  route.mockImplementation(async (from: LatLon, to: LatLon) => [from, to]);
  await open(rb);
  await link("startfrom");
  expect(route).toHaveBeenCalledTimes(1);
  const [, to] = route.mock.calls[0]!;
  expect(to[1]).toBeCloseTo(rb.roadbook.line[400]![1], 4); // "2. Cassel", at 2 km: the third route point (index 2)
  expect(screen.getByText(/^To 2\. Cassel · /)).toBeTruthy();
  expect(screen.queryByText(/^To the start/)).toBeNull();
  expect(screen.queryByText("Where do you join?")).toBeNull();
  expect(screen.getByText("Skip 2. Cassel")).toBeTruthy();
});

test("join: beside the road between the second and third points, the card offers the nearest next point", async () => {
  await open(skippableRoadbook());
  await link("join");
  expect(screen.getByText("Where do you join?")).toBeTruthy();
  expect(screen.getByText("Go to 2. Cassel")).toBeTruthy();
  expect(screen.getByText(/ away · skips Start, 1\. Mont$/)).toBeTruthy();
  expect(route).not.toHaveBeenCalled();
});

test("join does nothing on a roadbook with fewer than three route points", async () => {
  await open(bareRoadbook());
  await link("join");
  expect(screen.queryByText("Where do you join?")).toBeNull();
  expect(screen.queryByText("End")).toBeNull();
});

test("startfrom does nothing on a roadbook with fewer than three route points", async () => {
  await open(bareRoadbook());
  await link("startfrom");
  expect(screen.queryByText("End")).toBeNull();
});

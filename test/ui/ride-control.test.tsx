import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { BackHandler, Linking } from "react-native";
import * as Speech from "expo-speech";
import { RideScreen } from "../../src/ui/RideScreen.tsx";
import { routeToStart } from "../../src/services/valhalla.ts";
import * as location from "./location.mock.ts";
import { resetMapMock } from "./maplibre.mock.tsx";
import { flush, seconds } from "./flush.ts";
import { at, bareRoadbook, endRide, skippableRoadbook, revealButtons } from "./helpers.ts";
import type { LatLon, PreparedRoadbook } from "../../src/core/types.ts";

const route = routeToStart as jest.Mock;
let backHandler: (() => boolean) | null = null;
let urlHandler: ((e: { url: string }) => void) | null = null;
let listen: jest.SpyInstance;

beforeEach(() => {
  jest.useFakeTimers();
  resetMapMock();
  location.state.permission = "granted";
  location.state.watcher = null;
  location.state.removed = 0;
  location.watchPositionAsync.mockClear();
  route.mockReset();
  route.mockImplementation(() => new Promise(() => {}));
  backHandler = null;
  urlHandler = null;
  jest.spyOn(Linking, "addEventListener").mockImplementation(((_: string, h: (e: { url: string }) => void) => {
    urlHandler = h;
    return { remove: () => {} };
  }) as never);
  listen = jest.spyOn(BackHandler, "addEventListener").mockImplementation(((_: string, h: () => boolean) => {
    backHandler = h;
    return { remove: () => {} };
  }) as never);
});
afterEach(() => {
  jest.useRealTimers();
  listen.mockRestore();
});

let clock = 0;
const open = async (rb: PreparedRoadbook, onBack = () => {}) => {
  clock = 0;
  await render(<RideScreen rb={rb} onBack={onBack} />);
};
const startGps = async (rb: PreparedRoadbook, here: LatLon) => {
  location.state.position = { latitude: here[0], longitude: here[1] };
  await fireEvent.press(screen.getByText("Start"));
  await flush();
};
const push = (p: LatLon, kmh = 0, heading: number | null = 90) =>
  act(async () => location.pushFix(p[0], p[1], kmh / 3.6, (clock += 1000), heading));
const km = () => screen.getByText(/^\d+(\.\d)? km$|^\d+ km$/).props.children.toString();

test("a GPS ride can be paused: the GPS is let go, nothing is produced, and the screen says so", async () => {
  const rb = skippableRoadbook();
  await open(rb);
  await startGps(rb, at(rb, 500));
  await push(at(rb, 500));
  await revealButtons();
  expect(screen.getByText("Pause")).toBeTruthy();
  await revealButtons();
  await fireEvent.press(screen.getByText("Pause"));
  await revealButtons();
  expect(screen.getByLabelText("Resume the ride")).toBeTruthy();
  expect(screen.getByText("Ride paused")).toBeTruthy();
  expect(screen.getByText(/· PAUSED/)).toBeTruthy();
  expect(location.state.removed).toBe(1);
  const before = km();
  await push(at(rb, 1500), 60);
  await seconds(5);
  expect(km()).toBe(before);
  expect(Speech.speak).not.toHaveBeenCalled();
});

test("Resume subscribes again and carries on with the same ride", async () => {
  const rb = skippableRoadbook();
  await open(rb);
  await startGps(rb, at(rb, 500));
  await push(at(rb, 500));
  const before = Number(km().replace(" km", ""));
  await revealButtons();
  await fireEvent.press(screen.getByText("Pause"));
  await revealButtons();
  await fireEvent.press(screen.getByText("Resume"));
  expect(location.watchPositionAsync).toHaveBeenCalledTimes(2);
  expect(screen.queryByText("Ride paused")).toBeNull();
  await push(at(rb, 700));
  const after = Number(km().replace(" km", ""));
  expect(after).toBeLessThan(before);
  expect(after).toBeGreaterThan(before - 1);
});

test("a rider who moved while paused is guided back like on any fix", async () => {
  const rb = skippableRoadbook();
  await open(rb);
  await startGps(rb, at(rb, 500));
  await push(at(rb, 500));
  await revealButtons();
  await fireEvent.press(screen.getByText("Pause"));
  await revealButtons();
  await fireEvent.press(screen.getByText("Resume"));
  const away: LatLon = [at(rb, 500)[0] + 0.002, at(rb, 500)[1]];
  for (let i = 0; i < 3; i++) await push(away);
  expect(screen.getByText(/^Rejoin the route, /)).toBeTruthy();
});

test("a skip can still be undone after a pause", async () => {
  const rb = skippableRoadbook();
  const here = at(rb, 100);
  route.mockResolvedValue([here, at(rb, 2000)]);
  await open(rb);
  await startGps(rb, here);
  await push(here);
  await fireEvent.press(screen.getByText("Skip 1. Mont"));
  await fireEvent.press(screen.getByText("Skip"));
  await flush();
  await revealButtons();
  await fireEvent.press(screen.getByText("Pause"));
  await revealButtons();
  await fireEvent.press(screen.getByText("Resume"));
  await fireEvent.press(screen.getByText("Undo"));
  await push(here);
  expect(screen.getByText("Skip 1. Mont")).toBeTruthy();
});

test("there is nothing to pause while the ride is still being prepared", async () => {
  const rb = skippableRoadbook();
  await open(rb);
  location.getCurrentPositionAsync.mockImplementationOnce(() => new Promise(() => {}));
  await startGps(rb, at(rb, 500));
  expect(screen.getByText("Locating you…")).toBeTruthy();
  expect(screen.queryByText("Pause")).toBeNull();
  await revealButtons();
  expect(screen.getByText("End")).toBeTruthy();
});

test("a paused ride can be ended", async () => {
  const rb = skippableRoadbook();
  await open(rb);
  await startGps(rb, at(rb, 500));
  await push(at(rb, 500));
  await revealButtons();
  await fireEvent.press(screen.getByText("Pause"));
  await endRide();
  expect(screen.getByText("Start")).toBeTruthy();
  expect(screen.queryByText("Ride paused")).toBeNull();
  expect(screen.queryByText("Resume")).toBeNull();
});

test("ending a GPS ride asks first, and Keep riding changes nothing", async () => {
  const rb = skippableRoadbook();
  await open(rb);
  await startGps(rb, at(rb, 500));
  await push(at(rb, 500));
  await revealButtons();
  await fireEvent.press(screen.getByText("End"));
  expect(screen.getByText("End the ride?")).toBeTruthy();
  expect(screen.getByText(/^Your progress on .* is lost\.$/)).toBeTruthy();
  await fireEvent.press(screen.getByText("Keep riding"));
  expect(screen.queryByText("End the ride?")).toBeNull();
  await revealButtons();
  expect(screen.getByText("End")).toBeTruthy();
  expect(location.state.removed).toBe(0);
  await push(at(rb, 600));
  expect(screen.getByText(/^(Straight .+|Left in .+|Right in .+)$/)).toBeTruthy();
});

test("End ride ends it: the GPS is released and the roadbook is back as before", async () => {
  const rb = skippableRoadbook();
  await open(rb);
  await startGps(rb, at(rb, 500));
  await push(at(rb, 500));
  await revealButtons();
  await fireEvent.press(screen.getByText("End"));
  await fireEvent.press(screen.getByText("End ride"));
  expect(location.state.removed).toBe(1);
  expect(screen.getByText("Start")).toBeTruthy();
  expect(screen.getByText("Demo")).toBeTruthy();
  expect(screen.queryByText("End the ride?")).toBeNull();
});

test("Back during a GPS ride asks the same question, and leaves only after End ride", async () => {
  const rb = skippableRoadbook();
  const onBack = jest.fn();
  await open(rb, onBack);
  await startGps(rb, at(rb, 500));
  await push(at(rb, 500));
  await revealButtons();
  await fireEvent.press(screen.getByText("Back"));
  expect(screen.getByText("Leave this ride?")).toBeTruthy();
  expect(onBack).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("Keep riding"));
  expect(onBack).not.toHaveBeenCalled();
  await revealButtons();
  await fireEvent.press(screen.getByText("Back"));
  await fireEvent.press(screen.getByText("End ride"));
  expect(onBack).toHaveBeenCalledTimes(1);
  expect(location.state.removed).toBe(1);
});

test("Back with no ride, or during a demo, leaves at once", async () => {
  const onBack = jest.fn();
  await open(skippableRoadbook(), onBack);
  await revealButtons();
  await fireEvent.press(screen.getByText("Back"));
  expect(onBack).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByText("Demo"));
  await seconds(2);
  await revealButtons();
  await fireEvent.press(screen.getByText("Back"));
  expect(onBack).toHaveBeenCalledTimes(2);
  expect(screen.queryByText("Leave this ride?")).toBeNull();
});

test("ending a demo needs no question, and the demo can still be paused", async () => {
  await open(skippableRoadbook());
  await fireEvent.press(screen.getByText("Demo"));
  await seconds(2);
  await revealButtons();
  expect(screen.getByLabelText("Pause the demo")).toBeTruthy();
  await revealButtons();
  await fireEvent.press(screen.getByText("End"));
  expect(screen.queryByText("End the ride?")).toBeNull();
  expect(screen.getByText("Start")).toBeTruthy();
});

test("the phone's Back button asks during a ride, closes a question that is open, and leaves when idle", async () => {
  const rb = skippableRoadbook();
  const onBack = jest.fn();
  await open(rb, onBack);
  await act(async () => expect(backHandler!()).toBe(true));
  expect(onBack).toHaveBeenCalledTimes(1);
  await startGps(rb, at(rb, 500));
  await push(at(rb, 500));
  await act(async () => expect(backHandler!()).toBe(true));
  expect(screen.getByText("Leave this ride?")).toBeTruthy();
  expect(onBack).toHaveBeenCalledTimes(1);
  await act(async () => expect(backHandler!()).toBe(true));
  expect(screen.queryByText("Leave this ride?")).toBeNull();
});

test("a new ride after ending one starts clean", async () => {
  const rb = skippableRoadbook();
  await open(rb);
  await startGps(rb, at(rb, 500));
  await push(at(rb, 500));
  await revealButtons();
  await fireEvent.press(screen.getByText("Pause"));
  await endRide();
  await startGps(rb, at(rb, 500));
  await push(at(rb, 500));
  expect(screen.queryByText("Ride paused")).toBeNull();
  await revealButtons();
  expect(screen.getByText("Pause")).toBeTruthy();
});

// ---- joining the roadbook ----

/** 300 m beside the road at `m` metres: away from the roadbook (the line is 4 km east). */
const beside = (rb: PreparedRoadbook, m: number): LatLon => [at(rb, m)[0] + 0.0027, at(rb, m)[1]];
const joinAt = async (rb: PreparedRoadbook, m: number) => {
  const here = beside(rb, m);
  await open(rb);
  await startGps(rb, here);
  return here;
};

test("away from the roadbook the app asks where to join, with the nearest next point as the answer", async () => {
  const rb = skippableRoadbook();
  await joinAt(rb, 1200); // between 1. Mont (800 m) and 2. Cassel (2 km)
  expect(screen.getByText("Where do you join?")).toBeTruthy();
  expect(screen.getByText("Go to 2. Cassel")).toBeTruthy();
  expect(screen.getByText(/ away · skips Start, 1\. Mont$/)).toBeTruthy();
  expect(screen.getByText("Go to the start")).toBeTruthy();
  expect(screen.getByText("Choose another point…")).toBeTruthy();
  expect(screen.getByText("Cancel")).toBeTruthy();
  expect(route).not.toHaveBeenCalled();
  expect(screen.queryByLabelText("Zoom in")).toBeNull();
});

test("one tap on the nearest next point routes there and drops every point before it", async () => {
  const rb = skippableRoadbook();
  route.mockImplementation(async (from: LatLon, to: LatLon) => [from, to]);
  const here = await joinAt(rb, 1200);
  await fireEvent.press(screen.getByText("Go to 2. Cassel"));
  await flush();
  expect(route).toHaveBeenCalledTimes(1);
  const [from, to] = route.mock.calls[0]!;
  expect(from[0]).toBeCloseTo(here[0], 5);
  expect(to[0]).toBeCloseTo(at(rb, 2000)[0], 4);
  expect(to[1]).toBeCloseTo(at(rb, 2000)[1], 4);
  expect(screen.queryByText("Where do you join?")).toBeNull();
  await push(here);
  expect(screen.getByText(/^To 2\. Cassel · /)).toBeTruthy();
  expect(screen.getByTestId("source-approach")).toBeTruthy();
  expect(screen.getByText("Skip 2. Cassel")).toBeTruthy();
  expect(screen.queryByText(/Mont|Café/)).toBeNull();
});

test("the start is one tap away too, and the ride then goes to the start of the roadbook", async () => {
  const rb = skippableRoadbook();
  route.mockImplementation(async (from: LatLon, to: LatLon) => [from, to]);
  await joinAt(rb, 1200);
  await fireEvent.press(screen.getByText("Go to the start"));
  await flush();
  const [, to] = route.mock.calls[0]!;
  expect(to[0]).toBeCloseTo(at(rb, 0)[0], 4);
  expect(to[1]).toBeCloseTo(at(rb, 0)[1], 4);
  await push(beside(rb, 1200));
  expect(screen.getByText(/^To the start · /)).toBeTruthy();
});

test("any other point can be chosen from a list of the route points, whole rows, without the service stops", async () => {
  const rb = skippableRoadbook();
  route.mockImplementation(async (from: LatLon, to: LatLon) => [from, to]);
  await joinAt(rb, 1200);
  await fireEvent.press(screen.getByText("Choose another point…"));
  expect(screen.getByText("Start from")).toBeTruthy();
  expect(screen.getByText("The points before it are dropped.")).toBeTruthy();
  const rows = screen.getAllByLabelText(/^Start from .+, .+ from the start$/);
  expect(rows.length).toBe(5);
  expect(screen.queryByText(/Café/)).toBeNull();
  await fireEvent.press(screen.getByLabelText(/^Start from 3\. Bailleul/));
  await flush();
  const [, to] = route.mock.calls[0]!;
  expect(to[1]).toBeCloseTo(at(rb, 3000)[1], 4);
  await push(beside(rb, 1200));
  expect(screen.getByText(/^To 3\. Bailleul · /)).toBeTruthy();
  expect(screen.getByText("Skip 3. Bailleul")).toBeTruthy();
});

test("Cancel on the card means no ride, at once and with no question", async () => {
  const rb = skippableRoadbook();
  await joinAt(rb, 1200);
  await fireEvent.press(screen.getByText("Cancel"));
  expect(screen.queryByText("Where do you join?")).toBeNull();
  expect(screen.getByText("Start")).toBeTruthy();
  expect(screen.queryByText("End the ride?")).toBeNull();
  expect(route).not.toHaveBeenCalled();
});

test("behind the start the start is the nearest next point: it is the one answer, and the other points stay a tap away", async () => {
  const rb = skippableRoadbook();
  await open(rb);
  await startGps(rb, [at(rb, 0)[0] + 0.0027, at(rb, 0)[1] - 0.01]);
  expect(screen.getByText("Where do you join?")).toBeTruthy();
  expect(screen.getByText("Go to the start")).toBeTruthy();
  expect(screen.queryByText(/^Go to [^t]/)).toBeNull();
  expect(screen.getByText("Choose another point…")).toBeTruthy();
});

test("on the line there is no card: the ride begins at once where the rider is", async () => {
  const rb = skippableRoadbook();
  await open(rb);
  await startGps(rb, at(rb, 1200));
  expect(screen.queryByText("Where do you join?")).toBeNull();
  await push(at(rb, 1200));
  expect(screen.getByText("Skip 2. Cassel")).toBeTruthy();
  expect(route).not.toHaveBeenCalled();
});

test("with no GPS fix at all there is nothing to ask: the ride begins on the roadbook", async () => {
  const rb = skippableRoadbook();
  await open(rb);
  location.getCurrentPositionAsync.mockImplementationOnce(() => new Promise(() => {}));
  await startGps(rb, at(rb, 500));
  await act(async () => {
    jest.advanceTimersByTime(20_000);
  });
  await flush();
  expect(screen.queryByText("Where do you join?")).toBeNull();
  expect(route).not.toHaveBeenCalled();
});

test("nothing is lost before the ride has begun: the phone's Back closes the join card at once, and Back works while locating", async () => {
  const rb = skippableRoadbook();
  const onBack = jest.fn();
  await open(rb, onBack);
  await startGps(rb, beside(rb, 1200));
  expect(screen.getByText("Where do you join?")).toBeTruthy();
  expect(screen.queryByText("Pause")).toBeNull();
  await act(async () => expect(backHandler!()).toBe(true));
  expect(screen.queryByText("Where do you join?")).toBeNull();
  expect(screen.getByText("Start")).toBeTruthy();
  expect(screen.queryByText("Leave this ride?")).toBeNull();
  // Still locating: nothing has begun, so Back leaves at once.
  location.getCurrentPositionAsync.mockImplementationOnce(() => new Promise(() => {}));
  await startGps(rb, beside(rb, 1200));
  expect(screen.getByText("Locating you…")).toBeTruthy();
  await revealButtons();
  await fireEvent.press(screen.getByText("Back"));
  expect(onBack).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Leave this ride?")).toBeNull();
});

test("under a sheet only the sheet can be reached: the panel and the map controls are out of the accessibility tree", async () => {
  const rb = skippableRoadbook();
  await open(rb);
  await startGps(rb, beside(rb, 1200));
  expect(screen.getByText("Where do you join?")).toBeTruthy();
  expect(screen.queryByText("Back")).toBeNull();
  expect(screen.queryByText("Demo")).toBeNull();
  expect(screen.getByText("Cancel")).toBeTruthy();
});

test("the end question is asked only once the rider is followed", async () => {
  const rb = skippableRoadbook();
  route.mockImplementation(() => new Promise(() => {}));
  await open(rb);
  await startGps(rb, beside(rb, 1200));
  await fireEvent.press(screen.getByText("Go to 2. Cassel"));
  await flush();
  expect(screen.getByText("To 2. Cassel…")).toBeTruthy();
  await revealButtons();
  await fireEvent.press(screen.getByText("End"));
  expect(screen.queryByText("End the ride?")).toBeNull();
  expect(screen.getByText("Start")).toBeTruthy();
});

test("a late route after the card is cancelled and the ride ended is ignored", async () => {
  const rb = skippableRoadbook();
  let resolve!: (l: LatLon[]) => void;
  route.mockImplementation(() => new Promise((r) => (resolve = r)));
  const here = await joinAt(rb, 1200);
  await fireEvent.press(screen.getByText("Go to 2. Cassel"));
  await flush();
  await revealButtons();
  await fireEvent.press(screen.getByText("End"));
  await act(async () => resolve([here, at(rb, 2000)]));
  await flush();
  expect(screen.queryByTestId("source-approach")).toBeNull();
  expect(screen.getByText("Start")).toBeTruthy();
});

test("without a route the way to the chosen point is a straight line, named after it", async () => {
  const rb = skippableRoadbook();
  route.mockResolvedValue(null);
  const here = await joinAt(rb, 1200);
  await fireEvent.press(screen.getByText("Go to 2. Cassel"));
  await flush();
  await push(here);
  expect(screen.getByText("No road route to 2. Cassel")).toBeTruthy();
  expect(screen.getByText(/^Straight to 2\. Cassel /)).toBeTruthy();
  expect(screen.getByText(/^To 2\. Cassel · /)).toBeTruthy();
});

test("the demo never asks where to join", async () => {
  await open(skippableRoadbook());
  await fireEvent.press(screen.getByText("Demo"));
  await seconds(3);
  expect(screen.queryByText("Where do you join?")).toBeNull();
});

test("a rider joining a roadbook with a single route point gets the plain way to the start, with no card", async () => {
  const rb = bareRoadbook();
  route.mockImplementation(async (from: LatLon, to: LatLon) => [from, to]);
  await open(rb);
  await startGps(rb, [at(rb, 0)[0] + 0.02, at(rb, 0)[1]]);
  expect(screen.queryByText("Where do you join?")).toBeNull();
  expect(route).toHaveBeenCalledTimes(1);
});

test("a chosen point does not apply to a scripted ride that does not ask: the script plays as written", async () => {
  const rb = skippableRoadbook();
  route.mockImplementation(async (from: LatLon, to: LatLon) => [from, to]);
  await open(rb);
  await act(async () => urlHandler!({ url: "mobilemotoride://replay/approach" }));
  await flush();
  await seconds(3);
  expect(screen.getByText(/^To the start · /)).toBeTruthy();
  expect(screen.queryByText("Where do you join?")).toBeNull();
});

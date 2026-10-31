import { StyleSheet } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Speech from "expo-speech";
import { RideScreen } from "../../src/ui/RideScreen.tsx";
import { routeToStart } from "../../src/services/valhalla.ts";
import * as location from "./location.mock.ts";
import { resetMapMock } from "./maplibre.mock.tsx";
import { flush, seconds } from "./flush.ts";
import { at, skippableRoadbook, endRide, revealButtons } from "./helpers.ts";
import type { LatLon, PreparedRoadbook } from "../../src/core/types.ts";

const route = routeToStart as jest.Mock;

beforeEach(() => {
  jest.useFakeTimers();
  resetMapMock();
  location.state.permission = "granted";
  location.state.watcher = null;
  location.state.removed = 0;
  route.mockReset();
  route.mockImplementation(() => new Promise(() => {}));
});
afterEach(() => jest.useRealTimers());

let clock = 0;
const start = async (rb: PreparedRoadbook, here: LatLon) => {
  clock = 0;
  location.state.position = { latitude: here[0], longitude: here[1] };
  await render(<RideScreen rb={rb} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Start"));
  await flush();
};
/** A fix: stopped by default, since skipping needs a rider who is not riding. */
const push = (p: LatLon, kmh = 0, heading: number | null = 90) =>
  act(async () => location.pushFix(p[0], p[1], kmh / 3.6, (clock += 1000), heading));
const stopAt = (rb: PreparedRoadbook, m: number) => push(at(rb, m));

test("nothing to skip before a ride, or in the demo", async () => {
  const rb = skippableRoadbook();
  await render(<RideScreen rb={rb} onBack={() => {}} />);
  expect(screen.queryByLabelText(/^Skip /)).toBeNull();
  await fireEvent.press(screen.getByText("Demo"));
  await seconds(5);
  expect(screen.queryByLabelText(/^Skip /)).toBeNull();
  expect(screen.queryByText(/Stop to skip/)).toBeNull();
});

test("while riding with GPS the next route point can be skipped, not the café", async () => {
  const rb = skippableRoadbook();
  await start(rb, at(rb, 100));
  expect(screen.queryByLabelText(/^Skip /)).toBeNull();
  await stopAt(rb, 100);
  expect(screen.getByLabelText("Skip 1. Mont")).toBeTruthy();
  await stopAt(rb, 1000);
  expect(screen.getByLabelText("Skip 2. Cassel")).toBeTruthy();
});

test("moving at speed, the skip is still there and still asks first", async () => {
  const rb = skippableRoadbook();
  await start(rb, at(rb, 100));
  await push(at(rb, 100), 80);
  expect(screen.queryByText(/Stop to skip/)).toBeNull();
  await fireEvent.press(screen.getByLabelText("Skip 1. Mont"));
  expect(screen.getByText("Skip 1. Mont?")).toBeTruthy();
  expect(route).not.toHaveBeenCalled();
});

test("the skip is a square of at least 72 dp at the top left, and a banner starts after it", async () => {
  const rb = skippableRoadbook();
  await start(rb, at(rb, 100));
  await stopAt(rb, 100);
  const flat = StyleSheet.flatten(screen.getByLabelText("Skip 1. Mont").props.style);
  expect(flat.width).toBe(flat.height);
  expect(flat.width).toBeGreaterThanOrEqual(72);
  await revealButtons();
  await fireEvent.press(screen.getByText("Pause"));
  const banner = screen.getByText("Ride paused").parent!;
  // At the left, so the column of map buttons on the right can never meet it.
  expect(flat.left).toBe(12);
  expect(flat.right).toBeUndefined();
  expect(StyleSheet.flatten(banner.props.style).left).toBe(12 + flat.width + 8);
  expect(StyleSheet.flatten(banner.props.style).right).toBe(12);
});

test("a skip needs a second tap that names the point and where the rider goes, and can be cancelled", async () => {
  const rb = skippableRoadbook();
  await start(rb, at(rb, 100));
  await stopAt(rb, 100);
  await fireEvent.press(screen.getByLabelText("Skip 1. Mont"));
  expect(screen.getByText("Skip 1. Mont?")).toBeTruthy();
  expect(screen.getByText("New route to 2. Cassel")).toBeTruthy();
  expect(route).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("Cancel"));
  expect(screen.queryByText("Skip 1. Mont?")).toBeNull();
  expect(route).not.toHaveBeenCalled();
});

test("the question cancels itself after 10 seconds, however often the screen updates", async () => {
  const rb = skippableRoadbook();
  await start(rb, at(rb, 100));
  await stopAt(rb, 100);
  await fireEvent.press(screen.getByLabelText("Skip 1. Mont"));
  for (let i = 0; i < 8; i++) {
    await push(at(rb, 100));
    await seconds(1);
  }
  expect(screen.getByText("Skip 1. Mont?")).toBeTruthy();
  for (let i = 0; i < 4; i++) {
    await push(at(rb, 100));
    await seconds(1);
  }
  expect(screen.queryByText("Skip 1. Mont?")).toBeNull();
  expect(route).not.toHaveBeenCalled();
});

test("confirming asks Valhalla once for a route from here to the target, and says it is looking", async () => {
  const rb = skippableRoadbook();
  const here = at(rb, 100);
  await start(rb, here);
  await stopAt(rb, 100);
  await fireEvent.press(screen.getByLabelText("Skip 1. Mont"));
  await fireEvent.press(screen.getByText("Skip"));
  await flush();
  expect(route).toHaveBeenCalledTimes(1);
  const [from, to] = route.mock.calls[0]!;
  expect(from[0]).toBeCloseTo(here[0], 5);
  expect(to[0]).toBeCloseTo(at(rb, 2000)[0], 4);
  expect(to[1]).toBeCloseTo(at(rb, 2000)[1], 4);
  expect(screen.getByText("Finding a new route…")).toBeTruthy();
  // A second tap while it looks changes nothing.
  await fireEvent.press(screen.getByText("Finding a new route…"));
  expect(route).toHaveBeenCalledTimes(1);
});

test("with the route: the skipped point is gone, the target is named, it is said aloud, dashed on the map", async () => {
  const rb = skippableRoadbook();
  const here = at(rb, 100);
  route.mockResolvedValue([here, [here[0] + 0.0004, here[1] + 0.004], at(rb, 2000)]);
  await start(rb, here);
  await stopAt(rb, 100);
  await fireEvent.press(screen.getByLabelText("Skip 1. Mont"));
  await fireEvent.press(screen.getByText("Skip"));
  await flush();
  expect(Speech.speak).toHaveBeenCalledWith("Skipping 1. Mont, heading for 2. Cassel", expect.anything());
  expect(screen.getByText("Undo")).toBeTruthy();
  // One word on one line: it shrinks to fit the square, it is never broken over two lines.
  expect(screen.getByText("Undo").props.numberOfLines).toBe(1);
  expect(screen.getByTestId("source-approach")).toBeTruthy();
  await push(here);
  expect(screen.getByText(/^To 2\. Cassel · /)).toBeTruthy();
  expect(screen.queryByText(/Next: 1\. Mont/)).toBeNull();
});

test("Undo takes the skip back, without the network, and the point is the next one again", async () => {
  const rb = skippableRoadbook();
  const here = at(rb, 100);
  route.mockResolvedValue([here, at(rb, 2000)]);
  await start(rb, here);
  await stopAt(rb, 100);
  await fireEvent.press(screen.getByLabelText("Skip 1. Mont"));
  await fireEvent.press(screen.getByText("Skip"));
  await flush();
  route.mockClear();
  await fireEvent.press(screen.getByText("Undo"));
  expect(route).not.toHaveBeenCalled();
  expect(screen.queryByText("Undo")).toBeNull();
  expect(screen.queryByTestId("source-approach")).toBeNull();
  await stopAt(rb, 100);
  expect(screen.getByLabelText("Skip 1. Mont")).toBeTruthy();
  expect(screen.getByText(/^Next: 1\. Mont/)).toBeTruthy();
});

test("the Undo is offered for 7.5 seconds, however often the screen updates", async () => {
  const rb = skippableRoadbook();
  const here = at(rb, 100);
  route.mockResolvedValue([here, at(rb, 2000)]);
  await start(rb, here);
  await stopAt(rb, 100);
  await fireEvent.press(screen.getByLabelText("Skip 1. Mont"));
  await fireEvent.press(screen.getByText("Skip"));
  await flush();
  for (let i = 0; i < 6; i++) {
    await push(here);
    await seconds(1);
  }
  expect(screen.getByText("Undo")).toBeTruthy();
  for (let i = 0; i < 3; i++) {
    await push(here);
    await seconds(1);
  }
  expect(screen.queryByText("Undo")).toBeNull();
});

/** The square is the Undo for 7.5 seconds after a skip, so the next skip waits for it to be a skip again. */
const waitOutUndo = async (p: LatLon) => {
  for (let i = 0; i < 8; i++) {
    await push(p);
    await seconds(1);
  }
};

test("a rider can skip again and again, each time from where they are", async () => {
  const rb = skippableRoadbook();
  const here = at(rb, 100);
  route.mockResolvedValue([here, at(rb, 2000)]);
  await start(rb, here);
  await stopAt(rb, 100);
  await fireEvent.press(screen.getByLabelText("Skip 1. Mont"));
  await fireEvent.press(screen.getByText("Skip"));
  await flush();
  expect(screen.queryByLabelText("Skip 2. Cassel")).toBeNull();
  await waitOutUndo(here);
  expect(screen.getByLabelText("Skip 2. Cassel")).toBeTruthy();
  const second: LatLon = [here[0] + 0.0005, here[1] + 0.002];
  route.mockResolvedValue([second, at(rb, 3000)]);
  await push(second);
  await fireEvent.press(screen.getByLabelText("Skip 2. Cassel"));
  expect(screen.getByText("New route to 3. Bailleul")).toBeTruthy();
  await fireEvent.press(screen.getByText("Skip"));
  await flush();
  expect(route).toHaveBeenCalledTimes(2);
  const [from, to] = route.mock.calls[1]!;
  expect(from[0]).toBeCloseTo(second[0], 5);
  expect(to[1]).toBeCloseTo(at(rb, 3000)[1], 4);
  await push(second);
  expect(screen.getByText(/^To 3\. Bailleul · /)).toBeTruthy();
});

test("two undos walk back through two skips", async () => {
  const rb = skippableRoadbook();
  const here = at(rb, 100);
  route.mockResolvedValue([here, at(rb, 2000)]);
  await start(rb, here);
  await stopAt(rb, 100);
  await fireEvent.press(screen.getByLabelText("Skip 1. Mont"));
  await fireEvent.press(screen.getByText("Skip"));
  await flush();
  await waitOutUndo(here);
  route.mockResolvedValue([here, at(rb, 3000)]);
  await fireEvent.press(screen.getByLabelText("Skip 2. Cassel"));
  await fireEvent.press(screen.getByText("Skip"));
  await flush();
  await fireEvent.press(screen.getByText("Undo"));
  await push(here);
  expect(screen.getByLabelText("Skip 2. Cassel")).toBeTruthy();
});

test("without a connection the skip still goes, on a straight line, and says so", async () => {
  const rb = skippableRoadbook();
  const here = at(rb, 100);
  route.mockResolvedValue(null);
  await start(rb, here);
  await stopAt(rb, 100);
  await fireEvent.press(screen.getByLabelText("Skip 1. Mont"));
  await fireEvent.press(screen.getByText("Skip"));
  await flush();
  await push(here);
  expect(screen.getByText("No road route to 2. Cassel")).toBeTruthy();
  expect(screen.getByText(/^Straight to 2\. Cassel /)).toBeTruthy();
  expect(screen.getByText(/^To 2\. Cassel · /)).toBeTruthy();
});

test("the last point cannot be skipped, the one before it can", async () => {
  const rb = skippableRoadbook();
  await start(rb, at(rb, 2500));
  await stopAt(rb, 2500);
  expect(screen.getByLabelText("Skip 3. Bailleul")).toBeTruthy();
  await stopAt(rb, 3500);
  expect(screen.queryByLabelText(/^Skip /)).toBeNull();
  expect(screen.queryByText(/Stop to skip/)).toBeNull();
});

test("a route that arrives after Stop is ignored", async () => {
  const rb = skippableRoadbook();
  const here = at(rb, 100);
  let resolve!: (l: LatLon[]) => void;
  route.mockImplementation(() => new Promise((r) => (resolve = r)));
  await start(rb, here);
  await stopAt(rb, 100);
  await fireEvent.press(screen.getByLabelText("Skip 1. Mont"));
  await fireEvent.press(screen.getByText("Skip"));
  await flush();
  await endRide();
  await act(async () => resolve([here, at(rb, 2000)]));
  await flush();
  expect(screen.queryByTestId("source-approach")).toBeNull();
  expect(screen.queryByText("Undo")).toBeNull();
  expect(Speech.speak).not.toHaveBeenCalledWith(expect.stringMatching(/^Skipping/), expect.anything());
});

test("a way back asked for before the skip does not undo it when it arrives late", async () => {
  const rb = skippableRoadbook();
  const here = at(rb, 1000);
  const away: LatLon = [here[0] + 0.0018, here[1]];
  const answers: Array<(l: LatLon[] | null) => void> = [];
  route.mockImplementation(() => new Promise((r) => answers.push(r)));
  await start(rb, here);
  await push(here, 40);
  for (let i = 0; i < 3; i++) await push(away, 40);
  await flush();
  expect(route).toHaveBeenCalledTimes(1); // the way back to the line
  await push(away, 0);
  await fireEvent.press(screen.getByLabelText("Skip 2. Cassel"));
  await fireEvent.press(screen.getByText("Skip"));
  await flush();
  expect(route).toHaveBeenCalledTimes(2);
  await act(async () => answers[1]!([away, at(rb, 3000)])); // the skip's route
  await flush();
  await act(async () => answers[0]!([away, at(rb, 1150)])); // the late way back
  await flush();
  await push(away, 0);
  expect(screen.getByText(/^To 3\. Bailleul · /)).toBeTruthy();
});

test("a card on screen has the room to itself: the skip square steps aside, and comes back", async () => {
  const rb = skippableRoadbook();
  await start(rb, at(rb, 100));
  await stopAt(rb, 100);
  expect(screen.getByLabelText("Skip 1. Mont")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Open the gauges"));
  expect(screen.queryByLabelText("Skip 1. Mont")).toBeNull();
  await fireEvent.press(screen.getByText("Close"));
  expect(screen.getByLabelText("Skip 1. Mont")).toBeTruthy();
});

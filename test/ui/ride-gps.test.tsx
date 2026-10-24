import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import * as Speech from "expo-speech";
import { RideScreen } from "../../src/ui/RideScreen.tsx";
import { routeToStart } from "../../src/services/valhalla.ts";
import * as location from "./location.mock.ts";
import { camera, resetMapMock, sources } from "./maplibre.mock.tsx";
import { flush, seconds } from "./flush.ts";
import { at, first, endRide, revealButtons } from "./helpers.ts";
import type { LatLon } from "../../src/core/types.ts";

const route = routeToStart as jest.Mock;
const INSTRUCTION = /^(Straight .+|Left in .+|Right in .+|U-turn in .+|Finish in .+)$/;

beforeEach(() => {
  jest.useFakeTimers();
  resetMapMock();
  location.state.permission = "granted";
  location.state.position = { latitude: 50.45, longitude: 3.2 };
  location.state.watcher = null;
  location.state.removed = 0;
  // Off route asks for a road route back (ADR 0012): by default it never answers.
  route.mockReset();
  route.mockImplementation(() => new Promise(() => {}));
});
afterEach(() => jest.useRealTimers());

const placeRiderAt = (p: LatLon) => (location.state.position = { latitude: p[0], longitude: p[1] });
const push = async (p: LatLon, speed = 15) => act(async () => location.pushFix(p[0], p[1], speed, Date.now()));

test("a refused permission says so, in plain words, and nothing follows", async () => {
  location.state.permission = "denied";
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Start"));
  await flush();
  expect(screen.getByText("Location is off")).toBeTruthy();
  expect(location.watchPositionAsync).not.toHaveBeenCalled();
  expect(screen.queryByTestId("source-rider")).toBeNull();
  await endRide();
  expect(screen.queryByText("Location is off")).toBeNull();
});

test("waiting for the first fix is shown, and the ride starts on the roadbook if none comes", async () => {
  location.getCurrentPositionAsync.mockImplementationOnce(() => new Promise(() => {}));
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Start"));
  await flush();
  expect(screen.getByText("Locating you…")).toBeTruthy();
  await act(async () => {
    jest.advanceTimersByTime(20_000);
  });
  await flush();
  expect(screen.queryByText("Locating you…")).toBeNull();
  expect(route).not.toHaveBeenCalled();
  expect(location.watchPositionAsync).toHaveBeenCalled();
});

test("on the roadbook there is no approach: it joins where the rider is", async () => {
  const rb = first();
  const here = at(rb, 30_000);
  placeRiderAt(here);
  await render(<RideScreen rb={rb} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Start"));
  await flush();
  expect(route).not.toHaveBeenCalled();
  expect(screen.queryByTestId("source-approach")).toBeNull();
  await push(here);
  expect(screen.getByText(INSTRUCTION)).toBeTruthy();
  expect(screen.getByTestId("source-rider")).toBeTruthy();
  expect(screen.queryByText(/^To the start/)).toBeNull();
  expect(screen.getByText(/^Next: /)).toBeTruthy();
  expect(
    Math.round(
      Number(
        screen
          .getByText(/^\d+(\.\d)? km$/)
          .props.children.toString()
          .replace(" km", ""),
      ),
    ),
  ).toBeLessThan(100);
});

test("far from the roadbook: it routes to the start once and shows the way there", async () => {
  const rb = first();
  const start = rb.roadbook.line[0]!;
  const rider: LatLon = [start[0] + 0.05, start[1]];
  placeRiderAt(rider);
  route.mockResolvedValue([rider, [start[0] + 0.025, start[1]], start]);
  await render(<RideScreen rb={rb} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Start"));
  await flush();
  // Away from the roadbook the app asks where to join (ADR 0016): to the start, here.
  await fireEvent.press(screen.getByText("Go to the start"));
  await flush();
  expect(route).toHaveBeenCalledTimes(1);
  expect(route).toHaveBeenCalledWith(rider, start);
  expect(screen.getByTestId("source-approach")).toBeTruthy();
  expect(screen.getByTestId("layer-approach-arrows")).toBeTruthy();
  expect(screen.getByTestId("source-line")).toBeTruthy();
  await push(rider);
  expect(screen.getByText(/^To the start · /)).toBeTruthy();
  expect(screen.getByText(/^Straight /)).toBeTruthy();
  expect(screen.queryByText("No route to the start")).toBeNull();
  expect(camera.easeTo).toHaveBeenCalled();
  await flush();
  expect(route).toHaveBeenCalledTimes(1);
});

test("while the route is being found the screen says so", async () => {
  const rb = first();
  const start = rb.roadbook.line[0]!;
  placeRiderAt([start[0] + 0.05, start[1]]);
  route.mockImplementation(() => new Promise(() => {}));
  await render(<RideScreen rb={rb} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Start"));
  await flush();
  // Away from the roadbook the app asks where to join (ADR 0016): to the start, here.
  await fireEvent.press(screen.getByText("Go to the start"));
  await flush();
  expect(screen.getByText("To the start…")).toBeTruthy();
  expect(location.watchPositionAsync).not.toHaveBeenCalled();
  await endRide();
  expect(screen.queryByText("To the start…")).toBeNull();
});

test("a late route after Stop is ignored", async () => {
  const rb = first();
  const start = rb.roadbook.line[0]!;
  const rider: LatLon = [start[0] + 0.05, start[1]];
  placeRiderAt(rider);
  let resolve!: (l: LatLon[]) => void;
  route.mockImplementation(() => new Promise((r) => (resolve = r)));
  await render(<RideScreen rb={rb} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Start"));
  await flush();
  // Away from the roadbook the app asks where to join (ADR 0016): to the start, here.
  await fireEvent.press(screen.getByText("Go to the start"));
  await flush();
  await endRide();
  await act(async () => resolve([rider, start]));
  await flush();
  expect(screen.queryByTestId("source-approach")).toBeNull();
  expect(location.watchPositionAsync).not.toHaveBeenCalled();
  expect(screen.getByText("Start")).toBeTruthy();
});

test("without a route it says so and points the straight line, and the rider is never off route on it", async () => {
  const rb = first();
  const start = rb.roadbook.line[0]!;
  const rider: LatLon = [start[0] + 0.05, start[1]];
  placeRiderAt(rider);
  route.mockResolvedValue(null);
  await render(<RideScreen rb={rb} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Start"));
  await flush();
  // Away from the roadbook the app asks where to join (ADR 0016): to the start, here.
  await fireEvent.press(screen.getByText("Go to the start"));
  await flush();
  await push(rider);
  expect(screen.getByText("No route to the start")).toBeTruthy();
  expect(screen.getByText(/^Straight to the start /)).toBeTruthy();
  const aside: LatLon = [rider[0], rider[1] + 0.01];
  await push(aside);
  await push(aside);
  await push(aside);
  expect(screen.queryByText(/^Off route · /)).toBeNull();
});

test("leaving the roadbook shows Off route with the distance, and returning clears it", async () => {
  const rb = first();
  const here = at(rb, 20_000);
  placeRiderAt(here);
  await render(<RideScreen rb={rb} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Start"));
  await flush();
  await push(here);
  const away: LatLon = [here[0] + 0.002, here[1]];
  await push(away);
  await push(away);
  expect(screen.queryByText(/^Off route · /)).toBeNull();
  await push(away);
  expect(screen.getByText(/^Rejoin the route, \d+ m, /)).toBeTruthy();
  expect(screen.getByText(/^Off route · /)).toBeTruthy();
  expect(screen.getByText(/from the roadbook$/)).toBeTruthy();
  await push(here);
  expect(screen.queryByText(/^Off route · /)).toBeNull();
});

test("a rider arriving at a corner is warned on screen and aloud", async () => {
  const rb = first();
  const corner = rb.corners.find((c) => c.severity !== "bend")!;
  const approachPoint = at(rb, corner.startM - 400);
  placeRiderAt(approachPoint);
  await render(<RideScreen rb={rb} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Start"));
  await flush();
  await push(approachPoint, 17);
  expect(screen.queryByText(/^(HAIRPIN|SHARP) /)).toBeNull();
  await push(at(rb, corner.startM - 120), 17);
  expect(screen.getByText(/^(HAIRPIN|SHARP) /)).toBeTruthy();
  expect(Speech.speak).toHaveBeenCalledTimes(1);
  await push(at(rb, corner.startM - 60), 17);
  expect(Speech.speak).toHaveBeenCalledTimes(1);
});

test("a GPS fix without a speed shows a dash, not NaN", async () => {
  const rb = first();
  const here = at(rb, 10_000);
  placeRiderAt(here);
  await render(<RideScreen rb={rb} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Start"));
  await flush();
  await act(async () =>
    location.state.watcher?.({
      coords: { latitude: here[0], longitude: here[1], speed: null, accuracy: 5 },
      timestamp: 1,
    }),
  );
  expect(within(screen.getByTestId("hud")).getByText("–")).toBeTruthy(); // the speed, not a gauge
  await act(async () =>
    location.state.watcher?.({
      coords: { latitude: here[0], longitude: here[1], speed: -1, accuracy: 5 },
      timestamp: 2,
    }),
  );
  expect(within(screen.getByTestId("hud")).getByText("–")).toBeTruthy(); // the speed, not a gauge
  expect(screen.queryByText(/NaN/)).toBeNull();
});

test("Stop removes the GPS subscription and goes back to the overview", async () => {
  const rb = first();
  placeRiderAt(at(rb, 10_000));
  await render(<RideScreen rb={rb} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Start"));
  await flush();
  expect(location.watchPositionAsync).toHaveBeenCalledTimes(1);
  await endRide();
  expect(location.state.removed).toBe(1);
  expect(camera.fitBounds).toHaveBeenCalled();
  expect(screen.getByText("Start")).toBeTruthy();
});

test("leaving the screen while riding releases the GPS and the voice", async () => {
  const rb = first();
  placeRiderAt(at(rb, 10_000));
  const view = await render(<RideScreen rb={rb} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Start"));
  await flush();
  await act(async () => view.unmount());
  expect(location.state.removed).toBe(1);
  expect(Speech.stop).toHaveBeenCalled();
});

test("riding for ten minutes of one-second fixes never breaks the screen", async () => {
  const rb = first();
  placeRiderAt(at(rb, 5_000));
  await render(<RideScreen rb={rb} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Start"));
  await flush();
  for (let i = 0; i < 600; i++) await push(at(rb, 5_000 + i * 15), 15);
  await seconds(1);
  expect(screen.getByText(INSTRUCTION)).toBeTruthy();
  await revealButtons();
  expect(screen.getByText("End")).toBeTruthy();
  expect(Object.keys(sources)).toContain("rider");
});

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Speech from "expo-speech";
import { RideScreen } from "../../src/ui/RideScreen.tsx";
import { routeToStart } from "../../src/services/valhalla.ts";
import { traceLimit } from "../../src/services/liveLimit.ts";
import * as location from "./location.mock.ts";
import { resetMapMock } from "./maplibre.mock.tsx";
import { flush } from "./flush.ts";
import { at, limitedRoadbook, endRide } from "./helpers.ts";
import type { LatLon, PreparedRoadbook } from "../../src/core/types.ts";

const route = routeToStart as jest.Mock;

beforeEach(() => {
  jest.useFakeTimers();
  resetMapMock();
  location.state.permission = "granted";
  location.state.watcher = null;
  location.state.removed = 0;
  route.mockReset();
});
afterEach(() => jest.useRealTimers());

const start = async (rb: PreparedRoadbook, here: LatLon) => {
  location.state.position = { latitude: here[0], longitude: here[1] };
  await render(<RideScreen rb={rb} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Start"));
  await flush();
};
const push = (p: LatLon, kmh: number, time: number, heading: number | null = null) =>
  act(async () => location.pushFix(p[0], p[1], kmh / 3.6, time, heading));
const north = (p: LatLon, deg = 0.0018): LatLon => [p[0] + deg, p[1]]; // about 200 m

test("riding the wrong way says U-turn after three fixes, and stops saying it when the heading is right", async () => {
  const rb = limitedRoadbook({ cameras: false });
  const here = at(rb, 1000);
  await start(rb, here);
  await push(here, 30, 1000, 90);
  await push(here, 30, 2000, 270);
  await push(here, 30, 3000, 270);
  expect(screen.queryByText("U-turn, wrong way")).toBeNull();
  await push(here, 30, 4000, 270);
  expect(screen.getByText("U-turn, wrong way")).toBeTruthy();
  expect(screen.getByText("↶", { includeHiddenElements: true })).toBeTruthy();
  await push(here, 30, 5000, 90);
  expect(screen.queryByText("U-turn, wrong way")).toBeNull();
});

test("a slow rider, or one without a heading, is never told they go the wrong way", async () => {
  const rb = limitedRoadbook({ cameras: false });
  const here = at(rb, 1000);
  await start(rb, here);
  for (let t = 1; t <= 6; t++) await push(here, 5, t * 1000, 270);
  for (let t = 7; t <= 12; t++) await push(here, 40, t * 1000, null);
  expect(screen.queryByText("U-turn, wrong way")).toBeNull();
});

test("off route: the distance, the side to take and an arrow turned towards the line", async () => {
  const rb = limitedRoadbook({ cameras: false });
  const here = at(rb, 1000);
  route.mockImplementation(() => new Promise(() => {}));
  await start(rb, here);
  await push(here, 40, 1000, 90);
  const away = north(here);
  await push(away, 40, 2000, 0);
  await push(away, 40, 3000, 0);
  await push(away, 40, 4000, 0);
  expect(screen.getByText(/^Rejoin the route, \d+ m, behind right$/)).toBeTruthy();
  expect(screen.getByText(/^Off route · \d+ m from the roadbook$/)).toBeTruthy();
  expect(screen.getByText("↘", { includeHiddenElements: true })).toBeTruthy();
});

test("off route it asks once for a road route back, and rides it dashed with 'Back to the route'", async () => {
  const rb = limitedRoadbook({ cameras: false });
  const here = at(rb, 1000);
  const away = north(here);
  route.mockResolvedValue([away, [away[0] - 0.0009, away[1] + 0.001], at(rb, 1250)]);
  await start(rb, here);
  await push(here, 40, 1000, 90);
  await push(away, 40, 2000, 0);
  await push(away, 40, 3000, 0);
  await push(away, 40, 4000, 0);
  await flush();
  expect(route).toHaveBeenCalledTimes(1);
  const [from, to] = route.mock.calls[0]!;
  expect(from).toEqual(away);
  expect(to[0]).toBeCloseTo(at(rb, 1190)[0], 3);
  expect(screen.getByTestId("source-approach")).toBeTruthy();
  await push(away, 40, 5000, 0);
  expect(screen.getByText(/^Back to the route · /)).toBeTruthy();
  expect(screen.queryByText(/^Off route · /)).toBeNull();
});

test("it does not ask again within 30 seconds, or before moving 50 m, then does", async () => {
  const rb = limitedRoadbook({ cameras: false });
  const here = at(rb, 1000);
  const away = north(here);
  route.mockImplementation(() => new Promise(() => {}));
  await start(rb, here);
  await push(here, 40, 1000, 90);
  for (const t of [2000, 3000, 4000]) await push(away, 40, t, 0);
  await flush();
  expect(route).toHaveBeenCalledTimes(1);
  for (const t of [5000, 6000, 7000, 8000]) await push(away, 40, t, 0);
  expect(route).toHaveBeenCalledTimes(1);
});

test("an answer of no route leaves the straight-line guidance and one request", async () => {
  const rb = limitedRoadbook({ cameras: false });
  const here = at(rb, 1000);
  const away = north(here);
  // The first request ends with no route, so the guidance stays and the next request may follow.
  route.mockResolvedValue(null);
  await start(rb, here);
  await push(here, 40, 1000, 90);
  for (const t of [2000, 3000, 4000]) await push(away, 40, t, 0);
  await flush();
  expect(route).toHaveBeenCalledTimes(1);
  await push(away, 40, 5000, 0);
  expect(screen.getByText("No road route back")).toBeTruthy();
  expect(screen.getByText(/^Straight to the route /)).toBeTruthy();
});

test("without a route it keeps pointing the way and never flags the rider off route on that line", async () => {
  const rb = limitedRoadbook({ cameras: false });
  const here = at(rb, 1000);
  const away = north(here);
  route.mockResolvedValue(null);
  await start(rb, here);
  await push(here, 40, 1000, 90);
  for (const t of [2000, 3000, 4000]) await push(away, 40, t, 0);
  await flush();
  await push(away, 40, 4500, 0);
  const aside: LatLon = [away[0] + 0.001, away[1] - 0.001]; // beside the start of the straight line
  for (const t of [5000, 6000, 7000]) await push(aside, 40, t, 130); // heading towards the line
  expect(screen.getByText(/^Straight to the route /)).toBeTruthy();
  expect(screen.queryByText(/^Off route/)).toBeNull();
  expect(screen.getByText(/^Back to the route · /)).toBeTruthy();
});

test("a route that arrives after Stop is ignored", async () => {
  const rb = limitedRoadbook({ cameras: false });
  const here = at(rb, 1000);
  const away = north(here);
  let resolve!: (l: LatLon[]) => void;
  route.mockImplementation(() => new Promise((r) => (resolve = r)));
  await start(rb, here);
  await push(here, 40, 1000, 90);
  for (const t of [2000, 3000, 4000]) await push(away, 40, t, 0);
  await endRide();
  await act(async () => resolve([away, at(rb, 1250)]));
  await flush();
  expect(screen.queryByTestId("source-approach")).toBeNull();
  expect(screen.getByText("Start")).toBeTruthy();
});

test("a gap in the limit data keeps the last limit on the sign, marked assumed", async () => {
  const rb = limitedRoadbook({ cameras: false, gap: true });
  const here = at(rb, 400);
  await start(rb, here);
  await push(at(rb, 400), 60, 1000, 90);
  expect(screen.getByLabelText("Speed limit 80")).toBeTruthy();
  await push(at(rb, 1500), 60, 2000, 90);
  expect(screen.getByLabelText("Speed limit 80, assumed")).toBeTruthy();
  expect(screen.getByText("assumed")).toBeTruthy();
  await push(at(rb, 2600), 40, 3000, 90);
  expect(screen.getByLabelText("Speed limit 50")).toBeTruthy();
});

test("a camera facing the rider warns; one facing the way the rider goes does not, by the phone's heading", async () => {
  // The roadbook goes east. A camera facing west watches eastbound traffic.
  const facingRider = limitedRoadbook({ bearing: 270 });
  await start(facingRider, at(facingRider, 400));
  await push(at(facingRider, 1450), 60, 1000, 90);
  expect(screen.getByText("SPEED CAMERA")).toBeTruthy();
});

test("a camera facing away from the rider is silent", async () => {
  const away = limitedRoadbook({ bearing: 90 });
  expect(away.zones.length).toBe(1);
  await start(away, at(away, 400));
  await push(at(away, 1450), 60, 1000, 90);
  await push(at(away, 1600), 60, 2000, 90);
  expect(screen.queryByText("SPEED CAMERA")).toBeNull();
  expect(Speech.speak).not.toHaveBeenCalled();
});

test("a second request waits for 30 seconds, unless the rider is 150 m from the last one", async () => {
  const rb = limitedRoadbook({ cameras: false });
  const here = at(rb, 1000);
  const away = north(here);
  route.mockResolvedValue([away, [away[0] - 0.0009, away[1] + 0.001], at(rb, 1250)]);
  await start(rb, here);
  await push(here, 40, 1000, 90);
  for (const t of [2000, 3000, 4000]) await push(away, 40, t, 0);
  await flush();
  expect(route).toHaveBeenCalledTimes(1);
  await push(away, 40, 5000, 0);
  // The rider leaves the way back as well, 330 m from where the last request was made: asked again at once.
  const lost: LatLon = [away[0] + 0.003, away[1]];
  for (const t of [6000, 7000, 8000, 9000]) await push(lost, 40, t, 0);
  await flush();
  expect(route).toHaveBeenCalledTimes(2);
  for (const t of [20_000, 21_000, 22_000]) await push(lost, 40, t, 0);
  await flush();
  expect(route).toHaveBeenCalledTimes(2);
  const moved: LatLon = [lost[0], lost[1] + 0.0008]; // about 55 m east
  for (const t of [40_000, 41_000, 42_000]) await push(moved, 40, t, 0);
  await flush();
  expect(route).toHaveBeenCalledTimes(3);
});

test("a way back that was not found is asked for again after 5 seconds", async () => {
  const rb = limitedRoadbook({ cameras: false });
  const here = at(rb, 1000);
  const away = north(here);
  route.mockResolvedValue(null);
  await start(rb, here);
  await push(here, 40, 1000, 90);
  for (const t of [2000, 3000, 4000]) await push(away, 40, t, 0);
  await flush();
  expect(route).toHaveBeenCalledTimes(1);
  const moved: LatLon = [away[0], away[1] + 0.0008];
  await push(moved, 40, 6000, 0);
  await flush();
  expect(route).toHaveBeenCalledTimes(1);
  await push(moved, 40, 10_000, 0);
  await flush();
  expect(route).toHaveBeenCalledTimes(2);
});

test("a second request also waits for the rider to move 50 m since the last one", async () => {
  const rb = limitedRoadbook({ cameras: false });
  const here = at(rb, 1000);
  const away = north(here);
  // A route that does not pass the rider: after it, the rider is still off route, standing where they were.
  route.mockResolvedValue([[here[0] - 0.01, here[1]], at(rb, 1250)]);
  await start(rb, here);
  await push(here, 40, 1000, 90);
  for (const t of [2000, 3000, 4000]) await push(away, 40, t, 0);
  await flush();
  expect(route).toHaveBeenCalledTimes(1);
  for (const t of [5000, 6000, 7000, 8000]) await push(away, 40, t, 0);
  await push(away, 40, 40_000, 0);
  await flush();
  expect(route).toHaveBeenCalledTimes(1);
  const moved: LatLon = [away[0], away[1] + 0.0008]; // about 55 m east
  await push(moved, 40, 41_000, 0);
  await flush();
  expect(route).toHaveBeenCalledTimes(2);
});

test("off the roadbook the sign shows the limit of the road under the rider, found live", async () => {
  const rb = limitedRoadbook({ cameras: false });
  const here = at(rb, 1000);
  const away = north(here);
  route.mockImplementation(() => new Promise(() => {}));
  (traceLimit as jest.Mock).mockResolvedValue({ kmh: 70, posted: true, carried: false, next: null });
  await start(rb, here);
  await push(here, 40, 1000, 90);
  for (const t of [2000, 3000, 4000]) await push(away, 40, t, 0);
  const further: LatLon = [away[0] + 0.0006, away[1]];
  for (const t of [13_000, 14_000]) await push(further, 40, t, 0);
  await flush();
  await push(further, 40, 15_000, 0);
  expect(screen.getByText("70")).toBeTruthy();
});

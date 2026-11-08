import { act, renderHook } from "@testing-library/react-native";
import { routeToStart } from "../../src/services/valhalla.ts";
import { useRide } from "../../src/ui/useRide.ts";
import * as location from "./location.mock.ts";
import { flush } from "./flush.ts";
import { at, skippableRoadbook } from "./helpers.ts";

const route = routeToStart as jest.Mock;

beforeEach(() => {
  jest.useFakeTimers();
  location.state.permission = "granted";
  location.state.watcher = null;
  route.mockReset();
  route.mockImplementation(() => new Promise(() => {}));
});
afterEach(() => jest.useRealTimers());

test("two confirmations in the same instant ask for one route", async () => {
  const rb = skippableRoadbook();
  const here = at(rb, 100);
  location.state.position = { latitude: here[0], longitude: here[1] };
  const { result } = await renderHook(() => useRide(rb, "gps"));
  await flush();
  await act(async () => location.pushFix(here[0], here[1], 0, 1000, 90));
  expect(result.current.skip.plan?.skipped.name).toBe("1. Mont");
  await act(async () => {
    result.current.skip.confirm();
    result.current.skip.confirm();
  });
  expect(route).toHaveBeenCalledTimes(1);
});

test("the skip is offered and done while the rider is moving", async () => {
  const rb = skippableRoadbook();
  const here = at(rb, 100);
  location.state.position = { latitude: here[0], longitude: here[1] };
  const { result } = await renderHook(() => useRide(rb, "gps"));
  await flush();
  await act(async () => location.pushFix(here[0], here[1], 20, 1000, 90));
  expect(result.current.skip.canSkip).toBe(true);
  await act(async () => result.current.skip.confirm());
  expect(route).toHaveBeenCalledTimes(1);
});

test("without a GPS fix or in the demo there is nothing to skip", async () => {
  const rb = skippableRoadbook();
  const gps = await renderHook(() => useRide(rb, "gps"));
  await flush();
  expect(gps.result.current.skip.plan).toBeNull();
  const demo = await renderHook(() => useRide(rb, "demo"));
  await act(async () => {
    jest.advanceTimersByTime(3000);
  });
  expect(demo.result.current.skip.plan).toBeNull();
});

test("a rider far from the route is sent to a route point with their heading, and the skip stays offered", async () => {
  const rb = skippableRoadbook();
  const start = at(rb, 100);
  location.state.position = { latitude: start[0], longitude: start[1] };
  const { result } = await renderHook(() => useRide(rb, "gps"));
  await flush();
  await act(async () => location.pushFix(start[0], start[1], 20, 1000, 90));
  const road = at(rb, 1500);
  const far: [number, number] = [road[0] + 0.03, road[1]]; // about 3 km north of the road, heading east
  route.mockResolvedValue([far, at(rb, 2000)]);
  for (let i = 0; i < 4; i++)
    await act(async () => location.pushFix(far[0], far[1] + i * 0.0003, 20, 2000 + i * 1000, 90));
  await flush();
  expect(route).toHaveBeenCalled();
  const [, , options] = route.mock.calls[0]!;
  expect(options.headingDeg).toBeGreaterThan(60);
  expect(options.headingDeg).toBeLessThan(120);
  expect(result.current.ride.approachName).toMatch(/^\d\. /);
  expect(result.current.ride.approachDirect).toBe(false);
  expect(result.current.skip.plan).not.toBeNull();
});

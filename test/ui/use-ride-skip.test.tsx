import { act, renderHook } from "@testing-library/react-native";
import { routeToStart } from "../../src/services/valhalla.ts";
import { useRide } from "../../src/ui/useRide.ts";
import * as location from "./location.mock.ts";
import { flush } from "./flush.ts";
import { at, skippableRoadbook } from "./helpers.ts";
import { resetServerSetting, saveServer } from "../../src/ui/serverSetting.ts";

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

test("a rider who leaves the way back asks for another at once, not after the wait of the last one", async () => {
  const rb = skippableRoadbook();
  const start = at(rb, 100);
  location.state.position = { latitude: start[0], longitude: start[1] };
  const { result } = await renderHook(() => useRide(rb, "gps"));
  await flush();
  await act(async () => location.pushFix(start[0], start[1], 20, 1000, 90));
  const road = at(rb, 1500);
  const far: [number, number] = [road[0] + 0.03, road[1]];
  const back = at(rb, 2000);
  route.mockResolvedValue([far, back]);
  for (let i = 0; i < 4; i++) await act(async () => location.pushFix(far[0], far[1], 20, 2000 + i * 1000, 90));
  await flush();
  expect(route).toHaveBeenCalledTimes(1);
  expect(result.current.ride.approachM).toBeGreaterThan(0);
  // On the way back for a few seconds, then 120 m beside it: off it again, well within the 30 s of the last request.
  for (let i = 0; i < 2; i++) await act(async () => location.pushFix(far[0], far[1], 20, 7000 + i * 1000, 90));
  const beside: [number, number] = [far[0], far[1] + 0.0016];
  for (let i = 0; i < 4; i++) await act(async () => location.pushFix(beside[0], beside[1], 20, 9000 + i * 1000, 90));
  await flush();
  expect(route.mock.calls.length).toBeGreaterThanOrEqual(2);
});

test("the way back is asked of the rider's server, with its token", async () => {
  resetServerSetting();
  await saveServer({ url: "https://ride.example.org", token: "mrt_abc" });
  const rb = skippableRoadbook();
  const start = at(rb, 100);
  location.state.position = { latitude: start[0], longitude: start[1] };
  await renderHook(() => useRide(rb, "gps"));
  await flush();
  await act(async () => location.pushFix(start[0], start[1], 20, 1000, 90));
  const road = at(rb, 1500);
  const far: [number, number] = [road[0] + 0.03, road[1]];
  for (let i = 0; i < 4; i++) await act(async () => location.pushFix(far[0], far[1], 20, 2000 + i * 1000, 90));
  await flush();
  expect(route).toHaveBeenCalled();
  expect(route.mock.calls[0]![2].server).toEqual({ url: "https://ride.example.org", token: "mrt_abc" });
  resetServerSetting();
});

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

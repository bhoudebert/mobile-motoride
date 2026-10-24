import { act } from "@testing-library/react-native";

/** Let pending promises (permission, position, route) settle. */
export async function flush(times = 6) {
  for (let i = 0; i < times; i++) await act(async () => {});
}

/**
 * Advance fake timers one second at a time, so each tick re-renders like on a phone. A long ride that only needs to get
 * somewhere takes `step` seconds per render instead (the timers still fire every second inside it).
 */
export async function seconds(n: number, step = 1) {
  for (let i = 0; i < n; i += step)
    await act(async () => {
      jest.advanceTimersByTime(Math.min(step, n - i) * 1000);
    });
}

/** Ride on one second at a time until `done()`, failing after `max` seconds. Returns the seconds it took. */
export async function until(done: () => boolean, max = 120): Promise<number> {
  for (let i = 1; i <= max; i++) {
    await seconds(1);
    if (done()) return i;
  }
  throw new Error(`not reached within ${max} s`);
}

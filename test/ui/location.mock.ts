/** Fake expo-location: the test decides the permission, the first position and pushes the fixes. */
export const state = {
  permission: "granted" as "granted" | "denied",
  position: { latitude: 50.45, longitude: 3.2 } as { latitude: number; longitude: number } | null,
  watcher: null as ((loc: any) => void) | null,
  removed: 0,
};

export const Accuracy = { Balanced: 3, BestForNavigation: 6 };

export const requestForegroundPermissionsAsync = jest.fn(async () => ({ status: state.permission }));
export const getCurrentPositionAsync = jest.fn(async () => {
  if (!state.position) throw new Error("no position");
  return { coords: { ...state.position, speed: 0, accuracy: 5 }, timestamp: Date.now() };
});
export const getLastKnownPositionAsync = jest.fn(async () =>
  state.position ? { coords: { ...state.position, speed: 0, accuracy: 5 }, timestamp: 0 } : null,
);
export const watchPositionAsync = jest.fn(async (_opts: unknown, cb: (loc: any) => void) => {
  state.watcher = cb;
  return {
    remove: () => {
      state.removed++;
      // Like the real service: a removed subscription gets no more fixes.
      if (state.watcher === cb) state.watcher = null;
    },
  };
});

export function pushFix(
  latitude: number,
  longitude: number,
  speed = 15,
  timestamp = Date.now(),
  heading: number | null = null,
  altitude: number | null = null,
) {
  state.watcher?.({ coords: { latitude, longitude, speed, accuracy: 5, heading, altitude }, timestamp });
}

/** The foreground service: the test reads whether it runs and with what notification. */
export const service = { running: false, options: null as any, fail: false };
export const hasStartedLocationUpdatesAsync = jest.fn(async () => service.running);
export const startLocationUpdatesAsync = jest.fn(async (_task: string, options: unknown) => {
  if (service.fail) throw new Error("foreground service refused");
  service.running = true;
  service.options = options;
});
export const stopLocationUpdatesAsync = jest.fn(async () => {
  service.running = false;
});

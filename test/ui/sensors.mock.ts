/** Fake expo-sensors: the test pushes accelerometer (g) and gyroscope (rad/s) readings to whoever listens. */
type Reading = { x: number; y: number; z: number };

function sensor() {
  const listeners = new Set<(r: Reading) => void>();
  return {
    listeners,
    setUpdateInterval: jest.fn(),
    addListener: jest.fn((l: (r: Reading) => void) => {
      listeners.add(l);
      return { remove: () => listeners.delete(l) };
    }),
    emit: (r: Reading) => listeners.forEach((l) => l(r)),
  };
}

export const Accelerometer = sensor();
export const Gyroscope = sensor();

export function resetSensors() {
  for (const s of [Accelerometer, Gyroscope]) {
    s.listeners.clear();
    s.addListener.mockClear();
    s.setUpdateInterval.mockClear();
  }
}

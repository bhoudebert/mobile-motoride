// Native modules that do not exist under Jest (spec: UI tests drive the real screens on fakes).
jest.mock("expo-keep-awake", () => ({ useKeepAwake: () => {} }));
jest.mock("expo-speech", () => ({ speak: jest.fn(), stop: jest.fn() }));
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("expo-splash-screen", () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock("expo-font", () => ({ useFonts: () => [true, null], isLoaded: () => true, loadAsync: async () => {} }));
jest.mock("../../src/services/valhalla.ts", () => ({ routeToStart: jest.fn() }));
jest.mock("expo-file-system", () => require("./filesystem.mock.ts"));
jest.mock("expo-document-picker", () => require("./picker.mock.ts"));
// The services that complete a GPX are asked in the tests that import one; the real ones would need the network.
jest.mock("../../src/services/enrich.ts", () => ({
  ...jest.requireActual("../../src/services/enrich.ts"),
  enrichRoadbook: jest.fn(),
}));
jest.mock("expo-sharing", () => require("./sharing.mock.ts"));
jest.mock("expo-secure-store", () => require("./securestore.mock.ts"));
jest.mock("expo-crypto", () => ({
  getRandomBytes: (n: number) => new Uint8Array(require("node:crypto").randomBytes(n)),
}));
jest.mock("expo-task-manager", () => ({ defineTask: jest.fn() }));
jest.mock("expo-location", () => require("./location.mock.ts"));
jest.mock("expo-sensors", () => require("./sensors.mock.ts"));
jest.mock("@maplibre/maplibre-react-native", () => require("./maplibre.mock.tsx"));

// The basemap is checked for reachability with one request per choice: reachable by default, a test says otherwise.
(globalThis as { fetch: unknown }).fetch = jest.fn(() => Promise.resolve({ ok: true }));

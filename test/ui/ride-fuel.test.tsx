import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import * as Speech from "expo-speech";
import { setLanguage } from "../../src/core/i18n/index.ts";
import { RideScreen } from "../../src/ui/RideScreen.tsx";
import { dirs, files, resetFiles } from "./filesystem.mock.ts";
import * as location from "./location.mock.ts";
import { layers, resetMapMock, sources } from "./maplibre.mock.tsx";
import { flush } from "./flush.ts";
import { at, first } from "./helpers.ts";
import type { LatLon } from "../../src/core/types.ts";

// Spec fuel-stops: the stations along the roadbook, the next one on the ride screen, a word before a long stretch without fuel.
const fetchMock = globalThis.fetch as unknown as jest.Mock;
const speak = Speech.speak as jest.Mock;
const said = () => speak.mock.calls.map((c) => c[0] as string);

/** An Overpass that answers every query with these stations (asked for 122 km of route in pieces: each returns them all). */
const stations = (metres: number[], tags: Record<number, Record<string, string>> = {}) => {
  const rb = first();
  fetchMock.mockImplementation(async (url: string) => {
    if (!String(url).includes("overpass")) return { ok: true };
    const elements = metres.map((m, i) => {
      const [lat, lon]: LatLon = at(rb, m);
      return { type: "node", id: i + 1, lat, lon, tags: tags[i] ?? {} };
    });
    return { ok: true, json: async () => ({ elements }) };
  });
};
const offline = () => fetchMock.mockImplementation(async () => Promise.reject(new TypeError("Network request failed")));

beforeEach(async () => {
  jest.useFakeTimers();
  resetMapMock();
  resetFiles();
  speak.mockClear();
  await AsyncStorage.clear();
  setLanguage("en");
  location.state.permission = "granted";
  location.state.watcher = null;
});
afterEach(() => {
  jest.useRealTimers();
  setLanguage("en");
  fetchMock.mockImplementation(() => Promise.resolve({ ok: true }));
});

const open = async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await flush(30);
};

test("the stations along the roadbook are on the map, and the chip names the next one", async () => {
  stations([10_000, 60_000, 100_000], { 0: { name: "Station Dupont" } });
  await open();
  expect((sources["fuel"] as any).features).toHaveLength(3);
  expect(layers["fuel"].layout["icon-image"]).toBe("pump");
  expect(screen.getByLabelText(/^Next fuel stop in 10\.0 km\. Open the fuel stops$/)).toBeTruthy();
});

test("the card lists the stations, the longest stretch and the range, and the range goes round and is kept", async () => {
  stations([10_000, 60_000, 100_000], { 0: { name: "Station Dupont" }, 1: { brand: "Esso" } });
  await open();
  await fireEvent.press(screen.getByTestId("fuel-chip"));
  const card = within(screen.getByTestId("sheet"));
  expect(card.getByText("Fuel stops")).toBeTruthy();
  expect(card.getByText(/^3 stations on the way · Longest stretch without fuel: /)).toBeTruthy();
  expect(card.getByText("Station Dupont")).toBeTruthy();
  expect(card.getByText("Esso")).toBeTruthy();
  expect(card.getByText("Fuel station")).toBeTruthy();
  expect(card.getAllByText(/on the route$/).length).toBe(3);
  expect(card.queryByText(/80 % of your range/)).toBeNull();

  const range = () => card.getByLabelText(/^Tank range: \d+ km\. Tap to change$/);
  expect(range().props.accessibilityLabel).toBe("Tank range: 200 km. Tap to change");
  await fireEvent.press(range());
  expect(range().props.accessibilityLabel).toBe("Tank range: 250 km. Tap to change");
  expect(await AsyncStorage.getItem("fuel-range")).toBe("250");
  await fireEvent.press(card.getByLabelText("Close"));
  expect(screen.queryByTestId("sheet")).toBeNull();
});

test("a stretch longer than 80 % of the range is a warning on the card", async () => {
  await AsyncStorage.setItem("fuel-range", "100");
  stations([100_000]);
  await open();
  await fireEvent.press(screen.getByTestId("fuel-chip"));
  const card = within(screen.getByTestId("sheet"));
  expect(card.getByText("That is more than 80 % of your range: plan a stop.")).toBeTruthy();
});

test("no station along the route says so on the chip and on the card", async () => {
  stations([]);
  await open();
  expect(screen.getByLabelText(/^No fuel station found on this route/)).toBeTruthy();
  expect(sources["fuel"]).toBeUndefined();
  await fireEvent.press(screen.getByTestId("fuel-chip"));
  expect(within(screen.getByTestId("sheet")).getByText("No fuel station found along this route.")).toBeTruthy();
});

test("with no network the ride goes on, the chip says the stations are not loaded, and Try again asks again", async () => {
  offline();
  await open();
  for (let i = 0; i < 8; i++) {
    await act(async () => {
      jest.advanceTimersByTime(2500); // the pauses between servers
    });
    await flush();
  }
  expect(screen.getByLabelText("Fuel stops not loaded. Open the fuel stops")).toBeTruthy();
  expect(screen.getByText("Start")).toBeTruthy();
  await fireEvent.press(screen.getByTestId("fuel-chip"));
  const card = within(screen.getByTestId("sheet"));
  expect(card.getByText("Fuel stops could not be loaded. Check the network.")).toBeTruthy();
  stations([10_000]);
  await fireEvent.press(card.getByLabelText("Try again"));
  await flush(30);
  expect(within(screen.getByTestId("sheet")).getByText(/^1 station on the way/)).toBeTruthy();
});

test("the stations are kept on the phone and not asked for again within a month", async () => {
  stations([10_000, 60_000]);
  await open();
  const kept = [...files.keys()].filter((k) => k.includes("/pois/fuel-"));
  expect(kept).toHaveLength(1);
  expect(dirs.has("file:///document/pois")).toBe(true);
  const asked = fetchMock.mock.calls.filter((c) => String(c[0]).includes("overpass")).length;
  expect(asked).toBeGreaterThan(0);
  fetchMock.mockClear();
  offline();
  // A new screen on the same roadbook reads them from the phone, with no network at all.
  await act(async () => {
    screen.unmount();
  });
  await open();
  expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes("overpass"))).toHaveLength(0);
  expect((sources["fuel"] as any).features).toHaveLength(2);
});

test("a list kept for more than a month is asked for again", async () => {
  stations([10_000]);
  await open();
  const key = [...files.keys()].find((k) => k.includes("/pois/fuel-"))!;
  const old = JSON.parse(files.get(key)!);
  files.set(key, JSON.stringify({ ...old, at: Date.now() - 31 * 86_400_000 }));
  await act(async () => {
    screen.unmount();
  });
  fetchMock.mockClear();
  stations([10_000, 20_000]);
  await open();
  expect(fetchMock.mock.calls.filter((c) => String(c[0]).includes("overpass")).length).toBeGreaterThan(0);
  expect((sources["fuel"] as any).features).toHaveLength(2);
});

/** The rider stands on the roadbook at `m` before Start, so the ride joins there. */
const standAt = (m: number) => {
  const [lat, lon] = at(first(), m);
  location.state.position = { latitude: lat, longitude: lon };
};

/** Riding: a fix on the roadbook at `m`. */
const ride = async (m: number) => {
  const [lat, lon] = at(first(), m);
  await act(async () => location.pushFix(lat, lon, 20, Date.now()));
};

test("a station before a long stretch without fuel is said once, 3 km before it, in Full and in Alerts", async () => {
  await AsyncStorage.setItem("fuel-range", "100");
  stations([10_000, 100_000]);
  standAt(1_000);
  await open();
  await fireEvent.press(screen.getByText("Start"));
  await flush(30);
  await ride(2_000);
  expect(said().filter((s) => /^Fuel stop in/.test(s))).toEqual([]);
  await ride(7_500);
  const fuelSaid = () => said().filter((s) => /^(Fuel stop in|Last fuel stop in)/.test(s));
  expect(fuelSaid()).toEqual(["Fuel stop in 2.5 km. The next one is 90.0 km after it."]);
  await ride(8_000);
  await ride(9_000);
  expect(fuelSaid()).toHaveLength(1);
});

test("the last station, with a long stretch to the finish, says so", async () => {
  await AsyncStorage.setItem("fuel-range", "100");
  stations([10_000]);
  standAt(1_000);
  await open();
  await fireEvent.press(screen.getByText("Start"));
  await flush(30);
  await ride(7_500);
  expect(said().filter((s) => /^Last fuel stop/.test(s))).toHaveLength(1);
  expect(said().find((s) => /^Last fuel stop/.test(s))).toMatch(
    /^Last fuel stop in 2\.5 km\. 11\d km to the finish\.$/,
  );
});

test("Alerts still says it, and Off says nothing", async () => {
  await AsyncStorage.setItem("fuel-range", "100");
  stations([10_000, 100_000]);
  await AsyncStorage.setItem("voice-mode", "off");
  standAt(1_000);
  await open();
  await fireEvent.press(screen.getByText("Start"));
  await flush(30);
  await ride(7_500);
  expect(said().filter((s) => /^Fuel stop in/.test(s))).toEqual([]);
});

test("the fuel chip, card and words are in French in French", async () => {
  setLanguage("fr");
  await AsyncStorage.setItem("fuel-range", "100");
  stations([10_000, 100_000], { 0: { name: "Station Dupont" } });
  await AsyncStorage.setItem("language", "fr");
  await open();
  expect(screen.getByLabelText(/^Prochaine station-service dans 10,0 km\. Ouvrir les stations-service$/)).toBeTruthy();
  await fireEvent.press(screen.getByTestId("fuel-chip"));
  const card = within(screen.getByTestId("sheet"));
  expect(card.getByText("Stations-service")).toBeTruthy();
  expect(card.getByText(/^2 stations sur le trajet · Plus longue étape sans carburant : /)).toBeTruthy();
  expect(card.getByLabelText("Autonomie : 100 km. Touchez pour changer")).toBeTruthy();
});

test("the next fuel stop stands in the panel over the distance left, not among the chips on the map", async () => {
  stations([10_000]);
  await open();
  expect(within(screen.getByTestId("hud")).getByTestId("fuel-chip")).toBeTruthy();
});

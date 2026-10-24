import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import * as Speech from "expo-speech";
import { setLanguage } from "../../src/core/i18n/index.ts";
import { clearForecasts } from "../../src/services/weather.ts";
import { samplePoints } from "../../src/core/weather.ts";
import { RideScreen } from "../../src/ui/RideScreen.tsx";
import { resetFiles } from "./filesystem.mock.ts";
import * as location from "./location.mock.ts";
import { resetMapMock } from "./maplibre.mock.tsx";
import { flush } from "./flush.ts";
import { at, first } from "./helpers.ts";

// Spec weather: the forecast on the next 60 km of the roadbook, at the time the rider will be there.
const fetchMock = globalThis.fetch as unknown as jest.Mock;
const speak = Speech.speak as jest.Mock;
const said = () => speak.mock.calls.map((c) => c[0] as string);
const H = 3_600_000;

interface Sky {
  precip?: number;
  temp?: number;
  symbol?: string;
}
const keyOf = (lat: number, lon: number) => `${lat.toFixed(2)},${lon.toFixed(2)}`;

/** A MET Norway that answers by place: the sky at each of the points 0, 15, 30, 45 and 60 km along the roadbook. */
const skies = (byPoint: Sky[], fromM = 0) => {
  const rb = first();
  const pts = samplePoints(rb.roadbook.line, rb.cumulativeM, fromM, rb.totalM, null, Date.now());
  const sky = new Map(pts.map((p, i) => [keyOf(p.lat, p.lon), byPoint[Math.min(i, byPoint.length - 1)] ?? {}]));
  fetchMock.mockImplementation(async (url: string) => {
    if (!String(url).includes("api.met.no")) return { ok: true };
    const u = new URL(String(url));
    const s = sky.get(keyOf(Number(u.searchParams.get("lat")), Number(u.searchParams.get("lon")))) ?? {};
    const start = Math.floor(Date.now() / H) * H - 2 * H;
    const timeseries = Array.from({ length: 8 }, (_, i) => ({
      time: new Date(start + i * H).toISOString(),
      data: {
        instant: { details: { air_temperature: s.temp ?? 12, wind_speed: 5 } },
        next_1_hours: {
          summary: { symbol_code: s.symbol ?? "cloudy" },
          details: { precipitation_amount: s.precip ?? 0 },
        },
      },
    }));
    return { ok: true, headers: { get: () => null }, json: async () => ({ properties: { timeseries } }) };
  });
};
const metCalls = () => fetchMock.mock.calls.filter((c) => String(c[0]).includes("api.met.no"));

beforeEach(async () => {
  jest.useFakeTimers();
  resetMapMock();
  resetFiles();
  clearForecasts();
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
const row = () => screen.getByTestId("weather-row");
const card = () => within(screen.getByTestId("sheet"));

test("a dry route says so, with the temperature here", async () => {
  skies([{ temp: 14 }]);
  await open();
  expect(row().props.accessibilityLabel).toBe("Dry for the next 60.0 km · 14 °C. Open the weather");
  expect(metCalls()).toHaveLength(5);
  expect(metCalls()[0]![1]).toMatchObject({
    headers: expect.objectContaining({ "User-Agent": expect.stringMatching(/^MobileMotoRide\//) }),
  });
});

test("rain coming is on the row with its distance, and the card lists the places with the time, the sky, the rain and the wind", async () => {
  skies([{}, {}, { precip: 1.8, temp: 9 }, { precip: 3, temp: 9 }, { precip: 0 }]);
  await open();
  expect(row().props.accessibilityLabel).toBe("Rain in 30.0 km · 12 °C. Open the weather");
  await fireEvent.press(row());
  const c = card();
  expect(c.getByText("Weather ahead")).toBeTruthy();
  expect(c.getByText("Here")).toBeTruthy();
  expect(c.getByText("in 30.0 km")).toBeTruthy();
  expect(c.getByText(/· Rain · 9 °C · 1\.8 mm\/h · wind 18 km\/h$/)).toBeTruthy();
  expect(c.getByText("Weather data: MET Norway")).toBeTruthy();
  expect(c.getAllByText(/· Cloudy|· Dry/).length).toBeGreaterThan(0);
});

test("when it is raining here the row says when it clears", async () => {
  skies([{ precip: 2 }, { precip: 2 }, {}, {}, {}]);
  await open();
  expect(row().props.accessibilityLabel).toBe("Rain here, clear in 30.0 km · 12 °C. Open the weather");
});

test("rain on a cold road is named for what it is, and a drizzle is not a warning", async () => {
  skies([{ precip: 1, temp: 1 }, {}, {}, {}, {}]);
  await open();
  expect(row().props.accessibilityLabel).toMatch(/^Rain on a cold road here, clear in 15\.0 km/);
  clearForecasts();
  skies([{ precip: 0.4 }, {}, {}, {}, {}]);
  await act(async () => {
    screen.unmount();
  });
  await open();
  expect(row().props.accessibilityLabel).toBe("Light rain · 12 °C. Open the weather");
});

test("with no network the row says the weather is not loaded, and Try again asks again", async () => {
  fetchMock.mockImplementation(async () => Promise.reject(new TypeError("Network request failed")));
  await open();
  expect(row().props.accessibilityLabel).toBe("Weather not loaded. Open the weather");
  await fireEvent.press(row());
  expect(card().getByText("The forecast could not be loaded. Check the network.")).toBeTruthy();
  skies([{ temp: 14 }]);
  await fireEvent.press(card().getByLabelText("Try again"));
  await flush(30);
  expect(card().getByText("Here")).toBeTruthy();
});

test("the switch turns the weather off: nothing is asked, it is kept, and on asks again", async () => {
  skies([{}]);
  await open();
  await fireEvent.press(row());
  fetchMock.mockClear();
  await fireEvent.press(card().getByLabelText("Weather: on. Tap to change"));
  await flush(30);
  expect(await AsyncStorage.getItem("weather")).toBe("off");
  expect(card().getByText("Weather is off: nothing is asked of the network.")).toBeTruthy();
  expect(metCalls()).toHaveLength(0);
  await fireEvent.press(card().getByLabelText("Close"));
  expect(row().props.accessibilityLabel).toBe("Weather is off. Open the weather");
  await fireEvent.press(row());
  clearForecasts(); // what was kept would answer without the network
  await fireEvent.press(card().getByLabelText("Weather: off. Tap to change"));
  await flush(30);
  expect(await AsyncStorage.getItem("weather")).toBe("on");
  expect(metCalls().length).toBeGreaterThan(0);
  await fireEvent.press(card().getByLabelText("Close"));
  expect(row().props.accessibilityLabel).toMatch(/^Dry for the next/);
});

test("a stored Off is honoured from the start: nothing is asked", async () => {
  await AsyncStorage.setItem("weather", "off");
  skies([{}]);
  await open();
  expect(metCalls()).toHaveLength(0);
  expect(row().props.accessibilityLabel).toBe("Weather is off. Open the weather");
});

test("the forecast is asked for again every ten minutes while the screen is open", async () => {
  skies([{}]);
  await open();
  const asked = metCalls().length;
  await act(async () => {
    jest.advanceTimersByTime(11 * 60_000);
  });
  await flush(30);
  expect(metCalls().length).toBeGreaterThan(asked);
});

const standAt = (m: number) => {
  const [lat, lon] = at(first(), m);
  location.state.position = { latitude: lat, longitude: lon };
};

test("rain coming within 30 km is said once, in Full and in Alerts, and not in Off", async () => {
  skies([{}, {}, { precip: 2 }, { precip: 2 }, { precip: 2 }]);
  standAt(1_000);
  await open();
  await fireEvent.press(screen.getByText("Start"));
  await flush(30);
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  await flush(30);
  expect(said().filter((s) => /^Rain ahead in/.test(s))).toEqual(["Rain ahead in 30.0 km."]);
  await act(async () => {
    jest.advanceTimersByTime(11 * 60_000);
  });
  await flush(30);
  expect(said().filter((s) => /^Rain ahead in/.test(s))).toHaveLength(1);
});

test("Alerts says it and Off does not", async () => {
  skies([{}, {}, { precip: 2 }]);
  standAt(1_000);
  await AsyncStorage.setItem("voice-mode", "alerts");
  await open();
  await fireEvent.press(screen.getByText("Start"));
  await flush(30);
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  expect(said().filter((s) => /^Rain ahead/.test(s))).toHaveLength(1);
  speak.mockClear();
  setLanguage("en");
  await act(async () => {
    screen.unmount();
  });
  clearForecasts();
  await AsyncStorage.setItem("voice-mode", "off");
  skies([{}, {}, { precip: 2 }]);
  standAt(1_000);
  await open();
  await fireEvent.press(screen.getByText("Start"));
  await flush(30);
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  expect(said().filter((s) => /^Rain ahead/.test(s))).toEqual([]);
});

test("the row, the card and the words are in French in French", async () => {
  setLanguage("fr");
  skies([{}, {}, { precip: 2, temp: 9 }, {}, {}]);
  await open();
  expect(row().props.accessibilityLabel).toBe("Pluie dans 30,0 km · 12 °C. Ouvrir la météo");
  await fireEvent.press(row());
  expect(card().getByText("Météo devant")).toBeTruthy();
  expect(card().getByText("Ici")).toBeTruthy();
  expect(card().getByText("Données météo : MET Norway")).toBeTruthy();
  expect(card().getByLabelText("Météo : activée. Touchez pour changer")).toBeTruthy();
});

test("the weather chip is short: the temperature when dry, where the rain is when it comes, and the long sentence is its name", async () => {
  skies([{ temp: 14 }]);
  await open();
  expect(within(row()).getByText("14 °C")).toBeTruthy();
  expect(row().props.accessibilityLabel).toBe("Dry for the next 60.0 km · 14 °C. Open the weather");
  clearForecasts();
  skies([{}, {}, { precip: 2 }]);
  await act(async () => {
    screen.unmount();
  });
  await open();
  expect(within(row()).getByText("30.0 km")).toBeTruthy();
  clearForecasts();
  skies([{ precip: 2 }, { precip: 2 }, {}, {}, {}]);
  await act(async () => {
    screen.unmount();
  });
  await open();
  expect(within(row()).getByText("Clear in 30.0 km")).toBeTruthy();
});

test("the weather chip stands beside Find and Fuel, not on the panel", async () => {
  skies([{}]);
  await open();
  expect(within(screen.getByTestId("hud")).queryByTestId("weather-row")).toBeNull();
  expect(screen.getByTestId("weather-row")).toBeTruthy();
  expect(screen.getByTestId("places-chip")).toBeTruthy();
});

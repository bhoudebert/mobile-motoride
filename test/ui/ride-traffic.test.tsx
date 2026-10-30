import { StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render, screen, within } from "@testing-library/react-native";
import { setLanguage } from "../../src/core/i18n/index.ts";
import { resetServerSetting } from "../../src/ui/serverSetting.ts";
import { RideScreen } from "../../src/ui/RideScreen.tsx";
import { resetFiles } from "./filesystem.mock.ts";
import * as location from "./location.mock.ts";
import { resetMapMock, sources } from "./maplibre.mock.tsx";
import { stored } from "./securestore.mock.ts";
import { flush } from "./flush.ts";
import { first } from "./helpers.ts";

// Spec traffic: the levels of traffic on the next 60 km, from the rider's own server when it has a TomTom key.
const fetchMock = globalThis.fetch as unknown as jest.Mock;
const SERVER = { url: "https://rides.example.org", token: "mrt_" + "A".repeat(43) };

type Level = "free" | "slow" | "heavy" | "closed" | "unknown";
let hasTraffic = true;
let countries: string[] = [];
let levels: Level[] = [];
let trafficDown = false;
let budget = true;

beforeEach(async () => {
  jest.useFakeTimers();
  resetMapMock();
  resetFiles();
  resetServerSetting();
  stored.clear();
  await AsyncStorage.clear();
  setLanguage("en");
  hasTraffic = true;
  countries = [];
  levels = [];
  trafficDown = false;
  budget = true;
  location.state.permission = "granted";
  location.state.watcher = null;
  fetchMock.mockImplementation(async (url: string, init?: { body?: string }) => {
    const u = String(url);
    if (u.endsWith("/health"))
      return { ok: true, json: async () => ({ ok: true, traffic: hasTraffic, trafficCountries: countries }) };
    if (u.endsWith("/traffic")) {
      if (trafficDown) return { ok: false, status: 503, json: async () => ({}) };
      const n = (JSON.parse(init!.body!) as { points: unknown[] }).points.length;
      return {
        ok: true,
        json: async () => ({
          budget,
          points: Array.from({ length: n }, (_, i) => ({ level: levels[i] ?? "free", ratio: 1 })),
        }),
      };
    }
    return { ok: true };
  });
});
afterEach(() => {
  jest.useRealTimers();
  setLanguage("en");
  fetchMock.mockImplementation(() => Promise.resolve({ ok: true }));
});

const withServer = () => stored.set("server-setting", JSON.stringify(SERVER));
const open = async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await flush(30);
};
const trafficCalls = () => fetchMock.mock.calls.filter((c) => String(c[0]).endsWith("/traffic"));
const chip = () => screen.getByTestId("traffic-chip");
/** The colour of the chip's picture. */
const tint = () => {
  const icon = chip().children[0] as unknown as { props: { style: unknown } };
  return StyleSheet.flatten(icon.props.style as never).color;
};

test("without a server there is no traffic chip and nothing is asked", async () => {
  await open();
  expect(screen.queryByTestId("traffic-chip")).toBeNull();
  expect(trafficCalls()).toHaveLength(0);
});

test("a server with no traffic source shows nothing and is not asked for traffic", async () => {
  withServer();
  hasTraffic = false;
  await open();
  expect(screen.queryByTestId("traffic-chip")).toBeNull();
  expect(trafficCalls()).toHaveLength(0);
});

test("the points go to the rider's server with the token: here and every 10 km, as lat and lon only", async () => {
  withServer();
  await open();
  expect(trafficCalls()).toHaveLength(1);
  const [url, init] = trafficCalls()[0]!;
  expect(url).toBe("https://rides.example.org/traffic");
  expect(init.headers.Authorization).toBe(`Bearer ${SERVER.token}`);
  const body = JSON.parse(init.body) as { points: number[][] };
  expect(body.points).toHaveLength(7);
  for (const p of body.points) expect(p).toHaveLength(2);
});

test("a clear road says so", async () => {
  withServer();
  await open();
  expect(chip().props.accessibilityLabel).toBe("Traffic: flowing for the next 60 km");
  expect(sources["traffic"]).toBeUndefined();
});

test("the chip is a picture alone, green when it flows, amber when slow, red when heavy or closed, grey when nothing is known", async () => {
  withServer();
  await open();
  expect(tint()).toBe("#3fc27a");
  expect(within(chip()).queryByText("Clear")).toBeNull();
  await screen.unmount();
  resetMapMock();
  resetServerSetting();
  levels = ["free", "slow"];
  await open();
  expect(tint()).toBe("#f0a030");
  await screen.unmount();
  resetMapMock();
  resetServerSetting();
  levels = ["free", "free", "closed"];
  await open();
  expect(tint()).toBe("#e5484d");
  await screen.unmount();
  resetMapMock();
  resetServerSetting();
  levels = ["unknown", "unknown", "unknown", "unknown", "unknown", "unknown", "unknown"];
  await open();
  expect(tint()).not.toBe("#3fc27a");
});

test("when every point is unknown the card says the source does not cover the road, and that nothing is wrong", async () => {
  withServer();
  levels = ["unknown", "unknown", "unknown", "unknown", "unknown", "unknown", "unknown"];
  await open();
  await fireEvent.press(chip());
  expect(screen.getByText(/^No traffic data for the road ahead/)).toBeTruthy();
});

test("with some points known the card does not say there is no data", async () => {
  withServer();
  levels = ["unknown", "free", "free"];
  await open();
  await fireEvent.press(chip());
  expect(screen.queryByText(/^No traffic data for the road ahead/)).toBeNull();
});

test("a jam ahead is on the chip with its distance, drawn on the map, and listed on the card", async () => {
  withServer();
  levels = ["free", "free", "free", "heavy", "heavy", "free", "free"];
  await open();
  expect(chip().props.accessibilityLabel).toBe("Traffic: Heavy in 30.0 km");
  const lines = (sources["traffic"] as any).features;
  expect(lines).toHaveLength(1);
  expect(lines[0].properties.level).toBe("heavy");
  expect(lines[0].geometry.coordinates.length).toBeGreaterThan(2);
  await fireEvent.press(chip());
  const c = within(screen.getByTestId("sheet"));
  expect(c.getByText("Traffic ahead")).toBeTruthy();
  expect(c.getByText("Here")).toBeTruthy();
  expect(c.getByText("In 30.0 km")).toBeTruthy();
  expect(c.getAllByText("Heavy")).toHaveLength(2);
  expect(c.getByText("Traffic data: from your server")).toBeTruthy();
  expect(c.getByText(/does not change: you decide/)).toBeTruthy();
  expect(c.queryByText(/Traffic works in/)).toBeNull();
});

test("a server that says which countries its traffic covers is credited, and the card says where it works", async () => {
  withServer();
  countries = ["FR"];
  await open();
  await fireEvent.press(chip());
  const c = within(screen.getByTestId("sheet"));
  expect(c.getByText("Traffic works in France for now. More countries on request.")).toBeTruthy();
  expect(c.getByText("Traffic data: Bison Futé, transport.data.gouv.fr (Licence Ouverte 2.0)")).toBeTruthy();
});

test("slow and heavy are told apart on the map", async () => {
  withServer();
  levels = ["free", "slow", "free", "free", "free", "closed", "free"];
  await open();
  const lines = (sources["traffic"] as any).features;
  expect(lines.map((f: any) => f.properties.level)).toEqual(["slow", "closed"]);
});

test("a server that cannot answer says traffic is not loaded and offers Try again", async () => {
  withServer();
  trafficDown = true;
  await open();
  expect(chip().props.accessibilityLabel).toBe("Traffic not loaded");
  trafficDown = false;
  await fireEvent.press(chip());
  await fireEvent.press(screen.getByLabelText("Try again"));
  await flush(30);
  await fireEvent.press(screen.getByLabelText("Close"));
  expect(screen.getByTestId("traffic-chip").props.accessibilityLabel).toBe("Traffic: flowing for the next 60 km");
});

test("a server that used its daily requests says so on the card", async () => {
  withServer();
  budget = false;
  levels = ["unknown", "unknown", "unknown", "unknown", "unknown", "unknown", "unknown"];
  await open();
  expect(chip().props.accessibilityLabel).toBe("Traffic unknown");
  await fireEvent.press(chip());
  expect(screen.getByText(/used its traffic requests for today/)).toBeTruthy();
});

test("turning traffic off clears the map, stops the asking and is kept; nothing is asked at the next start", async () => {
  withServer();
  levels = ["free", "heavy"];
  await open();
  expect(sources["traffic"]).toBeDefined();
  await fireEvent.press(chip());
  await fireEvent.press(screen.getByLabelText("Traffic: on. Tap to change"));
  await flush(30);
  await fireEvent.press(screen.getByLabelText("Close"));
  expect(screen.getByTestId("traffic-chip").props.accessibilityLabel).toBe("Traffic is off");
  const asked = trafficCalls().length;
  expect(await AsyncStorage.getItem("traffic")).toBe("off");

  await screen.unmount();
  resetMapMock();
  resetServerSetting();
  fetchMock.mockClear();
  await open();
  expect(trafficCalls()).toHaveLength(0);
  expect(asked).toBeGreaterThan(0);
  expect(screen.getByTestId("traffic-chip").props.accessibilityLabel).toBe("Traffic is off");
});

test("in French the chip, the card and the levels are in French", async () => {
  setLanguage("fr");
  withServer();
  levels = ["free", "free", "slow"];
  await open();
  expect(chip().props.accessibilityLabel).toBe("Circulation : Ralenti dans 20,0 km");
  await fireEvent.press(chip());
  expect(screen.getByText("Circulation devant")).toBeTruthy();
});

test("traffic is asked again after five minutes, and after ten kilometres", async () => {
  withServer();
  await open();
  expect(trafficCalls()).toHaveLength(1);
  await jest.advanceTimersByTimeAsync(5 * 60_000 + 100);
  await flush(5);
  expect(trafficCalls()).toHaveLength(2);
});

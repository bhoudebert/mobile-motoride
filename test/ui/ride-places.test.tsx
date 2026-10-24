import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import { setLanguage } from "../../src/core/i18n/index.ts";
import { RideScreen } from "../../src/ui/RideScreen.tsx";
import { resetFiles } from "./filesystem.mock.ts";
import * as location from "./location.mock.ts";
import { camera, layers, resetMapMock, sources } from "./maplibre.mock.tsx";
import { flush } from "./flush.ts";
import { at, first } from "./helpers.ts";
import type { LatLon } from "../../src/core/types.ts";

// Spec places-search: look for a bakery, a café... in the next 60 km of the roadbook, and show the one the rider picks.
const fetchMock = globalThis.fetch as unknown as jest.Mock;
const queries = () =>
  fetchMock.mock.calls
    .filter((c) => String(c[0]).includes("overpass"))
    .map((c) => decodeURIComponent(String((c[1] as { body: string }).body).replace(/^data=/, "")));

/** An Overpass that answers the filters of a bakery with these places, and nothing for the others (fuel included). */
const bakeries = (places: Array<{ m: number; off?: number; name?: string }>) => {
  const rb = first();
  fetchMock.mockImplementation(async (url: string, init?: { body?: string }) => {
    if (!String(url).includes("overpass")) return { ok: true };
    const q = decodeURIComponent(String(init?.body ?? ""));
    const elements = q.includes('"shop"="bakery"')
      ? places.map((p, i) => {
          const [lat, lon]: LatLon = at(rb, p.m);
          return {
            type: "node",
            id: i + 1,
            lat: lat + (p.off ?? 0) / 111_320,
            lon,
            tags: p.name ? { name: p.name } : {},
          };
        })
      : [];
    return { ok: true, json: async () => ({ elements }) };
  });
};

beforeEach(async () => {
  jest.useFakeTimers();
  resetMapMock();
  resetFiles();
  await AsyncStorage.clear();
  setLanguage("en");
  location.state.permission = "granted";
  location.state.watcher = null;
  camera.easeTo.mockClear();
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
const card = () => within(screen.getByTestId("sheet"));

test("Find offers the kinds of place and Fuel, and says what it looks at", async () => {
  await open();
  await fireEvent.press(screen.getByTestId("places-chip"));
  for (const k of ["Fuel", "Bakery", "Café", "Restaurant", "Viewpoint", "Toilets", "Cash machine", "Motorcycle shop"]) {
    expect(card().getByLabelText(`Look for: ${k}`)).toBeTruthy();
  }
  expect(card().getByText(/^Within the next 60 km of the roadbook\./)).toBeTruthy();
  await fireEvent.press(card().getByLabelText("Close"));
  expect(screen.queryByTestId("sheet")).toBeNull();
});

test("Fuel in the list opens the fuel stops", async () => {
  await open();
  await fireEvent.press(screen.getByTestId("places-chip"));
  await fireEvent.press(card().getByLabelText("Look for: Fuel"));
  expect(card().getByText("Fuel stops")).toBeTruthy();
});

test("a kind is looked for in the next 60 km with its own filter, and the places come nearest first with their distance", async () => {
  bakeries([{ m: 30_000, name: "Boulangerie Paul" }, { m: 12_000, off: 400, name: "Chez Marie" }, { m: 50_000 }]);
  await open();
  fetchMock.mockClear();
  bakeries([{ m: 30_000, name: "Boulangerie Paul" }, { m: 12_000, off: 400, name: "Chez Marie" }, { m: 50_000 }]);
  await fireEvent.press(screen.getByTestId("places-chip"));
  await fireEvent.press(card().getByLabelText("Look for: Bakery"));
  await flush(30);
  expect(queries().length).toBeGreaterThan(0);
  expect(queries().every((q) => q.includes('nwr["shop"="bakery"](around:1000,'))).toBe(true);
  const rows = card()
    .getAllByRole("button")
    .filter((b) => /Show it on the map$/.test(b.props.accessibilityLabel));
  expect(rows.map((r) => r.props.accessibilityLabel)).toEqual([
    expect.stringMatching(/^Chez Marie, in 12\.\d km · \d+ m off the route\. Show it on the map$/),
    "Boulangerie Paul, in 30.0 km · on the route. Show it on the map",
    "Bakery, in 50.0 km · on the route. Show it on the map",
  ]);
});

test("a place further than 60 km ahead is not asked about", async () => {
  bakeries([{ m: 80_000, name: "Too far" }]);
  await open();
  await fireEvent.press(screen.getByTestId("places-chip"));
  await fireEvent.press(card().getByLabelText("Look for: Bakery"));
  await flush(30);
  // The queries only cover the window: their points are all within the first 60 km of the line.
  const rb = first();
  const [lat80] = at(rb, 80_000);
  expect(queries().every((q) => !q.includes(lat80.toFixed(5)))).toBe(true);
});

test("choosing a place shows it on the map, centres the map on it and keeps a chip with its distance, that clears", async () => {
  bakeries([{ m: 12_000, name: "Chez Marie" }]);
  await open();
  await fireEvent.press(screen.getByTestId("places-chip"));
  await fireEvent.press(card().getByLabelText("Look for: Bakery"));
  await flush(30);
  await fireEvent.press(card().getByLabelText(/^Chez Marie, in 12\.0 km/));
  expect(screen.queryByTestId("sheet")).toBeNull();
  expect((sources["place"] as any).geometry.coordinates).toEqual([expect.any(Number), expect.any(Number)]);
  expect(layers["place"]).toBeTruthy();
  expect(camera.easeTo).toHaveBeenCalledWith(expect.objectContaining({ zoom: 14.5 }));
  const chip = screen.getByTestId("selected-place");
  expect(chip.props.accessibilityLabel).toBe("Chez Marie, 12.0 km ahead. Clear it");
  expect(within(chip).getByText("Chez Marie · 12.0 km")).toBeTruthy();
  await fireEvent.press(chip);
  expect(screen.queryByTestId("selected-place")).toBeNull();
  expect(screen.queryByTestId("source-place")).toBeNull();
});

test("nothing found says so, and the kinds stay on top: another one is one tap away", async () => {
  bakeries([]);
  await open();
  await fireEvent.press(screen.getByTestId("places-chip"));
  await fireEvent.press(card().getByLabelText("Look for: Bakery"));
  await flush(30);
  expect(card().getByText("Nothing found along the next 60 km.")).toBeTruthy();
  expect(card().getByLabelText("Look for: Café")).toBeTruthy();
  expect(card().getByLabelText("Look for: Bakery").props.accessibilityState).toMatchObject({ selected: true });
  expect(card().getByLabelText("Look for: Café").props.accessibilityState).toMatchObject({ selected: false });
  await fireEvent.press(card().getByLabelText("Look for: Café"));
  await flush(30);
  expect(card().getByLabelText("Look for: Café").props.accessibilityState).toMatchObject({ selected: true });
  expect(queries().some((q) => q.includes('"amenity"="cafe"'))).toBe(true);
});

test("after a place is chosen, Find opens on the kinds with the last results under them, and another kind can be chosen", async () => {
  bakeries([{ m: 12_000, name: "Chez Marie" }]);
  await open();
  await fireEvent.press(screen.getByTestId("places-chip"));
  await fireEvent.press(card().getByLabelText("Look for: Bakery"));
  await flush(30);
  await fireEvent.press(card().getByLabelText(/^Chez Marie/));
  expect(screen.queryByTestId("sheet")).toBeNull();
  await fireEvent.press(screen.getByTestId("places-chip"));
  for (const k of ["Fuel", "Bakery", "Café", "Restaurant", "Viewpoint", "Toilets", "Cash machine", "Motorcycle shop"]) {
    expect(card().getByLabelText(`Look for: ${k}`)).toBeTruthy();
  }
  expect(card().getByLabelText(/^Chez Marie/)).toBeTruthy();
  await fireEvent.press(card().getByLabelText("Look for: Toilets"));
  await flush(30);
  expect(card().queryByLabelText(/^Chez Marie/)).toBeNull();
  expect(card().getByLabelText("Look for: Toilets").props.accessibilityState).toMatchObject({ selected: true });
});

test("a long list does not push the kinds out of reach: they come first in the card", async () => {
  bakeries(Array.from({ length: 12 }, (_, i) => ({ m: 5_000 + i * 3_000, name: `Boulangerie ${i + 1}` })));
  await open();
  await fireEvent.press(screen.getByTestId("places-chip"));
  await fireEvent.press(card().getByLabelText("Look for: Bakery"));
  await flush(30);
  const labels = card()
    .getAllByRole("button")
    .map((b) => b.props.accessibilityLabel as string);
  const firstPlace = labels.findIndex((l) => /^Boulangerie 1,/.test(l));
  const lastKind = Math.max(...labels.map((l, i) => (/^Look for: /.test(l) ? i : -1)));
  expect(lastKind).toBeGreaterThanOrEqual(0);
  expect(lastKind).toBeLessThan(firstPlace);
});

test("with no network the card says so and Try again asks again", async () => {
  await open();
  fetchMock.mockImplementation(async () => Promise.reject(new TypeError("Network request failed")));
  await fireEvent.press(screen.getByTestId("places-chip"));
  await fireEvent.press(card().getByLabelText("Look for: Bakery"));
  for (let i = 0; i < 8; i++) {
    await act(async () => {
      jest.advanceTimersByTime(2500);
    });
    await flush();
  }
  expect(card().getByText("The search could not be made. Check the network.")).toBeTruthy();
  bakeries([{ m: 12_000, name: "Chez Marie" }]);
  await fireEvent.press(card().getByLabelText("Try again"));
  await flush(30);
  expect(card().getByLabelText(/^Chez Marie, in 12\.0 km/)).toBeTruthy();
});

test("the ride goes on while the card is open and after: Start is still there", async () => {
  bakeries([{ m: 12_000, name: "Chez Marie" }]);
  await open();
  await fireEvent.press(screen.getByTestId("places-chip"));
  await fireEvent.press(card().getByLabelText("Look for: Bakery"));
  await flush(30);
  await fireEvent.press(card().getByLabelText(/^Chez Marie/));
  expect(screen.getByText("Start")).toBeTruthy();
});

test("Find is in French in French, with the French names of the kinds", async () => {
  setLanguage("fr");
  await open();
  await fireEvent.press(screen.getByTestId("places-chip"));
  expect(card().getByText("Chercher le long de l'itinéraire")).toBeTruthy();
  for (const k of [
    "Carburant",
    "Boulangerie",
    "Café",
    "Restaurant",
    "Point de vue",
    "Toilettes",
    "Distributeur",
    "Garage moto",
  ]) {
    expect(card().getByLabelText(`Chercher : ${k}`)).toBeTruthy();
  }
});

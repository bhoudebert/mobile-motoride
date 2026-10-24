import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { RideScreen } from "../../src/ui/RideScreen.tsx";
import { lastMap, offline, OfflineManager, resetMapMock } from "./maplibre.mock.tsx";
import { flush } from "./flush.ts";
import { first } from "./helpers.ts";
import type { PreparedRoadbook } from "../../src/core/types.ts";
import { prepareRoadbook } from "../../src/core/roadbook.ts";

beforeEach(() => {
  resetMapMock();
  (globalThis.fetch as unknown as jest.Mock).mockImplementation(() => Promise.resolve({ ok: true }));
});

const open = async (rb: PreparedRoadbook = first()) => {
  await render(<RideScreen rb={rb} onBack={() => {}} />);
  await flush();
};
const SAVE = "Save the map for offline";
const progress = (state: string, percentage: number) =>
  act(async () => offline.progress.at(-1)!(offline.packs.at(-1), { state, percentage }));

test("before a ride the map can be saved: the pack is the roadbook's area, with its style, zooms and key", async () => {
  await open();
  await fireEvent.press(screen.getByLabelText(SAVE));
  await flush();
  expect(OfflineManager.createPack).toHaveBeenCalledTimes(1);
  const options = OfflineManager.createPack.mock.calls[0]![0];
  expect(options.mapStyle).toBe("https://tiles.openfreemap.org/styles/positron");
  expect(options.minZoom).toBe(8);
  expect(options.maxZoom).toBe(14);
  expect(options.metadata.key).toBe(`${first().roadbook.id}:light`);
  const [w, s, e, n] = options.bounds;
  const line = first().roadbook.line;
  for (const [lat, lon] of line) expect(lat >= s && lat <= n && lon >= w && lon <= e).toBe(true);
});

test("the progress is shown, then the map is saved", async () => {
  await open();
  await fireEvent.press(screen.getByLabelText(SAVE));
  await flush();
  await progress("active", 41.6);
  expect(screen.getByText("Saving the map… 42%")).toBeTruthy();
  expect(screen.queryByLabelText(SAVE)).toBeNull();
  await progress("complete", 100);
  expect(screen.getByText("Map saved for offline")).toBeTruthy();
  expect(screen.queryByLabelText(SAVE)).toBeNull();
});

test("a failed download is said and can be tried again", async () => {
  await open();
  await fireEvent.press(screen.getByLabelText(SAVE));
  await flush();
  await act(async () => offline.errors.at(-1)!(offline.packs.at(-1), { id: "x", message: "network" }));
  expect(screen.getByText("The map could not be saved. Try again")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Save the map for offline"));
  await flush();
  expect(OfflineManager.createPack).toHaveBeenCalledTimes(2);
  expect(OfflineManager.deletePack).toHaveBeenCalledTimes(1); // the cut-short pack makes way
});

test("a pack that cannot even be created is a failure, not a crash", async () => {
  offline.failCreate = true;
  await open();
  await fireEvent.press(screen.getByLabelText(SAVE));
  await flush();
  expect(screen.getByText("The map could not be saved. Try again")).toBeTruthy();
});

test("a roadbook too long to save says so and offers nothing", async () => {
  const rb = first();
  const long = prepareRoadbook({
    ...rb.roadbook,
    line: [
      [40, -5],
      [55, 15],
    ],
    stops: [],
  });
  await open(long);
  expect(screen.getByText("Too long to save the map for offline.")).toBeTruthy();
  expect(screen.queryByLabelText(SAVE)).toBeNull();
});

test("a saved map is found again at launch, and can be removed", async () => {
  offline.packs = [
    { id: "p1", metadata: { key: `${first().roadbook.id}:light` }, status: async () => ({ state: "complete" }) },
  ];
  await open();
  expect(screen.getByText("Map saved for offline")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Remove the offline map"));
  await flush();
  expect(OfflineManager.deletePack).toHaveBeenCalledWith("p1");
  expect(screen.getByLabelText(SAVE)).toBeTruthy();
});

test("a map saved for another roadbook or basemap is not this one's", async () => {
  offline.packs = [
    { id: "p1", metadata: { key: "other:light" }, status: async () => ({ state: "complete" }) },
    { id: "p2", metadata: { key: `${first().roadbook.id}:colour` }, status: async () => ({ state: "complete" }) },
  ];
  await open();
  expect(screen.getByLabelText(SAVE)).toBeTruthy();
});

test("with a saved map and no network the basemap stays, without one it falls back to the line", async () => {
  const fetchMock = globalThis.fetch as unknown as jest.Mock;
  fetchMock.mockImplementation(() => Promise.reject(new TypeError("Network request failed")));
  offline.packs = [
    { id: "p1", metadata: { key: `${first().roadbook.id}:light` }, status: async () => ({ state: "complete" }) },
  ];
  await open();
  expect(screen.queryByText("Map offline")).toBeNull();
  expect(lastMap.props.mapStyle).toBe("https://tiles.openfreemap.org/styles/positron");
  expect(screen.getByLabelText("Map: Light. Tap to change")).toBeTruthy();
});

test("the offer is not made when the basemap is off, nor while a ride runs", async () => {
  await open();
  await fireEvent.press(screen.getByLabelText("Map: Light. Tap to change")); // Colour
  await flush();
  expect(screen.getByLabelText(SAVE)).toBeTruthy(); // its own map, saved on its own
  await fireEvent.press(screen.getByLabelText("Map: Colour. Tap to change")); // No map
  await flush();
  expect(screen.queryByLabelText(SAVE)).toBeNull();
  await fireEvent.press(screen.getByLabelText("Map: No map. Tap to change")); // Light again
  await flush();
  await fireEvent.press(screen.getByText("Demo"));
  await flush();
  expect(screen.queryByLabelText(SAVE)).toBeNull();
});

import { StyleSheet } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { RideScreen } from "../../src/ui/RideScreen.tsx";
import { camera, lastMap, mapApi, resetMapMock, sources } from "./maplibre.mock.tsx";
import { flush } from "./flush.ts";
import { first, revealButtons } from "./helpers.ts";

beforeEach(() => resetMapMock());

test("the idle ride screen shows the roadbook, its figures and the actions", async () => {
  const rb = first();
  await render(<RideScreen rb={rb} onBack={() => {}} />);
  expect(screen.getByText("Pays des Collines loop")).toBeTruthy();
  expect(screen.getByText("122 km")).toBeTruthy();
  for (const label of ["Back", "Demo", "Start", "+", "−"]) expect(screen.getByText(label)).toBeTruthy();
  expect(screen.queryByLabelText("Follow me")).toBeNull();
  expect(screen.queryByText("End")).toBeNull();
  expect(screen.getByText(/^Advisory speeds are guidance, not a guarantee\./)).toBeTruthy();
});

test("under the distance left stand the time left and the arrival, in one short line", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  // Before the first move the pace is the assumed one: 122 km at 58 km/h.
  expect(screen.getByText(/^2h07 · /)).toBeTruthy();
  expect(screen.getByLabelText(/^122 km left, about 2h07, arriving at /)).toBeTruthy();
});

test("the map carries the line with its arrows, the corners and the stops, and no rider yet", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  for (const id of [
    "source-line",
    "layer-line",
    "layer-line-casing",
    "layer-line-arrows",
    "source-corners",
    "layer-corners",
    "source-stops",
    "layer-stops",
  ]) {
    expect(screen.getByTestId(id)).toBeTruthy();
  }
  expect(screen.queryByTestId("source-rider")).toBeNull();
  expect(screen.queryByTestId("source-approach")).toBeNull();
  expect(sources["line"].geometry.coordinates.length).toBeGreaterThan(1000);
});

test("Back goes back", async () => {
  const onBack = jest.fn();
  await render(<RideScreen rb={first()} onBack={onBack} />);
  await revealButtons();
  await fireEvent.press(screen.getByText("Back"));
  expect(onBack).toHaveBeenCalled();
});

test("the basemap cycles Light, Colour, No map and shows its attribution only when there is one", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  expect(lastMap.props.mapStyle).toBe("https://tiles.openfreemap.org/styles/positron");
  expect(screen.getByText(/OpenStreetMap contributors, OpenFreeMap/)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Map: Light. Tap to change"));
  expect(lastMap.props.mapStyle).toBe("https://tiles.openfreemap.org/styles/liberty");
  expect(screen.getByLabelText("Map: Colour. Tap to change")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Map: Colour. Tap to change"));
  expect(lastMap.props.mapStyle.version).toBe(8);
  expect(screen.getByLabelText("Map: No map. Tap to change")).toBeTruthy();
  expect(screen.queryByText(/OpenFreeMap/)).toBeNull();
  await fireEvent.press(screen.getByLabelText("Map: No map. Tap to change"));
  expect(screen.getByLabelText("Map: Light. Tap to change")).toBeTruthy();
});

test("the attribution stands just above the chips, whatever the height of the panel", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await fireEvent(screen.getByTestId("hud"), "layout", { nativeEvent: { layout: { height: 300 } } });
  const style = StyleSheet.flatten(screen.getByText(/OpenStreetMap contributors/).props.style);
  expect(style.bottom).toBe(300 + 12 + 48 + 4);
});

test("the layers survive a basemap switch (the map is remounted)", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await fireEvent.press(screen.getByLabelText("Map: Light. Tap to change"));
  expect(screen.getByTestId("layer-line-arrows")).toBeTruthy();
  expect(screen.getByTestId("layer-corners")).toBeTruthy();
});

test("a basemap that cannot load falls back to No map and says so, and can be retried", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await act(async () => lastMap.props.onDidFailLoadingMap());
  expect(screen.getByText("Map offline")).toBeTruthy();
  expect(screen.getByLabelText("Map: No map. Tap to change")).toBeTruthy();
  expect(lastMap.props.mapStyle.version).toBe(8);
  await fireEvent.press(screen.getByLabelText("Map: No map. Tap to change"));
  expect(screen.queryByText("Map offline")).toBeNull();
  expect(screen.getByLabelText("Map: Light. Tap to change")).toBeTruthy();
});

test("the failure of the plain map itself is ignored", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await fireEvent.press(screen.getByLabelText("Map: Light. Tap to change"));
  await fireEvent.press(screen.getByLabelText("Map: Colour. Tap to change"));
  await act(async () => lastMap.props.onDidFailLoadingMap());
  expect(screen.queryByText("Map offline")).toBeNull();
});

test("Route fits the whole roadbook north up", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await fireEvent.press(screen.getByLabelText("Show the whole roadbook"));
  expect(camera.fitBounds).toHaveBeenCalledWith(
    expect.arrayContaining([expect.any(Number)]),
    expect.objectContaining({ bearing: 0, pitch: 0 }),
  );
});

test("zoom buttons zoom the free map around its centre", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("+"));
  await flush();
  expect(mapApi.getZoom).toHaveBeenCalled();
  expect(camera.easeTo).toHaveBeenCalledWith(expect.objectContaining({ zoom: 13, center: [3.2, 50.45] }));
  await fireEvent.press(screen.getByText("−"));
  await flush();
  expect(camera.easeTo).toHaveBeenLastCalledWith(expect.objectContaining({ zoom: 11 }));
});

test("each basemap is checked for reachability with one small request, and not the plain map", async () => {
  const fetchMock = globalThis.fetch as unknown as jest.Mock;
  fetchMock.mockClear();
  // The fuel stations are asked for on their own (spec fuel-stops); only the requests for a map style count here.
  const styleCalls = () =>
    fetchMock.mock.calls.filter((c) => String(c[0]).startsWith("https://tiles.openfreemap.org/"));
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  expect(styleCalls()).toHaveLength(1);
  expect(styleCalls()[0]![0]).toBe("https://tiles.openfreemap.org/styles/positron");
  expect(styleCalls()[0]![1]).toMatchObject({ method: "HEAD" });
  await fireEvent.press(screen.getByLabelText("Map: Light. Tap to change"));
  expect(styleCalls()).toHaveLength(2);
  expect(styleCalls()[1]![0]).toBe("https://tiles.openfreemap.org/styles/liberty");
  await fireEvent.press(screen.getByLabelText("Map: Colour. Tap to change"));
  expect(styleCalls()).toHaveLength(2);
  expect(screen.queryByText("Map offline")).toBeNull();
});

test("a basemap that cannot be reached falls back to No map and says so, even when its style is cached", async () => {
  const fetchMock = globalThis.fetch as unknown as jest.Mock;
  fetchMock.mockImplementation(() => Promise.reject(new TypeError("Network request failed")));
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await flush();
  expect(screen.getByText("Map offline")).toBeTruthy();
  expect(screen.getByLabelText("Map: No map. Tap to change")).toBeTruthy();
  expect(lastMap.props.mapStyle.version).toBe(8);
  fetchMock.mockImplementation(() => Promise.resolve({ ok: true }));
});

test("a basemap that answers with an error is treated as unreachable", async () => {
  const fetchMock = globalThis.fetch as unknown as jest.Mock;
  fetchMock.mockImplementation(() => Promise.resolve({ ok: false, status: 503 }));
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await flush();
  expect(screen.getByText("Map offline")).toBeTruthy();
  fetchMock.mockImplementation(() => Promise.resolve({ ok: true }));
});

test("trying again once the network is back brings the map back", async () => {
  const fetchMock = globalThis.fetch as unknown as jest.Mock;
  fetchMock.mockImplementation(() => Promise.reject(new TypeError("offline")));
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await flush();
  expect(screen.getByText("Map offline")).toBeTruthy();
  fetchMock.mockImplementation(() => Promise.resolve({ ok: true }));
  await fireEvent.press(screen.getByLabelText("Map: No map. Tap to change"));
  await flush();
  expect(screen.queryByText("Map offline")).toBeNull();
  expect(screen.getByLabelText("Map: Light. Tap to change")).toBeTruthy();
});

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import * as Speech from "expo-speech";
import { RideScreen } from "../../src/ui/RideScreen.tsx";
import { DEMO_SPEED_MPS } from "../../src/core/simulate.ts";
import { camera, lastMap, resetMapMock, sources } from "./maplibre.mock.tsx";
import { seconds, until } from "./flush.ts";
import { first, prepared, endRide, revealButtons } from "./helpers.ts";

beforeEach(() => {
  jest.useFakeTimers();
  resetMapMock();
});
afterEach(() => jest.useRealTimers());

const INSTRUCTION = /^(Straight .+|Left in .+|Right in .+|U-turn in .+|Finish in .+)$/;

test("Demo puts a position on the map and the top instruction appears at once", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Demo"));
  await seconds(1);
  expect(screen.getByText(INSTRUCTION)).toBeTruthy();
  expect(screen.getByTestId("source-rider")).toBeTruthy();
  expect(sources["rider"].properties.bearing).toBeGreaterThanOrEqual(0);
  expect(screen.getByText(/DEMO/)).toBeTruthy();
  await revealButtons();
  expect(screen.getByText("End")).toBeTruthy();
  expect(screen.getByLabelText("Follow me")).toBeTruthy();
  expect(screen.queryByText("Start")).toBeNull();
  expect(screen.queryByText("Demo")).toBeNull();
});

test("the camera follows the rider along the line, heading up, at the follow zoom", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Demo"));
  await seconds(2);
  expect(camera.easeTo).toHaveBeenCalledWith(
    expect.objectContaining({
      zoom: 16,
      pitch: 0,
      bearing: expect.any(Number),
      center: [expect.any(Number), expect.any(Number)],
    }),
  );
});

test("the remaining distance goes down as the demo rides", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Demo"));
  await seconds(1);
  const km = () =>
    Number(
      screen
        .getByText(/^\d+(\.\d)? km$|^\d+ km$/)
        .props.children.toString()
        .replace(" km", ""),
    );
  const before = km();
  await seconds(20);
  expect(km()).toBeLessThan(before);
});

const CORNER_BANNER = /^(HAIRPIN|SHARP) (LEFT|RIGHT)$/;

test("the first dangerous corner is announced on screen and spoken once", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Demo"));
  await until(() => screen.queryByText(CORNER_BANNER) !== null, 60);
  expect(screen.getByText(/ride at \d+ km\/h/)).toBeTruthy();
  const spoken = (Speech.speak as jest.Mock).mock.calls.map((c) => c[0] as string);
  expect(spoken.length).toBe(1);
  expect(spoken[0]).toMatch(/^(Hairpin|Sharp corner) (left|right), \d+ metres, \d+$/);
});

test("the corner banner clears once the corner is passed, and each corner is spoken once", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Demo"));
  await until(() => screen.queryByText(CORNER_BANNER) !== null, 60);
  await until(() => screen.queryByText(CORNER_BANNER) === null, 60);
  const spoken = (Speech.speak as jest.Mock).mock.calls.map((c) => c[0] as string);
  expect(spoken.length).toBeGreaterThanOrEqual(1);
  expect(Speech.stop).toHaveBeenCalled();
});

test("Stop leaves the ride, fits the roadbook and clears the rider, the instruction and the warning", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Demo"));
  await until(() => screen.queryByText(CORNER_BANNER) !== null, 60);
  camera.fitBounds.mockClear();
  await endRide();
  expect(screen.getByText("Start")).toBeTruthy();
  expect(screen.getByText("Demo")).toBeTruthy();
  expect(screen.queryByText(INSTRUCTION)).toBeNull();
  expect(screen.queryByText(/^(HAIRPIN|SHARP) /)).toBeNull();
  expect(screen.queryByTestId("source-rider")).toBeNull();
  expect(screen.queryByLabelText("Follow me")).toBeNull();
  expect(camera.fitBounds).toHaveBeenCalled();
  expect(Speech.stop).toHaveBeenCalled();
});

test("a demo can be run twice and warns again", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  for (let run = 0; run < 2; run++) {
    (Speech.speak as jest.Mock).mockClear();
    await fireEvent.press(screen.getByText("Demo"));
    await until(() => screen.queryByText(CORNER_BANNER) !== null, 60);
    expect((Speech.speak as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(1);
    await endRide();
  }
});

test("touching the map stops following, Me resumes it", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Demo"));
  await seconds(2);
  await act(async () => lastMap.props.onRegionWillChange({ nativeEvent: { userInteraction: true } }));
  camera.easeTo.mockClear();
  await seconds(3);
  expect(camera.easeTo).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText("Follow me"));
  await seconds(1);
  expect(camera.easeTo).toHaveBeenCalled();
});

test("a region change made by the app itself does not stop following", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Demo"));
  await seconds(2);
  await act(async () => lastMap.props.onRegionWillChange({ nativeEvent: { userInteraction: false } }));
  camera.easeTo.mockClear();
  await seconds(2);
  expect(camera.easeTo).toHaveBeenCalled();
});

test("zoom while following changes the follow zoom, and Route stops following", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Demo"));
  await seconds(2);
  await fireEvent.press(screen.getByText("+"));
  await seconds(1);
  expect(camera.easeTo).toHaveBeenLastCalledWith(expect.objectContaining({ zoom: 17 }));
  await fireEvent.press(screen.getByText("−"));
  await fireEvent.press(screen.getByText("−"));
  await seconds(1);
  expect(camera.easeTo).toHaveBeenLastCalledWith(expect.objectContaining({ zoom: 15 }));
  await fireEvent.press(screen.getByLabelText("Show the whole roadbook"));
  camera.easeTo.mockClear();
  await seconds(3);
  expect(camera.easeTo).not.toHaveBeenCalled();
});

test("the follow zoom stays within sensible limits", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Demo"));
  await seconds(1);
  for (let i = 0; i < 20; i++) await fireEvent.press(screen.getByText("+"));
  await seconds(1);
  expect(camera.easeTo).toHaveBeenLastCalledWith(expect.objectContaining({ zoom: 19 }));
  for (let i = 0; i < 20; i++) await fireEvent.press(screen.getByText("−"));
  await seconds(1);
  expect(camera.easeTo).toHaveBeenLastCalledWith(expect.objectContaining({ zoom: 8 }));
});

test("the basemap can be switched during a ride without losing the rider or the instruction", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Demo"));
  await seconds(2);
  await fireEvent.press(screen.getByLabelText("Map: Light. Tap to change"));
  await seconds(1);
  expect(screen.getByTestId("source-rider")).toBeTruthy();
  expect(screen.getByText(INSTRUCTION)).toBeTruthy();
  expect(screen.getByTestId("layer-line-arrows")).toBeTruthy();
});

test("the demo ends at the finish and says so", async () => {
  const shortest = prepared().sort((a, b) => a.totalM - b.totalM)[0]!;
  await render(<RideScreen rb={shortest} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Demo"));
  // A whole roadbook at demo speed is thousands of seconds: five per render keeps it quick on a shared CI runner.
  await seconds(Math.ceil(shortest.totalM / DEMO_SPEED_MPS) + 5, 5);
  expect(screen.getByText("demo finished")).toBeTruthy();
});

test.each(prepared().map((rb) => [rb.roadbook.name, rb] as const))(
  "%s: five minutes of demo never break the screen",
  async (_name, rb) => {
    await render(<RideScreen rb={rb} onBack={() => {}} />);
    await fireEvent.press(screen.getByText("Demo"));
    await seconds(300);
    expect(screen.getByText(INSTRUCTION)).toBeTruthy();
    await revealButtons();
    expect(screen.getByText("End")).toBeTruthy();
  },
);

const remaining = () => screen.getByText(/^\d+(\.\d)? km$|^\d+ km$/).props.children.toString();

test("Pause freezes everything on screen, and says so", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Demo"));
  await seconds(5);
  await revealButtons();
  await fireEvent.press(screen.getByText("Pause"));
  const frozen = { km: remaining(), instruction: screen.getByText(INSTRUCTION).props.children.toString() };
  expect(screen.getByText(/DEMO · PAUSED/)).toBeTruthy();
  await revealButtons();
  expect(screen.getByLabelText("Resume the demo")).toBeTruthy();
  camera.easeTo.mockClear();
  (Speech.speak as jest.Mock).mockClear();
  await seconds(30);
  expect(remaining()).toBe(frozen.km);
  expect(screen.getByText(INSTRUCTION).props.children.toString()).toBe(frozen.instruction);
  expect(camera.easeTo).not.toHaveBeenCalled();
  expect(Speech.speak).not.toHaveBeenCalled();
});

test("a corner warning stays on screen while paused, so it can be read", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Demo"));
  await until(() => screen.queryByText(CORNER_BANNER) !== null, 60);
  await revealButtons();
  await fireEvent.press(screen.getByText("Pause"));
  await seconds(30);
  expect(screen.getByText(CORNER_BANNER)).toBeTruthy();
});

test("Resume carries on from the same place, not from the start", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Demo"));
  await seconds(1);
  const atStart = Number(remaining().replace(" km", ""));
  await seconds(20);
  await revealButtons();
  await fireEvent.press(screen.getByText("Pause"));
  const paused = Number(remaining().replace(" km", ""));
  expect(paused).toBeLessThan(atStart);
  await seconds(10);
  await revealButtons();
  await fireEvent.press(screen.getByText("Resume"));
  await seconds(5);
  const resumed = Number(remaining().replace(" km", ""));
  expect(resumed).toBeLessThanOrEqual(paused);
  expect(resumed).toBeGreaterThan(paused - 1);
  expect(screen.queryByText(/PAUSED/)).toBeNull();
  await revealButtons();
  expect(screen.getByText("Pause")).toBeTruthy();
});

test("pausing again and again never moves the demo", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Demo"));
  await seconds(3);
  await revealButtons();
  await fireEvent.press(screen.getByText("Pause"));
  const km = remaining();
  for (let i = 0; i < 5; i++) {
    await revealButtons();
    await fireEvent.press(screen.getByText("Resume"));
    await revealButtons();
    await fireEvent.press(screen.getByText("Pause"));
  }
  await seconds(10);
  expect(remaining()).toBe(km);
});

test("Stop ends a paused demo, and the next one starts from its beginning, running", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await fireEvent.press(screen.getByText("Demo"));
  await seconds(1);
  const atStart = remaining();
  await seconds(30);
  await revealButtons();
  await fireEvent.press(screen.getByText("Pause"));
  await endRide();
  expect(screen.getByText("Start")).toBeTruthy();
  expect(screen.queryByText("Resume")).toBeNull();
  await fireEvent.press(screen.getByText("Demo"));
  await seconds(1);
  expect(remaining()).toBe(atStart);
  expect(screen.queryByText(/PAUSED/)).toBeNull();
  await revealButtons();
  expect(screen.getByText("Pause")).toBeTruthy();
});

test("there is no Pause outside the demo", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  expect(screen.queryByText("Pause")).toBeNull();
});

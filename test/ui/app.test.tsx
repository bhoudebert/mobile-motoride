import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, render, screen } from "@testing-library/react-native";
import App from "../../App.tsx";
import { ErrorBoundary } from "../../src/ui/ErrorBoundary.tsx";
import { RoadbookList } from "../../src/ui/RoadbookList.tsx";
import { Text } from "react-native";
import { flush } from "./flush.ts";
import { prepared, revealButtons } from "./helpers.ts";

test("the list shows every bundled roadbook with its figures", async () => {
  const onOpen = jest.fn();
  await render(<RoadbookList roadbooks={prepared()} onOpen={onOpen} />);
  for (const rb of prepared()) expect(screen.getByText(rb.roadbook.name)).toBeTruthy();
  expect(screen.getAllByText(/corners to watch/).length).toBe(prepared().length);
  await fireEvent.press(screen.getByText("Pays des Collines loop"));
  expect(onOpen).toHaveBeenCalledTimes(1);
  expect(onOpen.mock.calls[0]![0].roadbook.name).toBe("Pays des Collines loop");
});

test("the app opens on the map, not on a titled list, and goes to the roadbooks and back", async () => {
  await render(<App />);
  expect(screen.getByLabelText("Where to?")).toBeTruthy();
  expect(screen.queryByText("MobileMotoRide")).toBeNull();
  expect(screen.queryByText("Pick a roadbook")).toBeNull();
  await fireEvent.press(screen.getByLabelText("Roadbooks"));
  expect(screen.getByText("Pick a roadbook")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Back to the map"));
  expect(screen.getByLabelText("Where to?")).toBeTruthy();
});

test("a roadbook chosen on the list goes back to the list, one opened from the recent rides goes back to the map", async () => {
  await render(<App />);
  await fireEvent.press(screen.getByLabelText("Roadbooks"));
  await fireEvent.press(screen.getByText("Pays des Collines loop"));
  expect(screen.getByText("Start")).toBeTruthy();
  expect(screen.getByText("Demo")).toBeTruthy();
  await revealButtons();
  await fireEvent.press(screen.getByLabelText("Back to the list"));
  expect(screen.getByText("Pick a roadbook")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Back to the map"));
  await flush();
  // It was remembered: the recent rides name it, and choosing it opens the ride again.
  await fireEvent.press(screen.getByLabelText("Ride Pays des Collines loop"));
  await revealButtons();
  await fireEvent.press(screen.getByLabelText("Back to the map"));
  expect(screen.getByLabelText("Where to?")).toBeTruthy();
});

test("recent rides are kept between launches, newest first without repeats, and can be cleared", async () => {
  await AsyncStorage.clear();
  const first = await render(<App />);
  await fireEvent.press(screen.getByLabelText("Roadbooks"));
  await fireEvent.press(screen.getByText("Pays des Collines loop"));
  await revealButtons();
  await fireEvent.press(screen.getByLabelText("Back to the list"));
  await fireEvent.press(screen.getByText("Pays des Collines loop")); // the same roadbook again
  await revealButtons();
  await fireEvent.press(screen.getByLabelText("Back to the list"));
  await fireEvent.press(screen.getByLabelText("Back to the map"));
  await flush();
  expect(screen.getAllByLabelText(/^Ride Pays des Collines loop$/)).toHaveLength(1);
  await first.unmount();

  await render(<App />);
  await flush();
  expect(screen.getAllByLabelText(/^Ride Pays des Collines loop$/)).toHaveLength(1);
  await fireEvent.press(screen.getByLabelText("Open the menu"));
  await fireEvent.press(screen.getByLabelText("Clear recent rides"));
  await flush();
  expect(screen.getByText("Places and roadbooks you ride will appear here.")).toBeTruthy();
  expect(await AsyncStorage.getItem("recents")).toBeNull();
});

function Boom(): never {
  throw new Error("kaboom");
}

test("a render error shows its message and a way back instead of closing the app", async () => {
  const spy = jest.spyOn(console, "error").mockImplementation(() => {});
  const onBack = jest.fn();
  await render(
    <ErrorBoundary onBack={onBack}>
      <Boom />
    </ErrorBoundary>,
  );
  expect(screen.getByText("Something went wrong")).toBeTruthy();
  expect(screen.getByText("Error: kaboom")).toBeTruthy();
  await fireEvent.press(screen.getByText("Back to the list"));
  expect(onBack).toHaveBeenCalled();
  spy.mockRestore();
});

test("a healthy child renders through the boundary", async () => {
  await render(
    <ErrorBoundary onBack={() => {}}>
      <Text>fine</Text>
    </ErrorBoundary>,
  );
  expect(screen.getByText("fine")).toBeTruthy();
});

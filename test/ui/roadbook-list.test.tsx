import { fireEvent, render, screen } from "@testing-library/react-native";
import App from "../../App.tsx";
import { RoadbookList } from "../../src/ui/RoadbookList.tsx";
import { flush } from "./flush.ts";
import { prepared } from "./helpers.ts";

test("each tile has the shape of its roadbook drawn behind it", async () => {
  const rbs = prepared().slice(0, 2);
  await render(<RoadbookList roadbooks={rbs} onOpen={() => {}} />);
  await flush();
  const thumbs = screen.getAllByTestId("route-thumb", { hidden: true });
  expect(thumbs).toHaveLength(rbs.length);
  // Drawn once the tile has a size.
  for (const t of thumbs) await fireEvent(t, "layout", { nativeEvent: { layout: { width: 300, height: 90 } } });
  expect(thumbs[0]!.children.length).toBeGreaterThan(5);
});

test("Back is an arrow with a name, not a word", async () => {
  const onBack = jest.fn();
  await render(<RoadbookList roadbooks={prepared().slice(0, 1)} onOpen={() => {}} onBack={onBack} />);
  expect(screen.queryByText("Back")).toBeNull();
  await fireEvent.press(screen.getByLabelText("Back to the map"));
  expect(onBack).toHaveBeenCalledTimes(1);
});

test("a swipe from the left edge goes back on the screens that have a back arrow, and a scroll does not", async () => {
  await render(<App />);
  await flush();
  await fireEvent.press(screen.getByLabelText("Roadbooks"));
  const title = () => screen.getByText("Pick a roadbook");
  const touch = async (x0: number, y0: number, x1: number, y1: number) => {
    await fireEvent(title(), "touchStart", { nativeEvent: { pageX: x0, pageY: y0 } });
    await fireEvent(title(), "touchEnd", { nativeEvent: { pageX: x1, pageY: y1 } });
  };
  await touch(200, 300, 380, 300);
  await touch(10, 600, 20, 100);
  expect(title()).toBeTruthy();
  await touch(8, 300, 200, 320);
  expect(screen.queryByText("Pick a roadbook")).toBeNull();
  expect(screen.getByText("Where to?")).toBeTruthy();
});

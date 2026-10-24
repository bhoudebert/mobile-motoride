import { fireEvent, render, screen } from "@testing-library/react-native";
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

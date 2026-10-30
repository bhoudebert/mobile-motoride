import { INSTRUCTION_BAR_TOP } from "../../src/ui/InstructionBar.tsx";
import { TOP_INSET } from "../../src/ui/insets.ts";

// An iPhone with a Dynamic Island: 59 points of system area at the top. jest-expo runs as iOS.
jest.mock("react-native-safe-area-context", () => ({
  initialWindowMetrics: { insets: { top: 59, bottom: 34, left: 0, right: 0 } },
}));

describe("the top of the screen on an iPhone", () => {
  it("leaves the room the system asks for", () => {
    expect(TOP_INSET).toBe(59);
  });

  it("puts the instruction bar under the camera, not behind it", () => {
    expect(INSTRUCTION_BAR_TOP).toBe(59 + 8);
  });
});

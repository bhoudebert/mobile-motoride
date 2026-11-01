import { fireEvent, render, screen } from "@testing-library/react-native";
import App from "../../App.tsx";
import { files, resetFiles } from "./filesystem.mock.ts";
import { flush } from "./flush.ts";
import { keepFixtures } from "./helpers.ts";
import { shareAsync, state as sharing } from "./sharing.mock.ts";

// Spec roadbook-library, "Save a roadbook as a file": the roadbook goes to the share sheet as a file that can be imported again.
beforeEach(() => {
  resetFiles();
  keepFixtures();
  shareAsync.mockClear();
  sharing.available = true;
  sharing.fail = false;
});

const openList = async () => {
  await render(<App />);
  await flush();
  await fireEvent.press(screen.getByLabelText("Roadbooks"));
  await flush();
};

test("a kept roadbook is handed to the share sheet as a roadbook file that can be imported again", async () => {
  await openList();
  await fireEvent.press(screen.getByLabelText("Save or share the file of Pays des Collines loop"));
  await flush();
  expect(shareAsync).toHaveBeenCalledTimes(1);
  const [uri, options] = shareAsync.mock.calls[0] as [string, { mimeType: string }];
  expect(uri).toMatch(/^file:\/\/\/cache\/roadbook-files\/pays-des-collines-loop.*\.motoride\.json$/);
  expect(options.mimeType).toBe("application/json");
  const doc = JSON.parse(files.get(uri)!);
  expect(doc.format).toBe("motoride-roadbook");
  expect(doc.name).toBe("Pays des Collines loop");
  expect(typeof doc.line).toBe("string");
  expect(doc.stops.length).toBeGreaterThan(1);
});

test("a phone that cannot share says so, and a cancelled share says it could not be shared", async () => {
  sharing.available = false;
  await openList();
  await fireEvent.press(screen.getByLabelText("Save or share the file of Pays des Collines loop"));
  await flush();
  expect(screen.getByText("This phone cannot share files from the app.")).toBeTruthy();
  sharing.available = true;
  sharing.fail = true;
  await fireEvent.press(screen.getByLabelText("Save or share the file of Pays des Collines loop"));
  await flush();
  expect(screen.getByText("The file could not be shared.")).toBeTruthy();
});

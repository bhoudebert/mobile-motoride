import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Linking } from "react-native";
import App from "../../App.tsx";
import { drawLine } from "../helpers/path.ts";
import { roadbookFile } from "../helpers/polyline.ts";
import { dirs, files, resetFiles } from "./filesystem.mock.ts";
import { getDocumentAsync, picked } from "./picker.mock.ts";
import { resetMapMock } from "./maplibre.mock.tsx";
import { flush } from "./flush.ts";
import { keepFixtures, revealButtons } from "./helpers.ts";
import { EnrichError, enrichRoadbook } from "../../src/services/enrich.ts";
import { serializeStored } from "../../src/core/library.ts";
import type { Roadbook } from "../../src/core/types.ts";
import { parseImport } from "../../src/core/library.ts";
import { resetServerSetting, saveServer } from "../../src/ui/serverSetting.ts";
import { stored } from "./securestore.mock.ts";

const line = drawLine([{ straight: 3000 }]);
const gpx = (name: string) =>
  `<?xml version="1.0"?><gpx><metadata><name>${name}</name></metadata><trk><trkseg>${line
    .map(([lat, lon]) => `<trkpt lat="${lat}" lon="${lon}"/>`)
    .join("")}</trkseg></trk></gpx>`;
const rbFile = (name: string) => roadbookFile(line, { name, limits: [{ from: 0, to: 300, kmh: 70, posted: true }] });

let initialUrl: string | null = null;
let onUrl: ((e: { url: string }) => void) | null = null;

const enrich = enrichRoadbook as jest.Mock;
/** The services answer: 80 km/h and Belgium all along, no camera. */
const answers = async (rb: Roadbook) => ({
  roadbook: {
    ...rb,
    limits: [{ from: 0, to: rb.line.length - 1, kmh: 80, posted: false }],
    countries: [{ from: 0, to: rb.line.length - 1, code: "BE" }],
    cameras: [],
  },
  camerasMissing: false,
});

beforeEach(() => {
  enrich.mockReset();
  enrich.mockImplementation(answers);
  resetMapMock();
  resetFiles();
  picked.result = { canceled: true, assets: null };
  getDocumentAsync.mockClear();
  initialUrl = null;
  onUrl = null;
  jest.spyOn(Linking, "getInitialURL").mockImplementation(() => Promise.resolve(initialUrl));
  jest.spyOn(Linking, "addEventListener").mockImplementation(((_: string, h: (e: { url: string }) => void) => {
    onUrl = h;
    return { remove: () => {} };
  }) as never);
  (globalThis.fetch as unknown as jest.Mock).mockImplementation(() => Promise.resolve({ ok: true }));
});
afterEach(() => jest.restoreAllMocks());
afterEach(() => resetServerSetting());

const choose = (name: string, text: string) => {
  files.set(`file:///cache/${name}`, text);
  picked.result = { canceled: false, assets: [{ uri: `file:///cache/${name}`, name, size: text.length }] };
};
const toList = async () => {
  await render(<App />);
  await flush();
  await fireEvent.press(screen.getByLabelText("Roadbooks"));
};
const kept = () => [...files.keys()].filter((k) => k.startsWith("file:///document/library/"));

test("a roadbook file picked from the phone is kept and its ride opens", async () => {
  choose("sunday.motoride.json", rbFile("Sunday loop"));
  await toList();
  await fireEvent.press(screen.getByLabelText("Import a roadbook"));
  await flush();
  expect(screen.getByText("Sunday loop")).toBeTruthy();
  expect(screen.getByText("Start")).toBeTruthy();
  expect(kept()).toHaveLength(1);
  await revealButtons();
  await fireEvent.press(screen.getByLabelText("Back to the list"));
  expect(screen.getByText("Imported from a file")).toBeTruthy();
  expect(screen.getByText("Sunday loop")).toBeTruthy();
});

test("a GPX is completed with limits and countries when it comes in, and the limit shows on the ride", async () => {
  choose("route.gpx", gpx("A GPX ride"));
  await toList();
  await fireEvent.press(screen.getByLabelText("Import a roadbook"));
  await flush();
  expect(enrich).toHaveBeenCalledTimes(1);
  expect(screen.getByText("A GPX ride")).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
  const stored = JSON.parse([...files.entries()].find(([k]) => k.startsWith("file:///document/library/"))![1]);
  expect(stored.roadbook.limits).toHaveLength(1);
  expect(stored.completion).toBeUndefined();
});

test("a roadbook file that already has its limits is not sent to the services", async () => {
  choose("rb.motoride.json", rbFile("Complete one"));
  await toList();
  await fireEvent.press(screen.getByLabelText("Import a roadbook"));
  await flush();
  expect(enrich).not.toHaveBeenCalled();
});

test("the progress of the completion is shown while it runs", async () => {
  let release: (v: unknown) => void = () => {};
  enrich.mockImplementation(async (rb: Roadbook, options: { onProgress: (s: number) => void }) => {
    options.onProgress(0.4);
    await new Promise((r) => (release = r));
    return answers(rb);
  });
  choose("route.gpx", gpx("Slow one"));
  await toList();
  await fireEvent.press(screen.getByLabelText("Import a roadbook"));
  await flush();
  expect(screen.getByText("Adding speed limits and cameras… 40%")).toBeTruthy();
  await act(async () => release(null));
  await flush();
  expect(screen.getByText("Start")).toBeTruthy();
});

test("when the services cannot be reached the GPX is kept without limits, says so, and can be completed from the list", async () => {
  enrich.mockRejectedValueOnce(new EnrichError("The routing service is busy. Try again in a minute."));
  choose("route.gpx", gpx("Later one"));
  await toList();
  await fireEvent.press(screen.getByLabelText("Import a roadbook"));
  await flush();
  expect(
    screen.getByText(
      "Imported without speed limits. The routing service is busy. Try again in a minute. You can try again from the list.",
    ),
  ).toBeTruthy();
  expect(screen.getByText("Start")).toBeTruthy();
  expect(screen.getByLabelText("Speed limit unknown")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Dismiss"));
  await revealButtons();
  await fireEvent.press(screen.getByLabelText("Back to the list"));
  await fireEvent.press(screen.getByLabelText("Add speed limits and cameras to Later one"));
  await flush();
  expect(enrich).toHaveBeenCalledTimes(2);
  expect(screen.queryByLabelText("Add speed limits and cameras to Later one")).toBeNull();
  const stored = JSON.parse([...files.entries()].find(([k]) => k.startsWith("file:///document/library/"))![1]);
  expect(stored.roadbook.limits).toHaveLength(1);
  expect(stored.completion).toBeUndefined();
});

test("an unexpected failure of the services is said, never thrown", async () => {
  enrich.mockRejectedValueOnce(new Error("boom"));
  choose("route.gpx", gpx("Odd one"));
  await toList();
  await fireEvent.press(screen.getByLabelText("Import a roadbook"));
  await flush();
  expect(screen.getByText(/^Imported without speed limits\. The services could not be reached\./)).toBeTruthy();
  expect(screen.getByText("Start")).toBeTruthy();
});

test("when only the cameras are missing the limits are kept and the list offers to try again", async () => {
  enrich.mockImplementationOnce(async (rb: Roadbook) => ({ ...(await answers(rb)), camerasMissing: true }));
  choose("route.gpx", gpx("No cameras yet"));
  await toList();
  await fireEvent.press(screen.getByLabelText("Import a roadbook"));
  await flush();
  expect(
    screen.getByText("Speed limits added. The cameras could not be looked up; try again from the list."),
  ).toBeTruthy();
});

test("what is not a roadbook is refused with the reason, and nothing changes", async () => {
  choose("photo.txt", "just words");
  await toList();
  await fireEvent.press(screen.getByLabelText("Import a roadbook"));
  await flush();
  expect(screen.getByText("This is not a roadbook file or a GPX file.")).toBeTruthy();
  expect(screen.getByText("Pick a roadbook")).toBeTruthy();
  expect(kept()).toHaveLength(0);
  await fireEvent.press(screen.getByLabelText("Dismiss"));
  expect(screen.queryByText("This is not a roadbook file or a GPX file.")).toBeNull();
});

test("leaving the picker without a file does nothing", async () => {
  await toList();
  await fireEvent.press(screen.getByLabelText("Import a roadbook"));
  await flush();
  expect(getDocumentAsync).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Pick a roadbook")).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
});

test("the same file twice is one roadbook", async () => {
  choose("a.gpx", gpx("Twice"));
  await toList();
  for (let i = 0; i < 2; i++) {
    await fireEvent.press(screen.getByLabelText("Import a roadbook"));
    await flush();
    await revealButtons();
    await fireEvent.press(screen.getByLabelText("Back to the list"));
  }
  expect(screen.getAllByText("Twice")).toHaveLength(1);
  expect(kept()).toHaveLength(1);
});

const refreshed = (route: number, generatedAt: string, n = 7, name = "Agent loop") =>
  roadbookFile(drawLine([{ straight: route }]), {
    name,
    generatedAt,
    origin: { app: "agentRide", roadbook: n, ride: 1, name },
    limits: [{ from: 0, to: 2, kmh: 70, posted: true }],
  });
const importAgain = async () => {
  await fireEvent.press(screen.getByLabelText("Import a roadbook"));
  await flush();
  await revealButtons();
  await fireEvent.press(screen.getByLabelText("Back to the list"));
};

test("a refreshed roadbook replaces its old copy in place, an older one does not", async () => {
  await toList();
  choose("a.motoride.json", refreshed(3000, "2026-10-10T00:00:00.000Z"));
  await importAgain();
  const [first] = kept();
  choose("b.motoride.json", refreshed(5000, "2026-10-20T00:00:00.000Z"));
  await importAgain();
  expect(kept()).toEqual([first]);
  expect(screen.getAllByText("Agent loop")).toHaveLength(1);
  const stored = () => JSON.parse(files.get(first!)!);
  const length = stored().roadbook.line.length;
  expect(length).toBeGreaterThan(2);
  // An older file: the newer copy stays, opens, and says so.
  choose("c.motoride.json", refreshed(1000, "2026-10-01T00:00:00.000Z"));
  await fireEvent.press(screen.getByLabelText("Import a roadbook"));
  await flush();
  expect(screen.getByText(/newer version of “Agent loop” is already kept/)).toBeTruthy();
  expect(stored().roadbook.line).toHaveLength(length);
  expect(kept()).toEqual([first]);
});

test("the same number under another name is a second roadbook", async () => {
  await toList();
  choose("a.motoride.json", refreshed(3000, "2026-10-10T00:00:00.000Z"));
  await importAgain();
  choose("b.motoride.json", refreshed(3000, "2026-10-10T00:00:00.000Z", 7, "Other loop"));
  await importAgain();
  expect(kept()).toHaveLength(2);
});

test("an imported roadbook is deleted after a question", async () => {
  choose("a.gpx", gpx("To delete"));
  await toList();
  await fireEvent.press(screen.getByLabelText("Import a roadbook"));
  await flush();
  await revealButtons();
  await fireEvent.press(screen.getByLabelText("Back to the list"));
  expect(screen.getAllByLabelText(/^Delete /)).toHaveLength(1);
  await fireEvent.press(screen.getByLabelText("Delete To delete?"));
  expect(screen.getByText("Delete this roadbook?")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Keep it"));
  expect(screen.getByText("To delete")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Delete To delete?"));
  await fireEvent.press(screen.getByLabelText("Delete To delete"));
  await flush();
  expect(screen.queryByText("To delete")).toBeNull();
  expect(kept()).toHaveLength(0);
  expect(screen.getByText(/^No roadbook yet\./)).toBeTruthy();
});

test("roadbooks kept on the phone are there at launch, newest first; a damaged one is skipped", async () => {
  const old = parseImport(gpx("Old one"));
  const fresh = parseImport(gpx("Fresh one"));
  files.set(`file:///document/library/${old.id}.json`, serializeStored({ roadbook: old, importedAt: 1 }));
  files.set(`file:///document/library/${fresh.id}.json`, serializeStored({ roadbook: fresh, importedAt: 2 }));
  files.set("file:///document/library/broken.json", "{not json");
  dirs.add("file:///document/library");
  await toList();
  const names = screen.getAllByText(/^(Fresh one|Old one)$/).map((n) => n.props.children);
  expect(names).toEqual(["Fresh one", "Old one"]);
});

test("a file the phone opens the app with is imported", async () => {
  initialUrl = "content://downloads/ride%20one.gpx";
  files.set(initialUrl, gpx("Opened with"));
  await render(<App />);
  await flush();
  expect(screen.getByText("Opened with")).toBeTruthy();
  expect(screen.getByText("Start")).toBeTruthy();
  expect(kept()).toHaveLength(1);
});

test("a file opened while the app is running is imported once, even if the phone says it twice", async () => {
  await render(<App />);
  await flush();
  files.set("content://x/y.gpx", gpx("While running"));
  await act(async () => {
    onUrl!({ url: "content://x/y.gpx" });
    onUrl!({ url: "content://x/y.gpx" });
  });
  await flush();
  expect(screen.getByText("While running")).toBeTruthy();
  expect(kept()).toHaveLength(1);
});

test("an import link downloads the file and opens its ride", async () => {
  const fetchMock = globalThis.fetch as unknown as jest.Mock;
  fetchMock.mockImplementation(() => Promise.resolve({ ok: true, text: async () => rbFile("From a link") }));
  initialUrl =
    "mobilemotoride://import?url=" + encodeURIComponent("http://192.168.1.5:8000/r/abc123/ride.motoride.json");
  await render(<App />);
  await flush();
  expect(fetchMock).toHaveBeenCalledWith("http://192.168.1.5:8000/r/abc123/ride.motoride.json", expect.anything());
  expect(screen.getByText("From a link")).toBeTruthy();
  expect(kept()).toHaveLength(1);
});

test("an import link that is not http or https, or a download that fails, says so", async () => {
  initialUrl = "mobilemotoride://import?url=" + encodeURIComponent("file:///etc/passwd");
  await render(<App />);
  await flush();
  expect(screen.getByText("That link is not a valid import link.")).toBeTruthy();
  const fetchMock = globalThis.fetch as unknown as jest.Mock;
  fetchMock.mockImplementation(() => Promise.reject(new TypeError("Network request failed")));
  await act(async () => {
    onUrl!({ url: "mobilemotoride://import?url=" + encodeURIComponent("https://example.org/a.json") });
  });
  await flush();
  expect(screen.getByText("The file could not be downloaded. Check the network and the address.")).toBeTruthy();
  fetchMock.mockImplementation(() => Promise.resolve({ ok: false, status: 404 }));
  await act(async () => {
    onUrl!({ url: "mobilemotoride://import?url=" + encodeURIComponent("https://example.org/b.json") });
  });
  await flush();
  expect(screen.getByText("The address answered 404.")).toBeTruthy();
  expect(kept()).toHaveLength(0);
});

test("the menu of the map offers the import too", async () => {
  choose("m.gpx", gpx("From the menu"));
  await render(<App />);
  await flush();
  await fireEvent.press(screen.getByLabelText("Open the menu"));
  await fireEvent.press(screen.getByLabelText("Import a roadbook"));
  await flush();
  expect(screen.getByText("From the menu")).toBeTruthy();
  expect(screen.getByText("Start")).toBeTruthy();
});

test("an imported roadbook is among the recent rides", async () => {
  choose("r.gpx", gpx("Recent one"));
  await toList();
  await fireEvent.press(screen.getByLabelText("Import a roadbook"));
  await flush();
  await revealButtons();
  await fireEvent.press(screen.getByLabelText("Back to the list"));
  await fireEvent.press(screen.getByLabelText("Back to the map"));
  await flush();
  expect(screen.getByLabelText("Ride Recent one")).toBeTruthy();
});

// Spec roadbook-library, "Roadbooks on the rider's server".
const SERVER = { url: "https://rides.example.org", token: "mrt_" + "A".repeat(43) };
const fetchMock = globalThis.fetch as unknown as jest.Mock;
type Listed = { id: number; name: string; stamp: string };
const serverSays = (listed: Listed[], file: (id: number) => string, etag = "s1") =>
  fetchMock.mockImplementation(async (url: string) => {
    if (url === `${SERVER.url}/roadbooks`)
      return {
        ok: true,
        status: 200,
        json: async () => ({ roadbooks: listed.map((l) => ({ ...l, distanceKm: 3, ridingMinutes: 5 })) }),
      };
    const m = /\/roadbook\/(\d+)$/.exec(url);
    if (m) return { ok: true, status: 200, text: async () => file(Number(m[1])), headers: { get: () => `"${etag}"` } };
    return { ok: true };
  });
const withServer = async () => {
  await resetServerSetting();
  await saveServer(SERVER);
};

test("a roadbook of the server is downloaded, then refreshed in place when its stamp changes", async () => {
  await withServer();
  serverSays([{ id: 7, name: "Agent loop", stamp: "s1" }], () => refreshed(3000, "2026-10-10T00:00:00.000Z"));
  await toList();
  await flush();
  await fireEvent.press(screen.getByLabelText("Download Agent loop"));
  await flush();
  const [first] = kept();
  expect(kept()).toHaveLength(1);
  expect(JSON.parse(files.get(first!)!).serverStamp).toBe("s1");
  expect(JSON.parse(files.get(first!)!).serverId).toBe(7);
  await revealButtons();
  await fireEvent.press(screen.getByLabelText("Back to the list"));
  // One card for it, no second row: marked as from the server, up to date, with its delete.
  expect(screen.getAllByText("Agent loop")).toHaveLength(1);
  expect(screen.getByText("From your server")).toBeTruthy();
  expect(screen.queryByLabelText("Download Agent loop")).toBeNull();
  expect(screen.getByLabelText("Delete Agent loop?")).toBeTruthy();
  // Same stamp: up to date, no action.
  expect(screen.queryByLabelText("Refresh Agent loop, a newer version is on your server")).toBeNull();
  expect(screen.getByLabelText("Agent loop: Up to date")).toBeTruthy();
  // The server has a newer one.
  serverSays([{ id: 7, name: "Agent loop", stamp: "s2" }], () => refreshed(5000, "2026-10-20T00:00:00.000Z"), "s2");
  await fireEvent.press(screen.getByLabelText("Back to the map"));
  await fireEvent.press(screen.getByLabelText("Roadbooks"));
  await flush();
  await fireEvent.press(screen.getByLabelText("Refresh Agent loop, a newer version is on your server"));
  await flush();
  expect(kept()).toEqual([first]);
  expect(JSON.parse(files.get(first!)!).serverStamp).toBe("s2");
  // Deleting it brings its download back.
  await revealButtons();
  await fireEvent.press(screen.getByLabelText("Back to the list"));
  await fireEvent.press(screen.getByLabelText("Delete Agent loop?"));
  await fireEvent.press(screen.getByLabelText("Delete Agent loop"));
  await flush();
  expect(kept()).toHaveLength(0);
  expect(screen.getByLabelText("Download Agent loop")).toBeTruthy();
});

test("a roadbook the server has and the phone does not is a card of its own with a download", async () => {
  await withServer();
  serverSays([{ id: 7, name: "Agent loop", stamp: "s1" }], () => "");
  await toList();
  await flush();
  expect(screen.getByText("On your server")).toBeTruthy();
  expect(screen.getByLabelText("Download Agent loop")).toBeTruthy();
});

test("with no server there is no server section, and nothing is asked", async () => {
  stored.clear();
  await resetServerSetting();
  await toList();
  expect(screen.queryByText("On your server")).toBeNull();
  expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith("/roadbooks"))).toBe(false);
});

test("a server that cannot be reached leaves the list as it was and offers to try again", async () => {
  keepFixtures();
  await withServer();
  fetchMock.mockImplementation(async () => Promise.reject(new TypeError("down")));
  await toList();
  await flush();
  expect(screen.getByText(/Your server could not be reached/)).toBeTruthy();
  expect(screen.getByText("Pays des Collines loop")).toBeTruthy();
  serverSays([{ id: 7, name: "Agent loop", stamp: "s1" }], () => "");
  await fireEvent.press(screen.getByLabelText("Try again"));
  await flush();
  expect(screen.getByLabelText("Download Agent loop")).toBeTruthy();
});

test("a server that does not offer roadbooks shows no section", async () => {
  await withServer();
  fetchMock.mockImplementation(async () => ({ ok: false, status: 404 }));
  await toList();
  await flush();
  expect(screen.queryByText("On your server")).toBeNull();
});

test("a roadbook that fails to come says why and keeps nothing", async () => {
  await withServer();
  serverSays([{ id: 7, name: "Agent loop", stamp: "s1" }], () => "");
  fetchMock.mockImplementation(async (url: string) =>
    url.endsWith("/roadbooks")
      ? {
          ok: true,
          status: 200,
          json: async () => ({
            roadbooks: [{ id: 7, name: "Agent loop", stamp: "s1", distanceKm: 1, ridingMinutes: 1 }],
          }),
        }
      : { ok: false, status: 502 },
  );
  await toList();
  await flush();
  await fireEvent.press(screen.getByLabelText("Download Agent loop"));
  await flush();
  expect(screen.getByText(/could not make this roadbook/)).toBeTruthy();
  expect(kept()).toHaveLength(0);
});

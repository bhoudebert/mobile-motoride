import { fireEvent, render, screen } from "@testing-library/react-native";
import App from "../../App.tsx";
import { forgetLibraryIdentities } from "../../src/ui/libraryIdentity.ts";
import { resetServerSetting, saveServer } from "../../src/ui/serverSetting.ts";
import { files, resetFiles } from "./filesystem.mock.ts";
import { flush } from "./flush.ts";
import { keepFixtures } from "./helpers.ts";
import { stored } from "./securestore.mock.ts";

// Spec roadbook-library, "Changing server keeps what is on the phone": send what is only on the phone to the server.
const fetchMock = globalThis.fetch as unknown as jest.Mock;
const SERVER = { url: "https://rides.example.org", token: "mrt_" + "A".repeat(43) };
const json = (status: number, body: unknown, headers: Record<string, string> = {}) => ({
  ok: status < 300,
  status,
  headers: { get: (k: string) => headers[k] ?? null },
  json: async () => body,
});
const ME = {
  hosted: true,
  riderRef: "rr-0123456789abcdef",
  traffic: { mode: "open", perDay: null, usedToday: 0 },
  library: { limitMb: 20, usedBytes: 3_355_443 },
};
let puts: string[] = [];
let answerFor: (n: number) => ReturnType<typeof json>;

beforeEach(async () => {
  resetFiles();
  keepFixtures();
  await resetServerSetting();
  forgetLibraryIdentities();
  stored.clear();
  puts = [];
  answerFor = (n) => json(200, { id: 10 + n, replaced: false, stamp: `stamp-${n}` });
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === "PUT" && url.endsWith("/roadbooks")) {
      puts.push(String(init.body));
      return answerFor(puts.length);
    }
    if (url.endsWith("/me")) return json(200, ME);
    if (url.endsWith("/roadbooks")) return json(200, { roadbooks: [] });
    return json(200, {});
  });
});
afterEach(() => fetchMock.mockImplementation(() => Promise.resolve({ ok: true })));

const openList = async () => {
  await saveServer(SERVER);
  await render(<App />);
  await flush();
  await fireEvent.press(screen.getByLabelText("Roadbooks"));
  await flush();
};
const kept = () =>
  [...files.entries()].filter(([k]) => k.startsWith("file:///document/library/")).map(([, v]) => JSON.parse(v));

test("the roadbooks only on the phone are counted with the room left, then sent one by one and linked to the server's numbers", async () => {
  await openList();
  expect(screen.getByText("4 roadbooks are only on this phone.")).toBeTruthy();
  expect(screen.getByText("Library 3.2 of 20 MB on your server.")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Send the roadbooks that are only on this phone to your server"));
  await flush(25);
  expect(puts).toHaveLength(4);
  expect(JSON.parse(puts[0]!).format).toBe("motoride-roadbook");
  expect(screen.getByText("4 roadbooks sent to your server.")).toBeTruthy();
  expect(
    kept()
      .map((k) => k.serverId)
      .sort(),
  ).toEqual([11, 12, 13, 14]);
  expect(kept().every((k) => typeof k.serverKey === "string" && k.serverStamp)).toBe(true);
});

test("a full library stops the sending, says so with the figures and what to do, and offers My rides", async () => {
  answerFor = (n) =>
    n < 3 ? json(200, { id: 10 + n, replaced: false, stamp: "s" }) : json(413, { error: "library_full" });
  await openList();
  await fireEvent.press(screen.getByLabelText("Send the roadbooks that are only on this phone to your server"));
  await flush(25);
  expect(puts).toHaveLength(3);
  expect(screen.getByText("2 of 4 sent.")).toBeTruthy();
  expect(
    screen.getByText(
      "Your server library is full (3.2 of 20 MB). Your rides are still on this phone; delete older ones from the server to make room.",
    ),
  ).toBeTruthy();
  expect(screen.getByLabelText("Open My rides")).toBeTruthy();
  expect(kept().filter((k) => k.serverId !== undefined)).toHaveLength(2);
});

test("nothing is offered to send when there is no server", async () => {
  fetchMock.mockImplementation(async () => json(200, { roadbooks: [] }));
  await render(<App />);
  await flush();
  await fireEvent.press(screen.getByLabelText("Roadbooks"));
  expect(screen.queryByText(/only on this phone/)).toBeNull();
});

test("each roadbook that is only on the phone has its own send icon, which sends that one and links it", async () => {
  await openList();
  expect(screen.getAllByLabelText(/^Send [A-Z].* to your server$/)).toHaveLength(4);
  await fireEvent.press(screen.getByLabelText("Send Pays des Collines loop to your server"));
  await flush(25);
  expect(puts).toHaveLength(1);
  expect(JSON.parse(puts[0]!).name).toBe("Pays des Collines loop");
  expect(screen.queryByLabelText("Send Pays des Collines loop to your server")).toBeNull();
  expect(screen.getAllByLabelText(/^Send [A-Z].* to your server$/)).toHaveLength(3);
  expect(kept().filter((k) => k.serverId !== undefined)).toHaveLength(1);
  expect(screen.getByText("3 roadbooks are only on this phone.")).toBeTruthy();
});

test("a refusal shows on the row it concerns, and the roadbook stays on the phone", async () => {
  answerFor = () => json(413, { error: "library_full" });
  await openList();
  await fireEvent.press(screen.getByLabelText("Send Pays des Collines loop to your server"));
  await flush(25);
  expect(
    screen.getByText(
      "Your server library is full. Your rides are still on this phone; delete older ones from the server to make room.",
    ),
  ).toBeTruthy();
  expect(screen.getByLabelText("Send Pays des Collines loop to your server")).toBeTruthy();
  expect(kept().filter((k) => k.serverId !== undefined)).toHaveLength(0);
});

test("without a server a roadbook has no send icon", async () => {
  fetchMock.mockImplementation(async () => json(200, { roadbooks: [] }));
  await render(<App />);
  await flush();
  await fireEvent.press(screen.getByLabelText("Roadbooks"));
  expect(screen.queryByLabelText(/to your server$/)).toBeNull();
});

// Drives the real app on a connected, unlocked phone through the whole ride flow and checks it did not break:
// no crash in the log, every screen laid out sanely (nothing off screen, no overlapping or tiny buttons).
// Needs adb, Metro on :8081 (npm start; SMOKE_METRO_PORT for another port), agentRide next to this repository and the dev build installed.
// Usage: npm run smoke:device                    the whole run, before a release (about 5 minutes)
//        npm run smoke:device -- --only key,join  just those sections, while working on them
// Sections: voice, demo, roadbooks, gps, background, safety, destination, import, rides, share, control, key, join, zone, offline. The app opening and the list are always checked.
//
// `uiautomator dump` waits for a full second without any change on screen. A running demo changes the screen every
// second, so the script pauses the demo before it reads anything, and resumes it to let the ride go on.
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { webcrypto } from "node:crypto";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { fixtureRoadbooks, pushFixtures } from "./device/fixtureServer.ts";
import {
  above,
  appCrashes,
  center,
  contains,
  find,
  layoutProblems,
  otherSmokeRuns,
  type Screen,
  type UiNode,
  parseDump,
  overlaps,
} from "./device/ui.ts";

const PKG = "com.adequatefunction.motoride";
// disableOnboarding: a fresh install shows the developer menu intro on every start, which would cover the whole script.
// The &, escaped, so the phone's shell does not take it for the end of the command.
/** Where Metro runs; SMOKE_METRO_PORT says otherwise when 8081 is held by an older dev server. */
const METRO_PORT = Number(process.env["SMOKE_METRO_PORT"] ?? 8081);
const LINK = `exp+mobile-motoride://expo-development-client/?url=http%3A%2F%2Flocalhost%3A${METRO_PORT}\\&disableOnboarding=1`;
const OUT = `.smoke/${new Date().toISOString().replace(/[:.]/g, "-")}`;
mkdirSync(OUT, { recursive: true });

const SECTIONS = [
  "voice",
  "gauges",
  "demo",
  "roadbooks",
  "gps",
  "background",
  "safety",
  "destination",
  "import",
  "rides",
  "share",
  "control",
  "key",
  "join",
  "zone",
  "offline",
];
const onlyAt = process.argv.indexOf("--only");
const only = onlyAt >= 0 ? (process.argv[onlyAt + 1] ?? "").split(",").filter(Boolean) : null;
/** Whether a section is to run: all of them, or the ones named with --only. */
const want = (name: string) => only === null || only.includes(name);

// What `adb` calls only read: any other call (a tap, a launch, a key) may change the screen.
const READS = new Set(["uiautomator", "logcat", "devices", "dumpsys", "wm", "reverse", "screencap", "pgrep"]);
/** The screen as last read, while nothing has touched the phone or waited since: reading it again is free. */
let screenCache: UiNode[] | null = null;

const adb = (...args: string[]) => {
  if (!args.some((a) => READS.has(a)) && args[0] !== "exec-out") screenCache = null;
  return execFileSync("adb", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, timeout: 30_000 });
};
/** Time passes: the screen may have moved on. */
const sleep = (ms: number) => {
  screenCache = null;
  return new Promise((r) => setTimeout(r, ms));
};

const results: { name: string; ok: boolean; detail: string }[] = [];
function check(name: string, ok: boolean, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

/** Thrown to end the run early with a clear reason: a step the rest depends on has failed. */
class Abort extends Error {}

/**
 * Stop leftover uiautomator processes on the phone. Matches the process name exactly: `pkill -f` would match its own
 * shell (the command line contains the word) and kill it. No match is an answer too, so errors are ignored.
 */
function clearStaleUiautomator() {
  try {
    adb("shell", "pkill", "-x", "uiautomator");
  } catch {
    // none running
  }
}

let dumpFailures = 0;
/** The screen as nodes, or null when the phone would not give it (the screen never went quiet). */
/**
 * `uiautomator dump /dev/stdout` hands the screen over in one call; an older phone that will not is read the slow way,
 * through a file, and remembered.
 */
let direct = true;
function dump(): UiNode[] | null {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (direct) {
        const out = adb("exec-out", "uiautomator", "dump", "/dev/stdout");
        if (/could not get idle state/i.test(out)) throw new Error("not idle");
        const start = out.indexOf("<?xml");
        const end = out.indexOf("</hierarchy>");
        if (start >= 0 && end > start) return parseDump(out.slice(start, end + "</hierarchy>".length));
        direct = false; // no XML on stdout: this phone needs the file
      }
      const out = adb("shell", "uiautomator", "dump", "/sdcard/mmr-ui.xml");
      if (/could not get idle state/i.test(out)) throw new Error("not idle");
      return parseDump(adb("exec-out", "cat", "/sdcard/mmr-ui.xml"));
    } catch {
      dumpFailures++;
      // A dump that died can leave its uiautomator behind, and that blocks the next one.
      clearStaleUiautomator();
    }
  }
  return null;
}

/** The screen, or the end of the run: reading a moving screen is the one thing this script cannot do. */
function screenNow(): UiNode[] {
  if (screenCache) return screenCache;
  const nodes = dump();
  if (!nodes) {
    throw new Abort(
      "the phone would not give the screen (it never stood still for a second): is something animating? Pause the demo",
    );
  }
  screenCache = nodes;
  return nodes;
}

async function waitFor(what: string | RegExp, seconds: number): Promise<UiNode | undefined> {
  const deadline = Date.now() + seconds * 1000;
  do {
    const n = find(screenNow(), what);
    if (n) return n;
    await sleep(800);
  } while (Date.now() < deadline);
  return undefined;
}

function shot(name: string) {
  writeFileSync(
    `${OUT}/${name}.png`,
    execFileSync("adb", ["exec-out", "screencap", "-p"], { maxBuffer: 64 * 1024 * 1024, timeout: 30_000 }),
  );
}

const tapAt = async (p: { x: number; y: number }) => {
  adb("shell", "input", "tap", String(p.x), String(p.y));
  await sleep(450);
};

async function tap(what: string | RegExp): Promise<boolean> {
  const n = await waitFor(what, 8);
  if (!n) return false;
  await tapAt(center(n));
  return true;
}

function screenInfo(): Screen {
  const size = /(\d+)x(\d+)/.exec(adb("shell", "wm", "size"));
  const density = /(\d+)/.exec(adb("shell", "wm", "density").split(":").pop() ?? "");
  return { width: +size![1]!, height: +size![2]!, scale: +density![1]! / 160 };
}

function layout(name: string, screen: Screen) {
  const problems = layoutProblems(screenNow(), screen);
  check(`layout: ${name}`, problems.length === 0, problems.map((p) => `${p.what}: ${p.detail}`).join("; "));
}

const INSTRUCTION =
  /^(Straight .+|Left in .+|Right in .+|U-turn in .+|Finish in .+|Rejoin the route.+|U-turn, wrong way)$/;
const CORNER = /^(HAIRPIN|SHARP) (LEFT|RIGHT)$/;

const REPLAY = "mobilemotoride://replay";

/** Start a scripted GPS ride on the open roadbook (ADR 0014): the app is in development mode on this phone. */
async function replay(scenario: string) {
  adb("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", `${REPLAY}/${scenario}`, PKG);
  await sleep(1000);
}

async function expectText(name: string, what: string | RegExp, seconds: number): Promise<UiNode | undefined> {
  const n = await waitFor(what, seconds);
  check(name, !!n, n?.text || n?.desc);
  return n;
}

/** Back to the list, then open the roadbook whose card matches `name`. */
async function openRoadbook(name: RegExp | string): Promise<boolean> {
  await stopRide();
  if (find(screenNow(), "Back to the list")) await tap("Back to the list");
  // After a restart the app is on the map: the roadbooks are one tap away.
  await waitFor(/^(Pick a roadbook|Where to\?)$/, 10);
  if (!find(screenNow(), "Pick a roadbook") && find(screenNow(), "Where to?")) await tap("Roadbooks");
  await waitFor("Pick a roadbook", 10);
  return (await tap(name)) && !!(await waitFor("Demo", 15));
}

/** The grabber at the top of the panel: a swipe or a tap on it. */
const STRIP = "Show the ride buttons";

/** While riding the buttons are folded: tap the strip, as a rider does, so Back, Pause and End can be tapped. */
async function revealButtons() {
  if (find(screenNow(), STRIP) && (await tap(STRIP))) await sleep(600); // the row slides in
}

/** Swipe the panel from `slot`, a point of it, up (the buttons come) or down (they fold), as a finger would. */
function swipePanel(slot: { x: number; y: number }, dir: "up" | "down", scale: number) {
  const from = dir === "up" ? slot.y - 20 : slot.y - 150;
  const to = dir === "up" ? from - Math.round(120 * scale) : from + Math.round(80 * scale);
  adb("shell", "input", "swipe", String(slot.x), String(from), String(slot.x), String(to), "200");
}

/** On a roadbook that is open and idle (Demo and Start offered), opening the one that matches `name` if it is not. */
async function ensureIdleRoadbook(name: RegExp | string): Promise<boolean> {
  const nodes = screenNow();
  if (find(nodes, "Demo") && find(nodes, "Start") && find(nodes, "Back to the list")) return true;
  return openRoadbook(name);
}

/** End the ride as a rider does: End, then "End ride" when a GPS ride asks. */
async function stopRide() {
  if (find(screenNow(), "Leave this ride?")) return void (await tap("End ride")); // the phone's Back asked already
  if (!find(screenNow(), STRIP) && !find(screenNow(), /^End the (ride|demo)$/)) return;
  // The buttons fold by themselves after eight seconds, and a slow dump can lose them: bring them and tap again.
  for (let i = 0; i < 3; i++) {
    await revealButtons();
    if ((await tap(/^End the (ride|demo)$/)) && (await waitFor("End ride", 3))) return void (await tap("End ride"));
  }
}

async function setNetwork(on: boolean) {
  const verb = on ? "enable" : "disable";
  adb("shell", "svc", "wifi", verb);
  adb("shell", "svc", "data", verb);
  await sleep(on ? 6000 : 3000);
}

let seedServer: ChildProcess | null = null;
let seedDir: string | null = null;

/**
 * The app ships no roadbook (ADR 0044): the ones the smoke rides come from a server, as a rider's do. agentRide's
 * server runs on this computer with a test rider, the fixture roadbooks are pushed to it, the phone is pointed at it and
 * downloads each from the list. Leaves the app on the map; false when it could not be done.
 */
async function seedRoadbooksFromServer(): Promise<boolean> {
  const agentRide = resolve("../agentRide");
  if (!existsSync(join(agentRide, "src/pushedRoadbooks.ts"))) {
    check("roadbooks: agentRide with the push to a server is next to this repository (../agentRide)", false);
    return false;
  }
  seedDir = mkdtempSync(join(tmpdir(), "smoke-roadbooks-"));
  const port = 19000 + Math.floor(Math.random() * 1000);
  const env = { ...process.env, RIDE_DATA_DIR: seedDir, RIDE_SERVER_PORT: String(port) };
  const added = execFileSync("node", ["src/admin.ts", "add", "smoke-roadbooks@example.org"], {
    cwd: agentRide,
    env,
    encoding: "utf8",
  });
  const token = /mrt_[A-Za-z0-9_-]+/.exec(added)![0];
  seedServer = spawn("node", ["src/serve.ts"], { cwd: agentRide, env, stdio: "ignore" });
  let up = false;
  for (let i = 0; i < 30 && !up; i++) {
    up = await fetch(`http://127.0.0.1:${port}/health`)
      .then((r) => r.ok)
      .catch(() => false);
    if (!up) await sleep(500);
  }
  check("roadbooks: the test server is up", up);
  if (!up) return false;
  adb("reverse", `tcp:${port}`, `tcp:${port}`);
  const pushed = await pushFixtures(`http://127.0.0.1:${port}`, token);
  const kept = pushed === fixtureRoadbooks().length;
  check("roadbooks: the server keeps the roadbooks pushed to it", kept, `${pushed}`);
  if (!kept) return false;
  adb(
    "shell",
    "am",
    "start",
    "-a",
    "android.intent.action.VIEW",
    "-d",
    `'mobilemotoride://server?url=${encodeURIComponent(`http://localhost:${port}`)}&token=${token}'`,
    PKG,
  );
  check(
    "roadbooks: the phone is pointed at the server",
    !!(await waitFor("Use this server?", 20)) && (await tap(/^use it$/i)),
  );
  await waitFor(/^Server set: /, 10);
  // Wherever the link left the app (the map, the Server screen), the list is one or two taps away.
  if (find(screenNow(), /^Back to the map$/)) await tap(/^Back to the map$/);
  if (!find(screenNow(), "Pick a roadbook")) await tap("Roadbooks");
  // Offered to download, or already kept by an earlier run (the same roadbooks come back with the same origin).
  const offered = await waitFor(/^(Download |FROM YOUR SERVER,)/i, 30);
  check("roadbooks: the list offers them on the server", !!offered);
  for (let i = 0; i < fixtureRoadbooks().length; i++) {
    if (!(await tap(/^Download /))) break;
    await waitFor("Demo", 30);
    await tap("Back to the list");
    await waitFor("Pick a roadbook", 10);
    await waitFor(/corners to watch/, 10);
  }
  const cards = screenNow().filter((n) => /^FROM YOUR SERVER,/i.test(n.desc)).length;
  check(
    "roadbooks: they are downloaded and kept, marked from the server",
    !find(screenNow(), /^Download /) && cards >= 2,
    `${cards} on screen`,
  );
  await tap("Back to the map");
  return true;
}

/** Stop the test server of `seedRoadbooksFromServer` and forget its data. */
function stopSeedServer() {
  seedServer?.kill();
  seedServer = null;
  if (seedDir) rmSync(seedDir, { recursive: true, force: true });
  seedDir = null;
}

async function run() {
  const devices = adb("devices")
    .split("\n")
    .slice(1)
    .filter((l) => /\tdevice$/.test(l));
  if (devices.length === 0) throw new Abort("no phone connected (adb devices)");
  const unknown = (only ?? []).filter((n) => !SECTIONS.includes(n));
  if (unknown.length > 0) throw new Abort(`unknown section ${unknown.join(", ")}: choose among ${SECTIONS.join(", ")}`);
  // Only one reader of the screen at a time: a second run, or a stale uiautomator, makes every dump fail with
  // "UiAutomationService already registered" (reported as "could not get idle state").
  let listing = "";
  try {
    listing = execFileSync("pgrep", ["-af", "device-smoke"], { encoding: "utf8" });
  } catch {
    // pgrep found nothing: no other run
  }
  const others = otherSmokeRuns(listing, process.pid);
  if (others.length > 0) {
    throw new Abort(`another smoke run is still going (${others[0]}): stop it with Ctrl+C or kill it first`);
  }
  clearStaleUiautomator();
  adb("shell", "input", "keyevent", "KEYCODE_WAKEUP");
  if (adb("shell", "dumpsys", "window").includes("isKeyguardShowing=true")) {
    throw new Abort("the phone is locked: unlock it and keep it awake, then run again");
  }
  adb("reverse", `tcp:${METRO_PORT}`, `tcp:${METRO_PORT}`);
  const metro = await fetch(`http://localhost:${METRO_PORT}/status`).then(
    (r) => r.text(),
    () => "",
  );
  if (!metro.includes("running")) throw new Abort(`Metro is not running on :${METRO_PORT}: run npm start first`);

  const screen = screenInfo();
  adb("logcat", "-c");
  // Else the notification of the ride's foreground service is hidden (Android 13+); granting restarts the app, so first.
  adb("shell", "pm", "grant", PKG, "android.permission.POST_NOTIFICATIONS");
  adb("shell", "am", "force-stop", PKG);
  adb("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", LINK, PKG);

  // The script reads the screen by its English texts: set the app to English, whatever the phone speaks (spec languages).
  check("the app opens on the map with a search", !!(await waitFor(/^(Where to\?|Où aller \?)$/, 60)));
  if (!find(screenNow(), "Where to?")) {
    await tap(/^(Open the menu|Ouvrir le menu)$/);
    for (let i = 0; i < 3 && !find(screenNow(), /^Language: English\. /); i++) {
      if (!(await tap(/^(Language|Langue) ?: /))) break;
    }
    await tap(/^(Close menu|Fermer le menu)$/);
  }
  check("the app is in English for the script", !!(await waitFor("Where to?", 10)));
  shot("00-home");
  layout("home", screen);
  check(
    "home: the panel offers Roadbooks, and the map has a menu and a way back to me",
    !!find(screenNow(), "Roadbooks") &&
      !!find(screenNow(), "Open the menu") &&
      !!find(screenNow(), "Centre the map on me"),
  );
  check("home: no name of the app is printed", !find(screenNow(), /^(Mobile)?MotoRide$/));
  await tap("Open the menu");
  check("home: the menu opens", !!(await waitFor("Close menu", 10)) && !!find(screenNow(), /^Voice: /));
  shot("00-home-menu");
  layout("home menu", screen);
  await tap("Close menu");
  if (!(await seedRoadbooksFromServer())) throw new Abort("no roadbook to ride: the server could not give any");
  check("home: Roadbooks opens the list", (await tap("Roadbooks")) && !!(await waitFor("Pick a roadbook", 10)));
  shot("01-list");
  layout("list", screen);
  check("the list shows roadbooks", !!find(screenNow(), /corners to watch|loop/));
  check("a roadbook opens", await tap(/loop/));
  check(
    "the ride screen has Back, Demo and Start",
    !!(await waitFor("Demo", 20)) && !!find(screenNow(), "Start") && !!find(screenNow(), "Back to the list"),
  );
  await sleep(2500);
  shot("02-ride-idle");
  layout("ride screen, idle", screen);
  for (const control of ["Zoom in", "Zoom out", "Show the whole roadbook"])
    check(`control present: ${control}`, !!find(screenNow(), control));

  if (want("voice")) {
    await ensureIdleRoadbook(/loop/);
    // The voice button goes Full, Alerts, Off and round again, and is left on Full.
    const voiceNow = () => find(screenNow(), /^Voice: /)?.desc ?? "";
    // The mode is kept between launches: start from Full whatever an earlier run left.
    for (let i = 0; i < 3 && !voiceNow().startsWith("Voice: full"); i++) {
      await tap(/^Voice: /);
      await sleep(1500);
    }
    check("voice: the button names the mode", voiceNow() === "Voice: full guidance. Tap to change", voiceNow());
    const seen: string[] = [];
    for (let i = 0; i < 3; i++) {
      await tap(/^Voice: /);
      await sleep(1500);
      seen.push(voiceNow());
    }
    check(
      "voice: a tap goes Alerts, Off, Full",
      seen.join("|") ===
        ["Voice: alerts only. Tap to change", "Voice: off. Tap to change", "Voice: full guidance. Tap to change"].join(
          "|",
        ),
      seen.join(" | "),
    );
  }

  if (want("gauges")) {
    // The gauges (spec instruments): the compass reads on a scripted ride, the card has its switches, the phone can be
    // calibrated (it lies still on the desk) and lean then reads. Everything is put back as it was.
    await ensureIdleRoadbook(/loop/);
    await replay("ride");
    await expectText("gauges: the compass reads on a ride", /^Heading (N|NE|E|SE|S|SW|W|NW), \d+ degrees$/, 40);
    layout("gauges on the ride screen", screen);
    shot("29-gauges");
    await revealButtons();
    check("gauges: the Gauges button is there", await tap("Open the gauges"));
    await expectText("gauges: the card opens", "Show the gauges", 10);
    for (const name of ["Compass", "Altitude and climb", "Slope", "Lean angle", "Braking G"])
      check(`gauges: a switch for ${name}`, !!find(screenNow(), name));
    shot("30-gauges-card");
    layout("gauges card", screen);
    const leanOn = find(screenNow(), "Lean angle")?.checked === true;
    if (!leanOn) await tap("Lean angle");
    await sleep(600);
    check("gauges: lean is switched on", find(screenNow(), "Lean angle")?.checked === true);
    check("gauges: the card offers to calibrate", !!(await waitFor(/^Calibrate( again)?$/, 5)));
    await tap(/^Calibrate( again)?$/);
    const calibration = await waitFor(
      /^(Calibrated\.|Hold the phone still, and try again\.|The sensors could not be read\. Try again\.)$/,
      15,
    );
    check(
      "gauges: the phone is calibrated",
      calibration?.text === "Calibrated.",
      calibration?.text ??
        screenNow()
          .map((n) => n.text)
          .filter(Boolean)
          .join(" | ")
          .slice(0, 300),
    );
    shot("31-gauges-calibrated");
    await tap("Close");
    const lean = await waitFor(/^Lean /, 10);
    check("gauges: lean reads on the ride screen", !!lean, lean?.desc);
    shot("32-gauges-lean");
    // Put it back: lean off, the ride ended.
    await revealButtons();
    await tap("Open the gauges");
    await waitFor("Show the gauges", 10);
    if (find(screenNow(), "Lean angle")?.checked === true) await tap("Lean angle");
    await tap("Close");
    check("gauges: lean is gone when switched off", !(await waitFor(/^Lean /, 2)));
    await stopRide();
  }

  if (want("demo")) {
    await ensureIdleRoadbook(/loop/);
    // In the demo the Pause button takes the place of the Demo button: same row, same slot.
    const slot = center(find(screenNow(), "Demo")!);
    check("Demo starts", await tap("Demo"));
    await sleep(3000);
    // Blind, since a running demo cannot be read: swipe up on the panel, as a rider does, and the row opens
    // where the Demo button was; Pause is in the same slot.
    swipePanel(slot, "up", screen.scale);
    await sleep(700);
    await tapAt(slot);
    check("the demo can be paused", !!(await waitFor("Resume the demo", 10)));
    const instruction = await waitFor(INSTRUCTION, 10);
    check("the top instruction appears", !!instruction, instruction?.text);
    check(
      "the limit sign and the speed show",
      !!find(screenNow(), /^(Speed limit|Over the speed limit)/) || !!find(screenNow(), "Speed limit unknown"),
    );
    shot("03-demo-paused");
    layout("ride screen, demo paused", screen);
    // (That they fold by themselves after 8 s is a UI test: waiting for it here would cost 9 s of the run.)
    await revealButtons();
    swipePanel(slot, "down", screen.scale);
    await sleep(900);
    check(
      "the buttons are folded while riding, and Me is offered",
      !!find(screenNow(), STRIP) && !find(screenNow(), /^End the (ride|demo)$/) && !!find(screenNow(), "Follow me"),
    );
    await revealButtons();
    check(
      "a tap on the grabber brings Back, Resume and End",
      !!find(screenNow(), /^End the (ride|demo)$/) &&
        !!find(screenNow(), "Resume the demo") &&
        !!find(screenNow(), "Back to the list"),
    );
    swipePanel(slot, "down", screen.scale);
    await sleep(1200);
    check(
      "a swipe down folds the buttons away",
      !!find(screenNow(), STRIP) && !find(screenNow(), /^End the (ride|demo)$/),
    );

    // Let the demo ride two seconds at a time and look, until a corner warning is on screen. The buttons are folded:
    // pull them out, and every tap on Resume or Pause keeps them out for 8 s more.
    swipePanel(slot, "up", screen.scale);
    await sleep(700);
    let banner: UiNode | undefined;
    for (let i = 0; i < 45 && !banner; i++) {
      await tapAt(slot); // Resume
      await sleep(2000);
      await tapAt(slot); // Pause
      banner = find(screenNow(), CORNER);
    }
    check("a corner warning appears", !!banner, banner?.text);
    if (banner) {
      shot("04-corner-warning");
      const bar = find(screenNow(), INSTRUCTION);
      check("the corner banner sits under the instruction bar", !!bar && above(bar, banner));
      layout("ride screen, corner warning", screen);
    }

    for (let i = 0; i < 3; i++) {
      if (!(await tap(/^Map: /))) {
        check(`the map button cycles (${i + 1})`, false, "button missing");
        break;
      }
      await sleep(1500);
      await sleep(1000);
      shot(`05-basemap-${i + 1}`);
      check(`the app survives the basemap switch ${i + 1}`, !!find(screenNow(), /ride buttons$/));
    }
    layout("ride screen, after basemap switches", screen);

    await tap("Zoom in");
    await tap("Zoom out");
    await tap("Show the whole roadbook");
    shot("06-overview");
    check("overview and zoom work without breaking", !!find(screenNow(), /ride buttons$/));
    await tap("Follow me");
    check("follow me works without breaking", !!find(screenNow(), /ride buttons$/));

    await revealButtons();
    check("End ends the demo, with no question", (await tap("End the demo")) && !!(await waitFor("Start", 10)));
    check("Back returns to the list", (await tap("Back to the list")) && !!(await waitFor("Pick a roadbook", 10)));
    shot("07-back-on-list");
  }

  if (want("roadbooks")) {
    if (!find(screenNow(), "Pick a roadbook")) {
      await stopRide();
      await tap("Back to the list");
      await waitFor("Pick a roadbook", 10);
    }
    // Every roadbook opens, and its ride screen is laid out.
    const cards = findAllCards();
    check("the list offers several roadbooks", cards >= 2, `${cards} cards`);
    for (let i = 0; i < cards; i++) {
      const card = findAllCardNodes()[i];
      if (!card) break;
      await tapAt(center(card));
      const opened = !!(await waitFor("Demo", 15));
      check(`roadbook ${i + 1} opens`, opened);
      if (opened) {
        await sleep(1500);
        layout(`roadbook ${i + 1}, ride screen`, screen);
        if (i === 0) {
          // The fuel stops are looked for on the network (spec fuel-stops): whatever the network says, the chip is there and opens a card.
          const chip = await waitFor(/Open the fuel stops$/, 90);
          check("fuel: the chip is on the ride screen", !!chip, chip?.desc);
          if (chip) {
            shot("03b-fuel-chip");
            check(
              "fuel: it opens the fuel stops",
              (await tap(/Open the fuel stops$/)) && !!(await waitFor(/^Tank range: \d+ km\. Tap to change$/, 8)),
            );
            shot("03c-fuel-card");
            layout("fuel card", screen);
            await tap("Close");
          }
          // The weather ahead (spec weather): whatever the network says, the row is there and opens its card.
          const wx = await waitFor(/Open the weather$/, 60);
          check("weather: the row is on the panel", !!wx, wx?.desc);
          if (wx) {
            shot("03g-weather-row");
            check(
              "weather: it opens the weather card",
              (await tap(/Open the weather$/)) && !!(await waitFor("Weather ahead", 8)),
            );
            shot("03h-weather-card");
            layout("weather card", screen);
            await tap("Close");
          }
          // Find along the route (spec places-search): whatever the network says, the card answers.
          check(
            "places: Find opens the kinds",
            (await tap("Find a place along the route")) && !!(await waitFor("Look for: Bakery", 8)),
          );
          shot("03d-places");
          layout("places card", screen);
          await tap("Look for: Bakery");
          const found = await waitFor(/Show it on the map$|^Nothing found|^The search could not be made/, 60);
          check("places: the search answers", !!found, found?.desc || found?.text);
          shot("03e-places-found");
          if (found && /Show it on the map$/.test(found.desc)) {
            check(
              "places: a place can be chosen and stays on the screen as a chip",
              (await tap(/Show it on the map$/)) && !!(await waitFor(/\. Clear it$/, 8)),
            );
            shot("03f-place-chosen");
            await tap(/\. Clear it$/);
          } else await tap("Close");
        }
        await tap("Back to the list");
        await waitFor("Pick a roadbook", 10);
      }
    }
  }

  if (want("gps")) {
    // The GPS path, on a scripted position (the phone does not move): approach, off route, wrong way, skip.
    if (find(screenNow(), "Pick a roadbook")) {
      check("a roadbook opens for the scripted rides", await tap(/loop/));
      await waitFor("Demo", 15);
    } else await ensureIdleRoadbook(/loop/);

    await replay("approach");
    const toStart = await expectText("approach: the way to the start is shown", /^To the start · /, 40);
    if (toStart) {
      shot("08-approach");
      layout("approach", screen);
      check("approach: an instruction is shown", !!find(screenNow(), INSTRUCTION));
    }
    await stopRide();

    await replay("offroute");
    // The guidance ("Rejoin the route") shows first and the road route from Valhalla replaces it within seconds,
    // so either is the way back; what must follow is a route back, or the straight line.
    const back = await expectText("off route: the way back is given", /^(Rejoin the route, |Back to the route · )/, 40);
    if (back) {
      await expectText("off route: a route back, or the straight line", /^Back to the route · /, 40);
      check("off route: not left to guess, no raw Off route left over", !find(screenNow(), /^Off route · /));
      shot("09-offroute");
      layout("off route", screen);
    }
    await stopRide();

    await replay("wrongway");
    const wrong = await expectText("wrong way: it says U-turn", "U-turn, wrong way", 30);
    if (wrong) {
      shot("10-wrongway");
      layout("wrong way", screen);
    }
    await stopRide();

    await replay("skip");
    const skipButton = await expectText("skip: the next point can be skipped", /^Skip /, 30);
    // A button named by an accessibility label has its name in the description, not in a text.
    if (skipButton && /^Skip /.test(skipButton.text || skipButton.desc)) {
      await tapAt(center(skipButton));
      const question = await expectText("skip: it asks to confirm, naming the point", /^Skip .+\?$/, 10);
      if (question) {
        // The question cancels itself after 10 seconds: read the screen once, check it, and tap Skip from that reading.
        const nodes = screenNow();
        const problems = layoutProblems(nodes, screen);
        check("layout: skip question", problems.length === 0, problems.map((p) => `${p.what}: ${p.detail}`).join("; "));
        const confirm = nodes.find((n) => n.text === "Skip" || /^Skip .+ and go to /.test(n.desc));
        check("skip: Cancel and Skip are offered", !!find(nodes, "Cancel") && !!confirm);
        shot("11-skip-question");
        if (confirm) await tapAt(center(confirm));
        await expectText("skip: the new route is shown, with an Undo", /^Skipped .+ · heading for /, 40);
        shot("12-skipped");
        layout("after a skip", screen);
        check("skip: the HUD names the new target", !!(await waitFor(/^To .+ · /, 10)));
        await tap("Undo");
        check("skip: Undo takes it back", !!(await waitFor(/^Skip /, 10)) && !find(screenNow(), /^Skipped /));
      }
    }
    await stopRide();
  }

  if (want("control")) {
    await ensureIdleRoadbook(/loop/);
    // Pause, the end question and Back, on a scripted ride.
    await replay("ride");
    await expectText("pause: the buttons are folded", STRIP, 30);
    await revealButtons();
    const pauseButton = await expectText("pause: a GPS ride offers Pause", "Pause the ride", 10);
    if (pauseButton) {
      await tapAt(center(pauseButton));
      const paused = await expectText("pause: the screen says the ride is paused", "Ride paused", 10);
      if (paused) {
        shot("17-paused");
        layout("paused ride", screen);
        check("pause: the HUD says PAUSED", !!find(screenNow(), /PAUSED/));
        await revealButtons();
        await tap("Resume the ride");
        await sleep(1500);
        await revealButtons();
        check("pause: Resume carries on", !find(screenNow(), "Ride paused") && !!find(screenNow(), "Pause the ride"));
      }
    }
    await revealButtons();
    await tap("End the ride");
    const endQuestion = await expectText("end: it asks before ending a ride", "End the ride?", 10);
    if (endQuestion) {
      shot("18-end-question");
      layout("end question", screen);
      check(
        "end: Keep riding and End ride are offered",
        !!find(screenNow(), "Keep riding") && !!find(screenNow(), "End ride"),
      );
      await tap("Keep riding");
      check(
        "end: Keep riding leaves the ride as it was",
        !!(await waitFor(STRIP, 10)) && !find(screenNow(), "End the ride?"),
      );
    }
    await revealButtons();
    await tap("Back to the list");
    await expectText("back: it asks before leaving a ride", "Leave this ride?", 10);
    await tap("Keep riding");
    adb("shell", "input", "keyevent", "KEYCODE_BACK");
    await sleep(1200);
    await expectText("back: the phone's own Back button asks too", "Leave this ride?", 10);
    await tap("Keep riding");
    await stopRide();
    check("end: End ride returns to the roadbook", !!(await waitFor("Start", 10)));
  }

  if (want("background")) {
    // A ride on the phone's own GPS keeps running as a foreground service with a notification (ADR 0020).
    await ensureIdleRoadbook(/loop/);
    const service = () => adb("shell", "dumpsys", "activity", "services", PKG);
    const notified = () => /Riding /.test(adb("shell", "dumpsys", "notification", "--noredact"));
    await tap("Start");
    // Away from the roadbook the app asks where to join; the nearest way in is the start.
    if (await waitFor("Where do you join?", 15)) await tap(/^Go to the start/);
    let up = false;
    for (let i = 0; i < 15 && !up; i++) {
      await sleep(1000);
      up = notified();
    }
    shot("13-background-started");
    check("background: a ride on the real GPS shows its notification", up);
    const svc = service();
    check("background: it runs as a foreground service", /isForeground=true/.test(svc), svc.slice(0, 300));
    if (!up) console.log(adb("logcat", "-d", "-t", "300", "-s", "ReactNativeJS:*", "*:E").slice(-1500));
    adb("shell", "input", "keyevent", "KEYCODE_HOME");
    await sleep(4000);
    check(
      "background: the app in the background keeps its service and notification",
      notified() && /isForeground=true/.test(service()),
    );
    adb("shell", "monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1");
    await sleep(2000);
    await stopRide();
    let down = false;
    for (let i = 0; i < 10 && !down; i++) {
      await sleep(1000);
      down = !notified();
    }
    check("background: ending the ride removes the notification", down);
  }

  if (want("safety")) {
    // The Safety page and the test of the crash alert (spec crash-detection): nothing is sent, and a crash cannot be had on a desk.
    adb("shell", "am", "force-stop", PKG);
    adb("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", LINK, PKG);
    await waitFor("Where to?", 30);
    await tap("Open the menu");
    check("safety: the menu offers Safety", await tap("Safety"));
    check(
      "safety: the page opens with the switch",
      !!(await waitFor(/^Crash detection: (on|off)\. Tap to change$/, 10)),
    );
    shot("27-safety");
    layout("safety", screen);
    check(
      "safety: the explanation says that live sharing alerts automatically",
      !!find(screenNow(), /Share your ride live with someone you trust/),
    );
    check(
      "safety: the test of the alert starts",
      (await tap(/^Try the alert/)) && !!(await waitFor("Possible crash", 8)),
    );
    check("safety: it says it is a test", !!find(screenNow(), "Test: nothing will be sent"));
    check("safety: it counts down", !!find(screenNow(), /^Alert in \d+ s$/));
    shot("28-crash-alert-test");
    layout("crash alert", screen);
    check(
      "safety: the test ends and says nothing was sent",
      !!(await waitFor("The test is over. Nothing was sent.", 20)),
    );
    check("safety: I'm OK closes it", (await tap("I'm OK")) && !find(screenNow(), "Possible crash"));
    await tap("Back to the map");
  }

  if (want("destination")) {
    // Search a place, route to it from where the phone is, and open the ride (ADR 0022): real services, real GPS.
    adb("shell", "am", "force-stop", PKG);
    adb("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", LINK, PKG);
    await waitFor("Where to?", 30);
    check("destination: the map offers Where to?", await tap("Where to?"));
    await expectText("destination: the search screen opens", "Go to a place", 10);
    layout("destination search", screen);
    await tap("Destination");
    adb("shell", "input", "text", "Valenciennes");
    adb("shell", "input", "keyevent", "KEYCODE_ENTER");
    const place = await expectText("destination: the places are listed", /^Ride to /, 20);
    if (place) {
      shot("14-destination-results");
      layout("destination results", screen);
      await tap(/^Ride to /);
      check(
        "destination: a route opens a ride named To <place>",
        !!(await waitFor(/^To /, 40)) && !!find(screenNow(), "Start"),
      );
      shot("15-destination-ride");
      check(
        "destination: Back returns to the map",
        (await tap("Back to the map")) && !!(await waitFor("Where to?", 10)),
      );
      check("destination: the place is among the recent rides", !!(await waitFor(/^Ride to /, 10)));
      shot("16-home-recent");
    }
  }

  if (want("import")) {
    // Bring roadbooks in through the import link (ADR 0025): the files are served from this computer to the phone.
    // A real stretch of road (the start of a bundled loop), so the services can match it and complete it.
    const real = JSON.parse(
      readFileSync(
        new URL("../test/fixtures/roadbooks/r2-coutiches-hollain-ere-peaceful-loop.json", import.meta.url),
        "utf8",
      ),
    ) as {
      line: Array<[number, number]>;
    };
    const gpxText = `<?xml version="1.0"?><gpx version="1.1"><metadata><name>Smoke GPX loop</name></metadata><trk><trkseg>${real.line
      .slice(0, 1200)
      .map(([lat, lon]) => `<trkpt lat="${lat}" lon="${lon}"/>`)
      .join("")}</trkseg></trk></gpx>`;
    const server = createServer((req, res) => {
      if (req.url?.startsWith("/ride.gpx")) res.writeHead(200, { "Content-Type": "application/gpx+xml" }).end(gpxText);
      else res.writeHead(200, { "Content-Type": "text/plain" }).end("not a roadbook");
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const port = (server.address() as { port: number }).port;
    adb("reverse", `tcp:${port}`, `tcp:${port}`);
    const link = (path: string) =>
      `mobilemotoride://import?url=${encodeURIComponent(`http://localhost:${port}${path}`)}`;
    try {
      await ensureIdleRoadbook(/loop/);
      await tap("Back to the list");
      await waitFor("Pick a roadbook", 10);
      adb("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", link("/not-a-roadbook"), PKG);
      await expectText(
        "import: what is not a roadbook is refused with a reason",
        "This is not a roadbook file or a GPX file.",
        20,
      );
      shot("17-import-refused");
      layout("import refused", screen);
      await tap("Dismiss");
      adb("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", link("/ride.gpx"), PKG);
      // The services add speed limits, countries and cameras first: this takes a few seconds on a short stretch.
      const opened = await expectText(
        "import: a GPX from a link is completed and opens its ride",
        "Smoke GPX loop",
        120,
      );
      if (opened) {
        shot("18-import-ride");
        layout("imported ride", screen);
        check("import: nothing is said to be missing", !find(screenNow(), /^Imported without speed limits/));
        await replay("ride");
        await expectText("import: the ride knows the speed limit", /^(Speed limit|Over the speed limit of) \d+/, 40);
        await stopRide();
        await tap("Back to the list");
        await waitFor("Pick a roadbook", 10);
        check("import: the list marks it as imported", !!find(screenNow(), /^imported/i));
        shot("19-import-list");
        layout("list with an imported roadbook", screen);
        // It is still there after the app is closed and opened again.
        adb("shell", "am", "force-stop", PKG);
        adb("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", LINK, PKG);
        await waitFor("Where to?", 30);
        await tap("Roadbooks");
        check("import: it is kept after a restart", !!(await waitFor("Smoke GPX loop", 15)));
        check(
          "import: it can be deleted after a question",
          (await tap(/^Delete Smoke GPX loop\?$/)) && !!(await waitFor("Delete this roadbook?", 5)),
        );
        await tap(/^Delete Smoke GPX loop$/);
        await sleep(1500);
        check("import: and it is gone", !find(screenNow(), "Smoke GPX loop"));
      }
    } finally {
      adb("reverse", "--remove", `tcp:${port}`);
      server.close();
    }
  }

  if (want("rides")) {
    // A ride the app was closed during is saved at the next launch, listed, shared and deleted (ADR 0027).
    const now = Date.now();
    const points = Array.from({ length: 14 }, (_, i) => ({
      lat: 50.45,
      lon: 3.2 + i * 0.001,
      time: now - 3_600_000 + i * 6000,
      speedMps: 14,
    }));
    const checkpoint = JSON.stringify({
      v: 1,
      roadbookId: "smoke-recovered",
      roadbookName: "Smoke recovered loop",
      startedAt: now - 3_600_000,
      completed: false,
      points,
    });
    adb("shell", "am", "force-stop", PKG);
    adb("shell", `run-as ${PKG} sh -c 'mkdir -p files/rides && rm -f files/rides/*smoke-recovered*'`);
    execFileSync("adb", ["shell", `run-as ${PKG} sh -c 'mkdir -p files/rides && cat > files/rides/in-progress.json'`], {
      input: checkpoint,
    });
    adb("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", LINK, PKG);
    await expectText(
      "rides: a ride the app was closed during is recovered",
      /^A ride that was cut short was recovered/,
      60,
    );
    shot("20-ride-recovered");
    await waitFor("Where to?", 30);
    await tap("Open the menu");
    await tap("My rides");
    await expectText("rides: it is listed with its state", "Recovered", 15);
    check("rides: with the roadbook's name", !!find(screenNow(), /Smoke recovered loop/));
    shot("21-my-rides");
    layout("my rides", screen);
    const gpx = adb("shell", `run-as ${PKG} sh -c 'cat files/rides/*smoke-recovered-loop.gpx'`);
    check(
      "rides: the GPX is on the phone, with the track and the roadbook it followed",
      /<gpx version="1\.1"/.test(gpx) &&
        /state="recovered"/.test(gpx) &&
        (gpx.match(/<trkpt /g) ?? []).length === 14 &&
        /roadbook="smoke-recovered"/.test(gpx),
    );
    check("rides: Share opens the phone's share sheet", await tap(/^Share the ride of Smoke recovered loop$/));
    await sleep(2500);
    const focus = adb("shell", "dumpsys", "window");
    check(
      "rides: it is the system's share sheet",
      /(Chooser|Resolver|ShareSheet|sharesheet)/i.test(focus.split("mCurrentFocus")[1]?.split("\n")[0] ?? ""),
    );
    shot("22-share-sheet");
    adb("shell", "input", "keyevent", "KEYCODE_BACK");
    await sleep(1500);
    // The review reads the GPX back and replays it (spec ride-review): 13 steps of 0.001 degree, 6 s apart, at 14 m/s.
    check(
      "rides: Review opens the ride",
      (await tap(/^Review Smoke recovered loop$/)) && !!(await waitFor("Back to My rides", 15)),
    );
    shot("22b-review");
    layout("ride review", screen);
    check(
      "rides: the review shows the figures of the ride",
      !!find(screenNow(), /^Distance: 9\d\d m$/) && !!find(screenNow(), /^Top speed: 50 km\/h$/),
      screenNow()
        .map((n) => n.desc)
        .filter((d) => /^Distance|^Top speed/.test(d))
        .join(" | "),
    );
    check("rides: the replay readout is at the start", !!find(screenNow(), /· 50 km\/h$/));
    check("rides: Play starts the replay", await tap("Play"));
    check("rides: it plays to the end and offers Play again", !!(await waitFor("Play", 20)));
    await tap("Back to My rides");
    check("rides: Back returns to My rides", !!(await waitFor(/^Share the ride of Smoke recovered loop$/, 10)));
    check(
      "rides: it can be deleted after a question",
      (await tap(/^Delete Smoke recovered loop ride\?$/)) && !!(await waitFor("Delete this ride?", 5)),
    );
    await tap(/^Delete the ride of Smoke recovered loop$/);
    await sleep(1500);
    check("rides: and it is gone", !find(screenNow(), /Smoke recovered loop/));
    await tap("Back to the map");
  }

  if (want("share")) {
    // Share a ride live through a server (ADR 0029): agentRide's server runs on this computer, the phone reaches it by
    // adb, and what it receives is decrypted here the way a follower's browser does.
    const agentRide = resolve("../agentRide");
    if (!existsSync(join(agentRide, "src/serve.ts"))) {
      check("share: agentRide is next to this repository (../agentRide)", false);
    } else {
      const data = mkdtempSync(join(tmpdir(), "smoke-share-"));
      const port = 18000 + Math.floor(Math.random() * 1000);
      const env = { ...process.env, RIDE_DATA_DIR: data, RIDE_SERVER_PORT: String(port) };
      const added = execFileSync("node", ["src/admin.ts", "add", "smoke@example.org"], {
        cwd: agentRide,
        env,
        encoding: "utf8",
      });
      const token = /mrt_[A-Za-z0-9_-]+/.exec(added)![0];
      const server: ChildProcess = spawn("node", ["src/serve.ts"], { cwd: agentRide, env, stdio: "ignore" });
      try {
        for (let i = 0; i < 30; i++) {
          if (
            await fetch(`http://127.0.0.1:${port}/health`)
              .then((r) => r.ok)
              .catch(() => false)
          )
            break;
          await sleep(500);
        }
        adb("reverse", `tcp:${port}`, `tcp:${port}`);
        const health = () =>
          fetch(`http://127.0.0.1:${port}/health`).then((r) => r.json() as Promise<{ shares: number }>);
        // The server is set by a link, after the rider says yes.
        await ensureIdleRoadbook(/loop/);
        await tap("Back to the list");
        await tap("Back to the map");
        adb(
          "shell",
          "am",
          "start",
          "-a",
          "android.intent.action.VIEW",
          "-d",
          `'mobilemotoride://server?url=${encodeURIComponent(`http://localhost:${port}`)}&token=${token}'`,
          PKG,
        );
        check(
          "share: the app asks before it uses a server, naming it",
          !!(await waitFor("Use this server?", 20)) && !!find(screenNow(), new RegExp(`localhost:${port}`)),
        );
        shot("23-server-ask");
        check("share: and sets it after a yes", (await tap(/^use it$/i)) && !!(await waitFor(/^Server set: /, 10)));
        await tap("Open the menu");
        await tap("Server");
        check(
          "share: the Server screen shows it, the token masked",
          !!(await waitFor(`http://localhost:${port}`, 10)) && !find(screenNow(), token),
        );
        layout("server screen", screen);
        await tap("Test the server");
        await expectText("share: the test works against the server", "It works: the server accepted the token.", 15);
        shot("24-server-screen");

        // Joining with an invitation (agentRide's ADR 0029): a link with a one-time code and a PIN, as its QR code carries.
        const invited = execFileSync(
          "node",
          ["src/admin.ts", "invite", "smoke2@example.org", "--pin", `--url=http://localhost:${port}`],
          { cwd: agentRide, env, encoding: "utf8" },
        );
        const inviteLink = /mobilemotoride:\/\/server\?\S+/.exec(invited)![0];
        const invitePin = /PIN: (\d{6})/.exec(invited)![1]!;
        adb("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", `'${inviteLink}'`, PKG);
        check(
          "share: an invitation shows the server and asks before it joins",
          !!(await waitFor("Join the server", 15)) && !!find(screenNow(), `http://localhost:${port}`),
        );
        shot("24b-invitation");
        const typeInto = async (digits: string) => {
          await tap("Invitation PIN");
          adb("shell", "input", "keyevent", "KEYCODE_MOVE_END");
          for (let i = 0; i < 8; i++) adb("shell", "input", "keyevent", "KEYCODE_DEL");
          adb("shell", "input", "text", digits);
          if (/mInputShown=true/.test(adb("shell", "dumpsys", "input_method"))) {
            adb("shell", "input", "keyevent", "KEYCODE_BACK");
            await sleep(600);
          }
        };
        await typeInto(invitePin === "000000" ? "111111" : "000000");
        await tap("Join the server");
        const wrong = await waitFor(/tries? left/, 15);
        shot("24d-wrong-pin");
        check("share: a wrong PIN says how many tries are left", !!wrong);
        await typeInto(invitePin);
        await tap("Join the server");
        check("share: the right PIN joins", !!(await waitFor(/^Joined\./, 15)));
        await tap("Test the server");
        await expectText(
          "share: the token the server made for the phone works",
          "It works: the server accepted the token.",
          15,
        );
        shot("24c-joined");
        await tap("Back to the map");

        // A ride on the phone's own GPS, shared.
        await tap("Roadbooks");
        await waitFor("Pick a roadbook", 10);
        check("share: a roadbook opens", await tap(/loop/));
        await waitFor("Demo", 15);
        check("share: the ride offers to be shared", !!(await waitFor("Share this ride live", 10)));
        await tap("Share this ride live");
        await tap("Start");
        // The share sheet opens with the link in it (it comes before the question of where to join).
        let link: string | null = null;
        for (let i = 0; i < 20 && !link; i++) {
          await sleep(1000);
          const nodes = screenNow();
          const text = nodes.map((n) => `${n.text} ${n.desc}`).join(" ");
          link = /https?:\/\/localhost:\d+\/follow\/[A-Za-z0-9_-]{22}#[A-Za-z0-9_-]{43}/.exec(text)?.[0] ?? null;
        }
        shot("25-share-sheet");
        check("share: the phone's share sheet opens with the follow link", !!link);
        adb("shell", "input", "keyevent", "KEYCODE_BACK");
        await sleep(1500);
        // The question of where to join comes when the phone's first position does: whenever it does, answer it.
        if (await waitFor("Where do you join?", 30)) await tap(/^Go to the start/);
        check("share: the server holds one shared ride", (await health()).shares === 1);
        await revealButtons(); // the sharing line folds away with the buttons
        check("share: the ride says it is shared", !!(await waitFor("Sharing live", 15)));
        shot("26-sharing-live");
        layout("sharing live", screen);
        if (link) {
          const [, channel, key] = /\/follow\/([A-Za-z0-9_-]{22})#([A-Za-z0-9_-]{43})$/.exec(link)!;
          const k = await webcrypto.subtle.importKey("raw", Buffer.from(key!, "base64url"), "AES-GCM", false, [
            "decrypt",
          ]);
          // The phone sends the first position at once; wait for it.
          let first: { v: number; lat: number; lon: number; state: string; name: string } | null = null;
          for (let i = 0; i < 20 && !first; i++) {
            const body = (await (await fetch(`http://127.0.0.1:${port}/share/${channel}`)).json()) as {
              items: Array<{ iv: string; ct: string }>;
            };
            if (body.items[0]) {
              const plain = await webcrypto.subtle.decrypt(
                {
                  name: "AES-GCM",
                  iv: Buffer.from(body.items[0].iv, "base64url"),
                  additionalData: new TextEncoder().encode(channel),
                },
                k,
                Buffer.from(body.items[0].ct, "base64url"),
              );
              first = JSON.parse(new TextDecoder().decode(plain));
            } else await sleep(1000);
          }
          check(
            "share: a position arrives encrypted and a follower's key reads it",
            !!first && first.v === 1 && Math.abs(first.lat) <= 90,
          );
          check(
            "share: with the roadbook's name and a place near the phone",
            !!first && /loop/i.test(first.name) && first.lat > 49 && first.lat < 52,
          );
          // Stopped, then shared again from the running ride: a new link, a new channel.
          await revealButtons();
          await tap("Stop sharing");
          await sleep(1500);
          check("share: stopping removes the ride from the server", (await health()).shares === 0);
          await revealButtons();
          check("share: a running ride offers to be shared again", !!(await waitFor("Not shared", 10)));
          let again: string | null = null;
          for (let i = 0; i < 20 && !again; i++) {
            // The line folds with the buttons after eight seconds: bring it, and ask again, until the sheet is there.
            if (i % 6 === 0 && find(screenNow(), "Share this ride live") === undefined) await revealButtons();
            if (i % 6 === 0) await tap("Share this ride live");
            await sleep(1000);
            const text = screenNow()
              .map((n) => `${n.text} ${n.desc}`)
              .join(" ");
            again = /https?:\/\/localhost:\d+\/follow\/[A-Za-z0-9_-]{22}#[A-Za-z0-9_-]{43}/.exec(text)?.[0] ?? null;
          }
          shot("27-share-again");
          check("share: sharing again opens the share sheet with a new link", !!again && again !== link);
          adb("shell", "input", "keyevent", "KEYCODE_BACK");
          await sleep(1500);
          check("share: the server holds the ride again", (await health()).shares === 1);
          const channelNow = again ? /\/follow\/([A-Za-z0-9_-]{22})#/.exec(again)![1]! : channel!;
          // Ending the ride ends the shared ride, and the follower sees it.
          await revealButtons();
          await stopRide();
          await sleep(2500);
          const after = (await (await fetch(`http://127.0.0.1:${port}/share/${channelNow}`)).json()) as {
            state: string;
          };
          shot("28-share-ended");
          check(
            "share: ending the ride ends the shared ride",
            after.state === "ended",
            JSON.stringify(after).slice(0, 80),
          );
        }
        await tap("Back to the map").catch(() => {});
        // The test's server is gone with this run: do not leave the phone pointing at it (the rider's own setting is
        // replaced by the test; `npm run dev:server` sets a local one again).
        await tap("Open the menu");
        await tap("Server");
        if (await tap("Remove the server")) {
          check("share: the test's server is removed from the phone", !!(await waitFor("Removed.", 10)));
        }
        await tap("Back to the map").catch(() => {});
      } finally {
        server.kill();
        try {
          adb("reverse", "--remove", `tcp:${port}`);
        } catch {
          // Already gone.
        }
        rmSync(data, { recursive: true, force: true });
      }
    }
  }

  if (want("key")) {
    await ensureIdleRoadbook(/loop/);
    // The map key: every mark in plain words, with room to itself.
    if (await tap("Show the map key")) {
      const key = await expectText("key: it explains the marks of the map", "Map key", 10);
      if (key) {
        shot("17b-map-key");
        layout("map key", screen);
        check(
          "key: hairpin, sharp corner, route point and the rider are explained",
          !!find(screenNow(), /^Hairpin\./) &&
            !!find(screenNow(), /^Sharp corner\./) &&
            !!find(screenNow(), /^Route point\./) &&
            !!find(screenNow(), /^You\./),
        );
        check("key: the map controls step aside", !find(screenNow(), "Zoom in"));
        const sheetNodes = screenNow();
        const close = find(sheetNodes, "Close");
        check(
          "key: its content scrolls",
          sheetNodes.some((n) => n.scrollable),
        );
        // Nothing may be drawn over Close: no other button of the screen overlaps it.
        check(
          "key: the Close button is on screen and nothing covers it",
          !!close &&
            close.bounds.bottom <= screen.height &&
            close.bounds.top > 0 &&
            !sheetNodes.some(
              (n) =>
                n !== close &&
                n.clickable &&
                (n.text || n.desc) &&
                overlaps(n.bounds, close.bounds) &&
                !contains(n.bounds, close.bounds),
            ),
        );
        await tap("Close");
        check("key: Close brings the map back", !!(await waitFor("Zoom in", 10)));
      }
    }
  }

  if (want("join")) {
    await ensureIdleRoadbook(/loop/);
    // Joining the roadbook where the rider is: the card, the list, and a ride to the point chosen.
    await replay("join");
    const card = await expectText("join: away from the roadbook the app asks where to join", "Where do you join?", 40);
    if (card) {
      shot("19-join-card");
      layout("join card", screen);
      const nearest = screenNow().find((n) => /^Go to .+, .+ away, skips /.test(n.desc));
      check("join: the nearest next point is proposed, with what it skips", !!nearest, nearest?.desc);
      check(
        "join: the start, another point and Cancel are offered",
        !!find(screenNow(), /^Go to the start,/) &&
          !!find(screenNow(), "Choose another point…") &&
          !!find(screenNow(), "Cancel"),
      );
      check("join: the map controls step aside", !find(screenNow(), "Zoom in"));
      if (await tap("Choose another point…")) {
        await expectText("join: every route point can be chosen", "The points before it are dropped.", 10);
        layout("join list", screen);
        const rows = screenNow().filter((n) => /^Start from .+, .+ from the start$/.test(n.desc));
        check("join: the list offers several route points", rows.length >= 3, `${rows.length} points`);
        await tap("Cancel"); // the list: back to the card
      }
      const again = screenNow().find((n) => /^Go to .+, .+ away, skips /.test(n.desc));
      if (again) await tapAt(center(again));
      const toPoint = await expectText("join: the ride goes to the chosen point", /^To .+ · /, 40);
      if (toPoint) {
        check("join: it is not the start that is named", !/^To the start/.test(toPoint.text));
        shot("19b-joined");
        layout("joined", screen);
      }
    }
    await stopRide();

    // Going to a chosen point without being asked (a scripted ride).
    await replay("startfrom");
    const chosen = await expectText("start from: the ride goes to the point chosen", /^To .+ · /, 40);
    if (chosen) check("start from: it is not the start that is named", !/^To the start/.test(chosen.text));
    await stopRide();
  }

  if (want("zone")) {
    // A roadbook with danger zones and limits.
    if (await openRoadbook(/Eau d/)) {
      await replay("zone");
      const zone = await expectText("danger zone: the warning shows, as a zone", "DANGER ZONE", 30);
      if (zone) {
        shot("13-danger-zone");
        layout("danger zone", screen);
        check("danger zone: the screen never says camera or radar", !find(screenNow(), /camera|radar/i));
        check(
          "danger zone: it says how much of the zone is left, not where the camera is",
          !!find(screenNow(), / to go$/),
        );
      }
      await stopRide();

      // Junction guidance, on junctions made up for the script (no bundled roadbook has any yet). The diagram itself is
      // hidden from the accessibility tree on purpose, so the words are read here and the picture is in the screenshot.
      await replay("roundabout");
      const exit = await expectText("roundabout: the exit is named", "2nd exit", 30);
      if (exit) {
        check("roundabout: it says Roundabout and the distance", !!find(screenNow(), /^Roundabout · in \d+ m$/));
        shot("15-roundabout");
        layout("roundabout", screen);
      }
      await stopRide();
      await replay("lanes");
      const keep = await expectText("lanes: the lanes are named", "Keep left", 30);
      if (keep) {
        check("lanes: the lanes and the distance", !!find(screenNow(), /^Lanes 1 and 2 · in \d+ m$/));
        shot("16-lanes");
        layout("lanes", screen);
      }
      await stopRide();
      await replay("ride");
      await expectText("a scripted ride shows the speed limit", /^(Speed limit|Over the speed limit)/, 20);
      shot("14-ride");
      layout("scripted ride", screen);

      // Away from the app and back: the ride is still there.
      adb("shell", "input", "keyevent", "KEYCODE_HOME");
      await sleep(2500);
      adb("shell", "monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1");
      await sleep(3000);
      check("going to the home screen and back keeps the ride", !!(await waitFor(STRIP, 15)));
      await stopRide();
    }
  }

  if (want("offline")) {
    // No network: the basemap says so, and the way to the start falls back to a straight line.
    if (await openRoadbook(/loop/)) {
      await setNetwork(false);
      await replay("approach");
      const straight = await expectText("no network: the approach says there is no route", "No route to the start", 40);
      if (straight) {
        shot("15-no-network");
        layout("no network, approach", screen);
        check("no network: the straight line is followed", !!find(screenNow(), /^Straight to the start /));
      }
      await stopRide();
      for (let i = 0; i < 3 && !find(screenNow(), "Map offline"); i++) {
        await tap(/^Map: /);
        await sleep(4000);
      }
      check("no network: the basemap falls back and says so", !!find(screenNow(), "Map offline"));
      check("no network: the roadbook is still on screen", !!find(screenNow(), "Start"));
      shot("16-map-offline");
      layout("no network, map offline", screen);

      // A map saved for the roadbook stays without the network (ADR 0023): save it with the network, then lose it.
      await setNetwork(true);
      await ensureIdleRoadbook(/loop/);
      for (let i = 0; i < 3 && !find(screenNow(), /^Map: Light/); i++) {
        await tap(/^Map: /);
        await sleep(2500);
      }
      check("offline map: it can be saved before the ride", await tap("Save the map for offline"));
      const saved = await expectText("offline map: the map is saved", "Map saved for offline", 240);
      if (saved) {
        shot("17-map-saved");
        await setNetwork(false);
        adb("shell", "am", "force-stop", PKG);
        adb("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", LINK, PKG);
        await waitFor("Where to?", 30);
        await openRoadbook(/loop/);
        await sleep(4000);
        check("offline map: with no network the basemap stays", !find(screenNow(), "Map offline"));
        shot("18-map-saved-offline");
        await setNetwork(true);
        check("offline map: it can be removed", await tap("Remove the offline map"));
        await expectText("offline map: the offer comes back", "Save the map for offline", 10);
      }
    }
  }
}

/** How many roadbook cards the list shows. */
function findAllCards(): number {
  return findAllCardNodes().length;
}

function findAllCardNodes(): UiNode[] {
  return screenNow().filter((n) => /corners to watch/.test(n.text));
}

async function main() {
  try {
    await run();
  } catch (e) {
    check("the smoke test ran to the end", false, e instanceof Error ? e.message : String(e));
  } finally {
    stopSeedServer();
    // The run turns the network off for a step: never leave the phone like that.
    try {
      await setNetwork(true);
    } catch {
      console.log("could not turn the network back on: do it by hand");
    }
  }
  try {
    const log = adb("logcat", "-d");
    const crash = appCrashes(log, PKG);
    check("no crash in the log", crash.length === 0, crash.slice(0, 3).join(" | "));
  } catch {
    // no phone to ask
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed. Screenshots: ${OUT}`);
  if (dumpFailures > 0)
    console.log(`(the phone refused the screen ${dumpFailures} time(s): uiautomator needs a second without change)`);
  process.exit(failed.length === 0 ? 0 : 1);
}

void main();

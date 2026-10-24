import assert from "node:assert/strict";
import { test } from "node:test";
import {
  above,
  appCrashes,
  center,
  contains,
  find,
  findAll,
  layoutProblems,
  otherSmokeRuns,
  overlaps,
  parseDump,
} from "../scripts/device/ui.ts";

const node = (text: string, bounds: string, extra = "") =>
  `<node index="0" text="${text}" content-desc="" clickable="true" ${extra} bounds="${bounds}" />`;
const dump = (...nodes: string[]) => `<?xml version="1.0"?><hierarchy>${nodes.join("")}</hierarchy>`;
const screen = { width: 1080, height: 2400, scale: 2.75 };

test("parseDump reads text, description, clickability and bounds, and unescapes", () => {
  const nodes = parseDump(
    dump(
      node("Eau d&apos;Heure &amp; co", "[10,20][300,400]"),
      `<node text="" content-desc="Zoom in" clickable="true" bounds="[900,1500][1032,1632]" />`,
    ),
  );
  assert.equal(nodes.length, 2);
  assert.equal(nodes[0]!.text, "Eau d'Heure & co");
  assert.deepEqual(nodes[0]!.bounds, { left: 10, top: 20, right: 300, bottom: 400 });
  assert.equal(nodes[1]!.desc, "Zoom in");
  assert.deepEqual(center(nodes[1]!), { x: 966, y: 1566 });
});

test("parseDump reads whether a switch is on", () => {
  const nodes = parseDump(
    dump(
      `<node text="" content-desc="Compass" checked="true" bounds="[0,0][100,100]" />`,
      `<node text="" content-desc="Slope" checked="false" bounds="[0,0][100,100]" />`,
      `<node text="" content-desc="Plain" bounds="[0,0][100,100]" />`,
    ),
  );
  assert.deepEqual(
    nodes.map((n) => n.checked),
    [true, false, false],
  );
});

test("find and findAll match by text or description, exact or by pattern", () => {
  const nodes = parseDump(
    dump(
      node("Start", "[0,0][300,200]"),
      node("Stop", "[300,0][600,200]"),
      `<node text="" content-desc="Zoom in" clickable="true" bounds="[0,300][200,500]" />`,
    ),
  );
  assert.ok(find(nodes, "Start"));
  assert.ok(find(nodes, "Zoom in"));
  assert.equal(find(nodes, "Sta"), undefined);
  assert.equal(findAll(nodes, /^St/).length, 2);
});

test("a clean screen has no layout problem", () => {
  const nodes = parseDump(dump(node("Back", "[40,2200][400,2360]"), node("Start", "[420,2200][1040,2360]")));
  assert.deepEqual(layoutProblems(nodes, screen), []);
});

test("off-screen elements, tiny targets and overlapping buttons are reported", () => {
  const nodes = parseDump(
    dump(
      node("Out", "[1000,100][1200,300]"),
      node("Tiny", "[10,10][60,60]"),
      node("A", "[100,1000][500,1200]"),
      node("B", "[400,1100][800,1300]"),
    ),
  );
  const whats = layoutProblems(nodes, screen).map((p) => p.what);
  assert.ok(whats.includes("off screen"));
  assert.ok(whats.includes("target under 44 dp"));
  assert.ok(whats.includes("buttons overlap"));
});

test("a card around its own button is not an overlap", () => {
  const nodes = parseDump(dump(node("Card", "[0,0][1000,600]"), node("Inside", "[100,100][500,500]")));
  assert.deepEqual(
    layoutProblems(nodes, screen).filter((p) => p.what === "buttons overlap"),
    [],
  );
});

test("overlaps and above", () => {
  assert.equal(
    overlaps({ left: 0, top: 0, right: 10, bottom: 10 }, { left: 10, top: 0, right: 20, bottom: 10 }),
    false,
  );
  assert.equal(overlaps({ left: 0, top: 0, right: 10, bottom: 10 }, { left: 9, top: 9, right: 20, bottom: 20 }), true);
  const [bar, banner] = parseDump(dump(node("bar", "[0,100][1000,300]"), node("banner", "[0,310][1000,500]")));
  assert.equal(above(bar!, banner!), true);
  assert.equal(above(banner!, bar!), false);
});

const PKG = "com.adequatefunction.motoride";

test("a crash of the app is found, a crash of another process is not", () => {
  const stale = [
    "10-18 18:18:20.825  1026  1026 E AndroidRuntime: FATAL EXCEPTION: main",
    "10-18 18:18:20.825  1026  1026 E AndroidRuntime: PID: 1026",
    "10-18 18:18:20.825  1026  1026 E AndroidRuntime: java.lang.IllegalStateException: UiAutomationService already registered!",
  ].join("\n");
  assert.deepEqual(appCrashes(stale, PKG), []);
  const ours = [
    "10-18 18:20:00.000  2000  2000 E AndroidRuntime: FATAL EXCEPTION: main",
    `10-18 18:20:00.000  2000  2000 E AndroidRuntime: Process: ${PKG}, PID: 2000`,
    "10-18 18:20:00.000  2000  2000 E AndroidRuntime: java.lang.NullPointerException",
  ].join("\n");
  assert.equal(appCrashes(ours, PKG).length, 1);
});

test("a JavaScript error, an ANR and a native signal of the app count; the same of others do not", () => {
  const log = [
    "10-18 18:20:00.000  2000  2100 E ReactNativeJS: Error: boom",
    `10-18 18:20:01.000  1000  1100 E ActivityManager: ANR in ${PKG}`,
    "10-18 18:20:01.000  1000  1100 E ActivityManager: Application Not Responding in com.other.app",
    `10-18 18:20:02.000  3000  3000 F libc    : Fatal signal 11 (SIGSEGV), code 1 in tid 3000 (${PKG}), pid 3000`,
    "10-18 18:20:02.000  4000  4000 F libc    : Fatal signal 6 (SIGABRT) in tid 4000 (com.other.app), pid 4000",
  ].join("\n");
  assert.equal(appCrashes(log, PKG).length, 2, "the ANR line has no package match in its Not Responding form");
  assert.deepEqual(appCrashes("", PKG), []);
});

test("another smoke run is a node process running the script; wrappers that only mention it, and this process, are not", () => {
  const listing = [
    "100 node scripts/device-smoke.ts",
    "200 /nix/store/abc-nodejs-24/bin/node scripts/device-smoke.ts",
    "300 /run/current-system/sw/bin/zsh -c nix develop --command node scripts/device-smoke.ts > report.txt",
    "400 nix develop --command node scripts/device-smoke.ts",
    "500 node scripts/other.ts device-smoke",
    "600 node scripts/device-smoke.ts",
  ].join("\n");
  assert.deepEqual(otherSmokeRuns(listing, 600), [100, 200]);
  assert.deepEqual(otherSmokeRuns("", 1), []);
  assert.deepEqual(otherSmokeRuns("garbage", 1), []);
});

test("a row scrolled out of view, with no area, is not judged", () => {
  const nodes = parseDump(
    dump(node("Row", "[0,500][700,500]"), node("Row 2", "[0,500][700,452]"), node("Visible", "[0,600][700,800]")),
  );
  assert.deepEqual(layoutProblems(nodes, screen), []);
});

test("a row cut by the edge of its scroll container is not a tiny target, but a tiny button elsewhere still is", () => {
  const scroller = `<node text="" content-desc="" clickable="false" scrollable="true" bounds="[0,500][1000,1000]" />`;
  const cut = `<node text="Row 7" content-desc="" clickable="true" bounds="[10,960][990,1000]" />`; // 40 px tall, at the bottom edge
  const whole = `<node text="Row 1" content-desc="" clickable="true" bounds="[10,500][990,640]" />`;
  assert.deepEqual(layoutProblems(parseDump(dump(scroller, cut, whole)), screen), []);
  const tiny = `<node text="Tiny" content-desc="" clickable="true" bounds="[10,700][60,740]" />`;
  assert.ok(layoutProblems(parseDump(dump(scroller, tiny)), screen).some((p) => p.what === "target under 44 dp"));
});

test("contains: a map under a button holds it, two neighbours do not hold each other", () => {
  const map = { left: 0, top: 0, right: 1080, bottom: 2400 };
  const button = { left: 67, top: 1802, right: 1015, bottom: 1939 };
  assert.equal(contains(map, button), true);
  assert.equal(contains(button, map), false);
  assert.equal(contains(button, { ...button, bottom: 2000 }), false);
});

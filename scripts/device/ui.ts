// Reading an Android uiautomator dump and checking the layout it describes. Pure: tested in test/device-ui.test.ts.

export interface UiNode {
  text: string;
  desc: string;
  clickable: boolean;
  /** A switch or a check that is on. */
  checked: boolean;
  /** A scroll container: its rows may be cut by its edges, which is not a layout problem. */
  scrollable: boolean;
  bounds: { left: number; top: number; right: number; bottom: number };
}

const attr = (tag: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1] ?? "";
const unescape = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

export function parseDump(xml: string): UiNode[] {
  const nodes: UiNode[] = [];
  for (const m of xml.matchAll(/<node\b[^>]*>/g)) {
    const tag = m[0];
    const b = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/.exec(attr(tag, "bounds"));
    if (!b) continue;
    nodes.push({
      text: unescape(attr(tag, "text")),
      desc: unescape(attr(tag, "content-desc")),
      clickable: attr(tag, "clickable") === "true",
      checked: attr(tag, "checked") === "true",
      scrollable: attr(tag, "scrollable") === "true",
      bounds: { left: +b[1]!, top: +b[2]!, right: +b[3]!, bottom: +b[4]! },
    });
  }
  return nodes;
}

export const matches = (n: UiNode, what: string | RegExp) =>
  typeof what === "string" ? n.text === what || n.desc === what : what.test(n.text) || what.test(n.desc);

export const find = (nodes: UiNode[], what: string | RegExp) => nodes.find((n) => matches(n, what));
export const findAll = (nodes: UiNode[], what: string | RegExp) => nodes.filter((n) => matches(n, what));

export const center = (n: UiNode) => ({
  x: Math.round((n.bounds.left + n.bounds.right) / 2),
  y: Math.round((n.bounds.top + n.bounds.bottom) / 2),
});

export interface Screen {
  width: number;
  height: number;
  /** Pixels per dp (density / 160). */
  scale: number;
}

type B = UiNode["bounds"];
/** `a` holds `b` entirely: the map under a button, a card around its own button. */
export const contains = (a: UiNode["bounds"], b: UiNode["bounds"]) =>
  a.left <= b.left && a.top <= b.top && a.right >= b.right && a.bottom >= b.bottom;

export const overlaps = (a: B, b: B) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

export interface Problem {
  what: string;
  detail: string;
}

const label = (n: UiNode) => n.text || n.desc || "(unnamed)";

/** What is wrong with a screen's layout: off screen, tiny targets, buttons on top of each other. */
export function layoutProblems(nodes: UiNode[], screen: Screen): Problem[] {
  const problems: Problem[] = [];
  // A node with no area (a list row scrolled out of view) is not on screen, so it is judged by nothing.
  const buttons = nodes.filter(
    (n) => n.clickable && (n.text || n.desc) && n.bounds.right > n.bounds.left && n.bounds.bottom > n.bounds.top,
  );
  for (const n of nodes.filter((n) => n.text || n.desc || n.clickable)) {
    const b = n.bounds;
    if (b.right <= b.left || b.bottom <= b.top) continue;
    if (b.left < 0 || b.top < 0 || b.right > screen.width || b.bottom > screen.height) {
      problems.push({ what: "off screen", detail: `${label(n)} at ${JSON.stringify(b)}` });
    }
  }
  const scrollers = nodes.filter((n) => n.scrollable);
  // A row cut by the edge of the scroll container it sits in shows only part of itself: that is how a list scrolls.
  const cutByScroller = (n: UiNode) =>
    scrollers.some(
      (c) =>
        n.bounds.left >= c.bounds.left &&
        n.bounds.right <= c.bounds.right &&
        (n.bounds.bottom === c.bounds.bottom || n.bounds.top === c.bounds.top),
    );
  for (const n of buttons) {
    const w = (n.bounds.right - n.bounds.left) / screen.scale;
    const h = (n.bounds.bottom - n.bounds.top) / screen.scale;
    if (cutByScroller(n)) continue;
    if (w < 44 || h < 44)
      problems.push({ what: "target under 44 dp", detail: `${label(n)} is ${Math.round(w)}x${Math.round(h)} dp` });
  }
  for (let i = 0; i < buttons.length; i++) {
    for (let j = i + 1; j < buttons.length; j++) {
      const a = buttons[i]!;
      const b = buttons[j]!;
      // A card around a button, or a button around its own label, is not an overlap.
      const contains = (x: B, y: B) => x.left <= y.left && x.top <= y.top && x.right >= y.right && x.bottom >= y.bottom;
      if (overlaps(a.bounds, b.bounds) && !contains(a.bounds, b.bounds) && !contains(b.bounds, a.bounds)) {
        problems.push({ what: "buttons overlap", detail: `${label(a)} and ${label(b)}` });
      }
    }
  }
  return problems;
}

/** `upper` must sit entirely above `lower` (the corner banner under the instruction bar). */
export function above(upper: UiNode, lower: UiNode): boolean {
  return upper.bounds.bottom <= lower.bounds.top + 1;
}

/**
 * Crashes of the app in a logcat dump. Other processes crash too (a stale `uiautomator` shell process logs
 * "FATAL EXCEPTION" with no package), and those say nothing about the app.
 */
export function appCrashes(log: string, pkg: string): string[] {
  const lines = log.split("\n");
  const found: string[] = [];
  lines.forEach((line, i) => {
    if (/FATAL EXCEPTION/.test(line) && lines.slice(i + 1, i + 4).some((l) => l.includes(`Process: ${pkg}`)))
      found.push(line.trim());
    else if (/ReactNativeJS: Error/.test(line)) found.push(line.trim());
    else if (/Application Not Responding/.test(line) && line.includes(pkg)) found.push(line.trim());
    else if (/Fatal signal \d+/.test(line) && line.includes(pkg)) found.push(line.trim());
  });
  return found;
}

/**
 * Other runs of the smoke script in `pgrep -af` output: processes that are node running device-smoke.ts. A shell or a
 * `nix develop` wrapper whose command line only mentions the script is not a run, and neither is this process.
 */
export function otherSmokeRuns(pgrepOutput: string, ownPid: number): number[] {
  return pgrepOutput
    .split("\n")
    .map((l) => /^(\d+) (.*)$/.exec(l.trim()))
    .flatMap((m) =>
      m && Number(m[1]) !== ownPid && /^(\S*\/)?node\s+\S*device-smoke\.ts(\s|$)/.test(m[2]!) ? [Number(m[1])] : [],
    );
}

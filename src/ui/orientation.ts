// The phone turns on the ride screen only (ADR 0045). The native module may be missing from an older build: then the
// app stays as its manifest says and nothing here throws.
type Orientation = typeof import("expo-screen-orientation");

/** Ask for an orientation; a build without the module, or a phone that refuses, changes nothing. */
function lock(which: "PORTRAIT_UP" | "DEFAULT"): void {
  try {
    // Loaded here, not at the top: a build made before the module existed would fail to start otherwise.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const o = require("expo-screen-orientation") as Orientation;
    void o.lockAsync(o.OrientationLock[which]).catch(() => {});
  } catch {
    // No native module: the orientation stays as it was.
  }
}

/** Portrait again: every screen but the ride. */
export function lockPortrait(): void {
  lock("PORTRAIT_UP");
}

/** Let the phone turn, for the ride screen. */
export function unlockOrientation(): void {
  lock("DEFAULT");
}

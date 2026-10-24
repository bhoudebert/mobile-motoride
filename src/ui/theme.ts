import type { Scheme } from "../core/theme.ts";

/**
 * The "roadbook" look of agentMotoride: paper, ink, moss, signal yellow and rust (site/index.html, docs/guide theme), in a
 * light and a dark palette (spec appearance, ADR 0033). A colour names a role, not a shade: `accent` is the moss of text and
 * icons on paper (light on dark paper), `rustText` the rust of text, `route` and `hazard` the colours on the map, and
 * `onSignal` and `onRust` the text on a signal or rust button, which keep their shade whatever the look.
 */
const light = {
  paper: "#f3eee4",
  paper2: "#ebe4d6",
  card: "#fbf8f1",
  ink: "#1c1d1a",
  ink2: "#4a4b44",
  rule: "#cfc6b4",
  moss: "#24382d",
  moss2: "#31503f",
  mossText: "#e9efe6",
  mossMuted: "#b9c2b4",
  signal: "#e6b422",
  /** The red of a speed limit sign, and of being over it. */
  limitRed: "#c81e1e",
  white: "#ffffff",
  rust: "#a8432a",
  accent: "#24382d",
  rustText: "#a8432a",
  route: "#31503f",
  hazard: "#a8432a",
  onSignal: "#1c1d1a",
  onRust: "#f3eee4",
};
export type Palette = typeof light;

const dark: Palette = {
  paper: "#141815",
  paper2: "#1b211c",
  card: "#1f261f",
  ink: "#ece8dc",
  ink2: "#b4b8aa",
  rule: "#3a433b",
  moss: "#24382d",
  moss2: "#31503f",
  mossText: "#e9efe6",
  mossMuted: "#b9c2b4",
  signal: "#e6b422",
  limitRed: "#c81e1e",
  white: "#ffffff",
  rust: "#a8432a",
  accent: "#a9cdb3",
  rustText: "#e98a6c",
  route: "#6fbf8e",
  hazard: "#e0785a",
  onSignal: "#1c1d1a",
  onRust: "#f3eee4",
};

export const PALETTES: Record<Scheme, Palette> = { light, dark };

let scheme: Scheme = "light";
const listeners = new Set<() => void>();

export const getScheme = (): Scheme => scheme;

export function setScheme(next: Scheme): void {
  if (next === scheme) return;
  scheme = next;
  for (const l of [...listeners]) l();
}

/** For useSyncExternalStore: calls back on each change, returns how to stop. */
export function onScheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** The colours of the look in use, read when a screen is drawn: never keep one in a constant at module level. */
export const colors: Palette = new Proxy({} as Palette, {
  get: (_target, key: string) => PALETTES[scheme][key as keyof Palette],
});

/**
 * Styles built from `colors`, built again for each look the first time it is drawn: `const styles = themed(() =>
 * StyleSheet.create({...}))` is used like StyleSheet.create's result.
 */
export function themed<T extends object>(make: () => T): T {
  const built: Partial<Record<Scheme, T>> = {};
  return new Proxy({} as T, {
    get: (_target, key) => ((built[scheme] ??= make()) as Record<PropertyKey, unknown>)[key],
  });
}

/** Files in assets/fonts, loaded in App.tsx. */
export const fonts = {
  sans: "SpaceGrotesk-Medium",
  bold: "SpaceGrotesk-Bold",
  mono: "JetBrainsMono-Regular",
};

/** Rounder than the roadbook list was: the home screen and its sheets (ADR 0024). */
export const radii = { card: 16, sheet: 28, pill: 999 };

/** A soft lift off the map. */
export const lift = {
  elevation: 10,
  shadowColor: "#000",
  shadowOpacity: 0.18,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
};

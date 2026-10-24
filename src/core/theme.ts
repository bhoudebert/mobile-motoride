/** Light or dark look (spec appearance, ADR 0033). */
export const SCHEMES = ["light", "dark"] as const;
export type Scheme = (typeof SCHEMES)[number];

/** What the rider picks: the phone's own setting, or one look for good. */
export const THEME_SETTINGS = ["system", "light", "dark"] as const;
export type ThemeSetting = (typeof THEME_SETTINGS)[number];
export const DEFAULT_THEME_SETTING: ThemeSetting = "system";

export const isThemeSetting = (v: unknown): v is ThemeSetting => (THEME_SETTINGS as readonly unknown[]).includes(v);

/** The next choice, in the order System, Light, Dark. */
export const nextThemeSetting = (s: ThemeSetting): ThemeSetting =>
  THEME_SETTINGS[(THEME_SETTINGS.indexOf(s) + 1) % THEME_SETTINGS.length]!;

/** The look to use: the setting, or the phone's (light when the phone does not say). */
export const resolveScheme = (setting: ThemeSetting, system: string | null | undefined): Scheme =>
  setting === "system" ? (system === "dark" ? "dark" : "light") : setting;

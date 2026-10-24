import { en } from "./en/index.ts";
import { fr } from "./fr/index.ts";

export const LANGUAGES = ["en", "fr"] as const;
export type Language = (typeof LANGUAGES)[number];
/** What the rider picks: the phone's language, or one of ours. */
export const LANGUAGE_SETTINGS = ["system", ...LANGUAGES] as const;
export type LanguageSetting = (typeof LANGUAGE_SETTINGS)[number];
export const DEFAULT_LANGUAGE_SETTING: LanguageSetting = "system";

export const isLanguageSetting = (v: unknown): v is LanguageSetting =>
  (LANGUAGE_SETTINGS as readonly unknown[]).includes(v);

/** The language's own name, never translated. */
export const LANGUAGE_NAME: Record<Language, string> = { en: "English", fr: "Français" };
/** The locale for numbers and dates, and the voice. */
export const LOCALE: Record<Language, string> = { en: "en-GB", fr: "fr-FR" };

/** The next choice, in the order System, English, Français. */
export const nextLanguageSetting = (s: LanguageSetting): LanguageSetting =>
  LANGUAGE_SETTINGS[(LANGUAGE_SETTINGS.indexOf(s) + 1) % LANGUAGE_SETTINGS.length]!;

/** The language of a locale such as "fr-FR" or "fr_CA": French if it is French, English for anything else. */
export const languageOfLocale = (locale: string | null | undefined): Language =>
  /^fr([-_]|$)/i.test(locale ?? "") ? "fr" : "en";

/** The language to use for a setting; the phone's locale is read by the caller. */
export const resolveLanguage = (setting: LanguageSetting, phoneLocale: string | null | undefined): Language =>
  setting === "system" ? languageOfLocale(phoneLocale) : setting;

const tables: Record<Language, Record<string, string>> = { en, fr };

let current: Language = "en";
const listeners = new Set<() => void>();

export const getLanguage = (): Language => current;

export function setLanguage(language: Language): void {
  if (language === current) return;
  current = language;
  for (const l of [...listeners]) l();
}

/** For useSyncExternalStore: calls back on each change, returns how to stop. */
export function onLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

type Key = keyof typeof en;
type PluralBase<K> = K extends `${infer B}_other` ? B : never;
/** A key of a message, or the base of a message with `_one` and `_other` forms. */
export type MessageKey = Exclude<Key, `${string}_one` | `${string}_other`> | PluralBase<Key>;
export type Params = Record<string, string | number>;

/**
 * Which form counts for a number: English has the singular for 1 only, French for 0 up to (not including) 2. Written out
 * because Hermes on Android has no `Intl.PluralRules` (ADR 0032).
 */
export function pluralForm(language: Language, count: number): "one" | "other" {
  if (language === "fr") return count >= 0 && count < 2 ? "one" : "other";
  return count === 1 ? "one" : "other";
}

/**
 * The message in the language in use, with `{name}` filled from `params`. A message that counts has `_one` and `_other`
 * forms, chosen by `params.count` the way the language counts (French says "1" and "0" in the singular).
 */
export function t(key: MessageKey, params?: Params): string {
  const table = tables[current];
  let name: string = key;
  if (params && typeof params.count === "number" && `${key}_other` in en) {
    name = `${key}_${pluralForm(current, params.count)}`;
  }
  const text = table[name] ?? tables.en[name] ?? name;
  return params ? text.replace(/\{(\w+)\}/g, (m, p: string) => (p in params ? String(params[p]) : m)) : text;
}

/** A number the way the language writes it: "1.5" in English, "1,5" in French. */
export const formatNumber = (n: number, options?: Intl.NumberFormatOptions): string =>
  new Intl.NumberFormat(LOCALE[current], options).format(n);

/** A date and time the way the language writes them. */
export const formatDateTime = (ms: number, options?: Intl.DateTimeFormatOptions): string =>
  new Date(ms).toLocaleString(LOCALE[current], options ?? { dateStyle: "short", timeStyle: "short" });

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { spanText } from "../src/core/cameraPolicy.ts";
import { formatDistance } from "../src/core/format.ts";
import { en } from "../src/core/i18n/en/index.ts";
import { AREAS } from "../src/core/i18n/en/index.ts";
import { fr } from "../src/core/i18n/fr/index.ts";
import {
  getLanguage,
  isLanguageSetting,
  languageOfLocale,
  nextLanguageSetting,
  onLanguage,
  pluralForm,
  resolveLanguage,
  setLanguage,
  t,
} from "../src/core/i18n/index.ts";
import { compassDirection, relativeDirection } from "../src/core/heading.ts";
import { instructionAt } from "../src/core/instruction.ts";
import { junctionHeadline, junctionSpeech, junctionText, lanesPhrase, ordinal } from "../src/core/junctions.ts";
import { warningText } from "../src/core/navigator.ts";
import { compassText, gText, leanText } from "../src/core/instruments.ts";
import { durationText, RIDE_STATE_LABEL } from "../src/core/recording.ts";
import { voiceName } from "../src/core/voice.ts";
import { prepareRoadbook } from "../src/core/roadbook.ts";
import { drawLine } from "./helpers/path.ts";
import type { Corner, PreparedJunction } from "../src/core/types.ts";

afterEach(() => setLanguage("en"));

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();

test("French has exactly the messages of English, with the same placeholders", () => {
  assert.deepEqual(Object.keys(fr).sort(), Object.keys(en).sort());
  for (const [key, text] of Object.entries(en)) {
    assert.deepEqual(placeholders(fr[key as keyof typeof fr]), placeholders(text), `placeholders of ${key}`);
    assert.ok(fr[key as keyof typeof fr].trim().length > 0, `${key} is empty in French`);
  }
});

test("no key is defined in two areas, and every area prefixes its keys", () => {
  const all = Object.entries(AREAS).flatMap(([area, table]) => Object.keys(table).map((k) => [area, k] as const));
  assert.equal(new Set(all.map(([, k]) => k)).size, all.length);
  assert.equal(Object.keys(en).length, all.length);
  for (const [area, key] of all) assert.ok(key.startsWith(`${area}.`), `${key} is in ${area}`);
});

test("a message with counted forms has both of them, in both languages", () => {
  for (const table of [en, fr] as Record<string, string>[]) {
    for (const key of Object.keys(table)) {
      if (key.endsWith("_one")) assert.ok(`${key.slice(0, -4)}_other` in table, key);
      if (key.endsWith("_other")) assert.ok(`${key.slice(0, -6)}_one` in table, key);
    }
  }
});

test("the language of a phone: French for French, English for anything else", () => {
  assert.equal(languageOfLocale("fr-FR"), "fr");
  assert.equal(languageOfLocale("fr_CA"), "fr");
  assert.equal(languageOfLocale("fr"), "fr");
  assert.equal(languageOfLocale("en-US"), "en");
  assert.equal(languageOfLocale("de-DE"), "en");
  assert.equal(languageOfLocale("fra-FR"), "en");
  assert.equal(languageOfLocale(null), "en");
  assert.equal(languageOfLocale(""), "en");
});

test("the setting wins over the phone, and System follows the phone", () => {
  assert.equal(resolveLanguage("system", "fr-FR"), "fr");
  assert.equal(resolveLanguage("system", "es-ES"), "en");
  assert.equal(resolveLanguage("en", "fr-FR"), "en");
  assert.equal(resolveLanguage("fr", "en-GB"), "fr");
});

test("the setting cycles System, English, Français and a stored value is checked", () => {
  assert.equal(nextLanguageSetting("system"), "en");
  assert.equal(nextLanguageSetting("en"), "fr");
  assert.equal(nextLanguageSetting("fr"), "system");
  assert.equal(isLanguageSetting("fr"), true);
  assert.equal(isLanguageSetting("de"), false);
  assert.equal(isLanguageSetting(null), false);
});

test("setLanguage tells the listeners once per change, and not after they stop", () => {
  let calls = 0;
  const stop = onLanguage(() => calls++);
  setLanguage("fr");
  setLanguage("fr");
  assert.equal(calls, 1);
  assert.equal(getLanguage(), "fr");
  stop();
  setLanguage("en");
  assert.equal(calls, 1);
});

test("t fills the placeholders, keeps one it has no value for, and falls back to the key", () => {
  assert.equal(t("nav.finishIn", { distance: "300 m" }), "Finish in 300 m");
  assert.equal(t("nav.finishIn"), "Finish in {distance}");
  assert.equal(t("nope.nothing" as "nav.finishIn"), "nope.nothing");
  setLanguage("fr");
  assert.equal(t("nav.finishIn", { distance: "300 m" }), "Arrivée dans 300 m");
});

test("counted words agree with the count: French counts 0 and 1.5 in the singular, English does not", () => {
  assert.equal(spanText(1000), "1 kilometre");
  assert.equal(spanText(1500), "1.5 kilometres");
  assert.equal(spanText(2000), "2 kilometres");
  assert.equal(spanText(400), "400 metres");
  setLanguage("fr");
  assert.equal(spanText(1000), "1 kilomètre");
  assert.equal(spanText(1500), "1,5 kilomètre");
  assert.equal(spanText(2000), "2 kilomètres");
  assert.equal(spanText(400), "400 mètres");
});

test("distances, decimals and figures are written the way the language writes them", () => {
  assert.equal(formatDistance(1234), "1.2 km");
  assert.equal(gText(0.82), "0.82 G");
  setLanguage("fr");
  assert.equal(formatDistance(1234), "1,2 km");
  assert.equal(formatDistance(847), "850 m");
  assert.equal(formatDistance(123_456), "123 km");
  assert.equal(gText(0.82), "0,82 G");
  assert.equal(leanText(30), "30° G");
  assert.equal(leanText(-12), "12° D");
  assert.equal(compassText(225), "SO 225°");
  assert.equal(compassText(280), "O 280°");
});

const corner = (severity: "hairpin" | "sharp"): Corner =>
  ({ severity, direction: "right", advisoryKmh: 40 }) as unknown as Corner;

test("a corner warning is said in the language, with the same figures", () => {
  assert.equal(warningText(corner("hairpin"), 123), "Hairpin right, 120 metres, 40");
  assert.equal(warningText(corner("sharp"), 123), "Sharp corner right, 120 metres, 40");
  setLanguage("fr");
  assert.equal(warningText(corner("hairpin"), 123), "Épingle à droite, 120 mètres, 40");
  assert.equal(warningText(corner("sharp"), 123), "Virage serré à droite, 120 mètres, 40");
});

test("turn instructions are said in the language", () => {
  const rb = prepareRoadbook({
    id: "t",
    name: "t",
    description: "",
    stops: [],
    line: drawLine([{ straight: 1500 }, { arc: 15, deg: 90, dir: "left" }, { straight: 1000 }]),
  });
  assert.equal(instructionAt(rb, 0).text, "Straight 1.5 km");
  assert.equal(instructionAt(rb, 1210).text, "Left in 300 m");
  setLanguage("fr");
  assert.equal(instructionAt(rb, 0).text, "Tout droit 1,5 km");
  assert.equal(instructionAt(rb, 1210).text, "À gauche dans 300 m");
});

const lanes = (use: number[], count: number): Extract<PreparedJunction, { kind: "lanes" }> =>
  ({ kind: "lanes", use, count, atM: 0, endM: 0 }) as unknown as Extract<PreparedJunction, { kind: "lanes" }>;
const roundabout = (exit: number): PreparedJunction =>
  ({ kind: "roundabout", exit, atM: 0, endM: 0 }) as unknown as PreparedJunction;

test("junction guidance is said in the language", () => {
  assert.equal(lanesPhrase(lanes([0, 1], 4)), "Keep left, lanes 1 and 2");
  assert.equal(junctionText(roundabout(2)), "Roundabout, 2nd exit");
  assert.equal(junctionSpeech(roundabout(2)), "At the roundabout, take the second exit");
  assert.deepEqual(junctionHeadline(lanes([1, 2], 4)), { headline: "Lanes 2 and 3", detail: "of 4" });
  setLanguage("fr");
  assert.equal(lanesPhrase(lanes([0, 1], 4)), "Serrez à gauche, voies 1 et 2");
  assert.equal(lanesPhrase(lanes([0], 3)), "Restez sur la voie de gauche");
  assert.equal(junctionText(roundabout(2)), "Rond-point, 2e sortie");
  assert.equal(junctionText(roundabout(1)), "Rond-point, 1re sortie");
  assert.equal(junctionSpeech(roundabout(2)), "Au rond-point, prenez la deuxième sortie");
  assert.equal(junctionSpeech(roundabout(14)), "Au rond-point, prenez la 14e sortie");
  assert.deepEqual(junctionHeadline(lanes([1, 2], 4)), { headline: "Voies 2 et 3", detail: "sur 4" });
  assert.deepEqual(junctionHeadline(roundabout(3)), { headline: "3e sortie", detail: "Rond-point" });
  assert.equal(ordinal(22), "22e");
});

test("directions, voice names and the labels of a ride are said in the language", () => {
  assert.equal(relativeDirection(90, 0), "right");
  assert.equal(compassDirection(0), "north");
  assert.equal(voiceName("alerts"), "Voice: alerts only");
  assert.equal(RIDE_STATE_LABEL.stopped, "Stopped early");
  assert.equal(durationText(125 * 60_000), "2 h 05");
  setLanguage("fr");
  assert.equal(relativeDirection(90, 0), "à droite");
  assert.equal(compassDirection(0), "au nord");
  assert.equal(voiceName("alerts"), "Voix : alertes seules");
  assert.equal(RIDE_STATE_LABEL.stopped, "Arrêtée avant la fin");
  assert.equal(durationText(125 * 60_000), "2 h 05");
});

test("plural rules: English singular for 1 only, French for 0 up to 2", () => {
  assert.deepEqual(
    [0, 1, 2].map((n) => pluralForm("en", n)),
    ["other", "one", "other"],
  );
  assert.equal(pluralForm("en", 1.5), "other");
  assert.deepEqual(
    [0, 1, 1.5, 2, 5].map((n) => pluralForm("fr", n)),
    ["one", "one", "one", "other", "other"],
  );
});

test("the core does not use Intl.PluralRules, which Hermes on Android lacks", async () => {
  const { readFileSync } = await import("node:fs");
  assert.ok(!/PluralRules/.test(readFileSync("src/core/i18n/index.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "")));
});

# 0032. English and French from one set of messages

- Status: accepted
- Date: 2026-10-22

## Context

The app was written in English only: about 300 texts in the screens, and sentences built in the pure core (turns, warnings, lanes,
the summary of a ride) that are also spoken by the voice. The first riders are in France. A rider with the phone in French should
not have to read or hear English, and a corner warning that is not understood at once is a safety problem, not a detail.

The core must stay pure (no React Native, no Expo, no I/O), and the sentences it builds are tested by Node.

## Decision

- One message table per language, in `src/core/i18n/`, keyed by a name (`ride.warn.hairpin`). The English table defines the keys; the
  French table is typed as having exactly the same keys, so a missing translation does not compile, and a test checks the same
  at run time (same keys, same `{placeholders}`).
- `t(key, params)` in the core looks the message up in the current language and fills `{name}` placeholders. A message that counts
  has `_one` and `_other` forms, picked by a rule written out for each language (English: the singular for 1; French: for 0 up to 2). `Intl.PluralRules`
  is not used: Hermes on Android does not have it, which a real phone showed and Node does not. Numbers go through
  `Intl.NumberFormat`, dates through `Intl.DateTimeFormat`, which Hermes has.
- The current language is a module variable of the core, `setLanguage`. Core functions that build a sentence call `t`; their
  callers do not pass the language, so signatures stay as they are and tests run in English by default. The speech uses the
  language's voice (`en-GB`, `fr-FR`).
- The setting is **System / English / Français**, kept in AsyncStorage like the voice mode (ADR 0019). System reads the phone's
  language with `Intl.DateTimeFormat().resolvedOptions().locale`, which needs no native module and so no new dev client. Anything
  that is not French is English.
- The screens read the language through a hook that subscribes to the core variable. The root of the app is keyed by the language,
  so a change redraws every screen at once. The setting lives in the menu of the home screen, never in a ride, so no ride is
  restarted by it.
- Not translated: roadbook files (their texts are the contract with agentRide, ADR 0010), place names, the rider's server.

## Consequences

- A new text needs a key in both tables or the build fails: translation cannot be forgotten.
- A third language is one more table and one more entry in the list of languages.
- The sentences of a roadbook stay in the language agentRide wrote them in; a French rider with an English roadbook hears
  English corner notes from the file but French turns and warnings from the app. Roadbooks in several languages are agentRide's job.
- The device smoke test reads the screen by its English texts, so it runs with the app set to English.

## Alternatives considered

- **i18next + expo-localization.** The usual choice, but a native module (a new dev client and a full device test for a
  setting), a dependency tree, and plurals/typing we would still wrap. Two languages do not need it; the table can be swapped
  for i18next later without touching the call sites (`t` stays).
- **Passing the language to every core function.** Explicit but changes every signature and test for no gain: the language is
  one global fact of the running app, like the clock.
- **Translating in the screens only.** The spoken sentences are built in the core and must be translated there.

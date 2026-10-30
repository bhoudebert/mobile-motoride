import * as Speech from "expo-speech";
import { abandon, requestDuck } from "../../modules/audio-focus/index.ts";
import { getLanguage, LOCALE } from "../core/i18n/index.ts";

/** A voice that never says it is done must not leave the music low for good: after this long the focus is given back. */
const WATCHDOG_MS = 30_000;

/** On iOS the session can still be busy when the speech says it is done: the focus is given back once more a moment later. */
const RETRY_MS = 400;

let speaking = 0;
let watchdog: ReturnType<typeof setTimeout> | null = null;

const release = () => {
  speaking = 0;
  if (watchdog) clearTimeout(watchdog);
  watchdog = null;
  if (!abandon()) {
    setTimeout(() => {
      if (speaking === 0) abandon();
    }, RETRY_MS);
  }
};
const finished = () => {
  speaking = Math.max(0, speaking - 1);
  if (speaking === 0) release();
};

/**
 * Say it in the language in use, with the music lowered while it is said (spec voice-guidance, ADR 0038): the speech engine asks
 * the system for no focus of its own, and on iOS it stops the music. Several messages in a row keep the focus until the last one is done.
 */
export function speak(text: string): void {
  speaking++;
  requestDuck();
  if (watchdog) clearTimeout(watchdog);
  watchdog = setTimeout(release, WATCHDOG_MS);
  Speech.speak(text, { language: LOCALE[getLanguage()], onDone: finished, onStopped: finished, onError: finished });
}

/** Cut off what is being said. */
export const stopSpeaking = (): void => {
  Speech.stop();
};

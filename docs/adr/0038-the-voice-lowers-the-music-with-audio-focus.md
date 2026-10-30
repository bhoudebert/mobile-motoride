# 0038. The voice lowers the music with audio focus

- Status: accepted
- Date: 2026-10-22

## Context

A rider with a helmet speaker listens to music or a podcast and wants the turn said over it, not instead of it. What the phone does was
measured, not assumed: while the app speaks, Android's focus stack is empty and the speech engine (Google's, package `com.google.android.tts`)
plays an `AudioTrack` as `USAGE_MEDIA`, `CONTENT_TYPE_SPEECH`. Nothing asks for audio focus, so the music is neither stopped nor lowered: the voice
talks over it at full volume. `expo-speech` has no option for it.

## Decision

- A small native module of our own, `modules/audio-focus` (Kotlin, autolinked by Expo from `modules/`), exposes `requestDuck()` and `abandon()`:
  `AudioManager.requestAudioFocus` with `AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK`, navigation-guidance usage and speech content type (the legacy call below
  Android 8). Apps that handle focus lower themselves; Android lowers the others.
- `src/ui/speech.ts` is the one place the app speaks: it takes the focus, speaks, and gives the focus back when the last message of a series is done,
  stopped or failed (a count, so a message cut off by the next does not release the focus under it). A watchdog gives it back after 30 s whatever the engine says,
  so the music is never left low.
- The module is optional at run time (`requireOptionalNativeModule`): in tests, on iOS or in a build made before it, `requestDuck` does nothing and the voice speaks as before.
- iOS: the same module (Swift) sets the audio session to `playback` with `duckOthers` and `interruptSpokenAudioAndMixWithOthers` and activates it; `abandon()` deactivates it with `notifyOthersOnDeactivation`, which makes the music come back. The session can still be busy when the speech says it is done, so `speech.ts` tries the release once more 400 ms later.

## Consequences

- A native change: a new dev client and release build, and the full device test before a release (AGENTS.md).
- Music is lowered, not paused: a rider who wants it paused uses the media button of the helmet.
- The focus is held for the length of each message, so a series of messages is one dip, not several.

## Alternatives considered

- **Playing silence with `expo-audio`'s "duck others" mode** to hold the focus. A hack that needs an audio asset and a second library for one call.
- **Leaving it alone.** The voice talking over music at full volume is hard to hear and, on a motorway, easy to miss.
- **A third-party audio-focus library.** None maintained for Expo's current architecture; thirty lines of Kotlin are cheaper to keep.

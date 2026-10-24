import * as Speech from "expo-speech";
import { setLanguage } from "../../src/core/i18n/index.ts";
import { speak, stopSpeaking } from "../../src/ui/speech.ts";

// Spec voice-guidance: the music is lowered while the voice speaks, and comes back when the last message is done (ADR 0038).
const mockFocus = { requestDuck: jest.fn(() => true), abandon: jest.fn(() => true) };
jest.mock("../../modules/audio-focus/index.ts", () => ({
  requestDuck: (...a: unknown[]) => (mockFocus.requestDuck as (...x: unknown[]) => boolean)(...a),
  abandon: (...a: unknown[]) => (mockFocus.abandon as (...x: unknown[]) => boolean)(...a),
}));

const speakMock = Speech.speak as jest.Mock;
const options = (call: number) =>
  speakMock.mock.calls[call]![1] as {
    language: string;
    onDone: () => void;
    onStopped: () => void;
    onError: () => void;
  };

beforeEach(() => {
  jest.useFakeTimers();
  speakMock.mockClear();
  (Speech.stop as jest.Mock).mockClear();
  mockFocus.requestDuck.mockClear();
  mockFocus.abandon.mockClear();
  setLanguage("en");
});
afterEach(() => {
  // Whatever a test left unfinished is finished, so the next one starts with no message being said.
  for (let i = 0; i < speakMock.mock.calls.length; i++) options(i).onDone();
  jest.useRealTimers();
  setLanguage("en");
});

test("speaking asks Android to lower the music first, in the language in use", () => {
  speak("Turn left");
  expect(mockFocus.requestDuck).toHaveBeenCalledTimes(1);
  expect(speakMock).toHaveBeenCalledWith("Turn left", expect.objectContaining({ language: "en-GB" }));
  expect(mockFocus.requestDuck.mock.invocationCallOrder[0]).toBeLessThan(speakMock.mock.invocationCallOrder[0]!);
  setLanguage("fr");
  speak("Tournez à gauche");
  expect(options(1).language).toBe("fr-FR");
});

test("the music comes back when the message is done, stopped or failed", () => {
  for (const end of ["onDone", "onStopped", "onError"] as const) {
    mockFocus.abandon.mockClear();
    speak("Hello");
    expect(mockFocus.abandon).not.toHaveBeenCalled();
    options(speakMock.mock.calls.length - 1)[end]();
    expect(mockFocus.abandon).toHaveBeenCalledTimes(1);
  }
});

test("messages in a row keep the music low until the last one is done", () => {
  speak("one");
  speak("two");
  const first = speakMock.mock.calls.length - 2;
  options(first).onDone();
  expect(mockFocus.abandon).not.toHaveBeenCalled();
  options(first + 1).onDone();
  expect(mockFocus.abandon).toHaveBeenCalledTimes(1);
});

test("a message cut off by the next one does not give the focus back under it", () => {
  speak("old");
  const old = speakMock.mock.calls.length - 1;
  stopSpeaking();
  speak("new");
  // The engine says the old one was stopped, after the new one was asked for.
  options(old).onStopped();
  expect(mockFocus.abandon).not.toHaveBeenCalled();
  options(speakMock.mock.calls.length - 1).onDone();
  expect(mockFocus.abandon).toHaveBeenCalledTimes(1);
});

test("a voice that never says it is done does not leave the music low for good", () => {
  speak("stuck");
  jest.advanceTimersByTime(29_000);
  expect(mockFocus.abandon).not.toHaveBeenCalled();
  jest.advanceTimersByTime(2_000);
  expect(mockFocus.abandon).toHaveBeenCalledTimes(1);
});

test("stopping the voice stops the speech engine", () => {
  stopSpeaking();
  expect(Speech.stop).toHaveBeenCalledTimes(1);
});

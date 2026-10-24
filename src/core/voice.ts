import { t } from "./i18n/index.ts";
/** How much the app says out loud (spec voice-guidance, ADR 0019). */
export const VOICE_MODES = ["full", "alerts", "off"] as const;
export type VoiceMode = (typeof VOICE_MODES)[number];

/** What a spoken message is about: the mode decides which are said. */
export type VoiceKind = "corner" | "zone" | "status" | "junction" | "turn" | "skip" | "fuel" | "weather" | "crash";

export const DEFAULT_VOICE: VoiceMode = "full";

export const isVoiceMode = (v: unknown): v is VoiceMode => (VOICE_MODES as readonly unknown[]).includes(v);

/** Full says everything, Alerts only the warnings (danger, a long stretch without fuel, and bad weather ahead), Off nothing. */
export function speaks(mode: VoiceMode, kind: VoiceKind): boolean {
  if (mode === "full") return true;
  return (
    mode === "alerts" &&
    (kind === "corner" || kind === "zone" || kind === "fuel" || kind === "weather" || kind === "crash")
  );
}

export const nextVoice = (mode: VoiceMode): VoiceMode =>
  VOICE_MODES[(VOICE_MODES.indexOf(mode) + 1) % VOICE_MODES.length]!;

/** On the button. */
export const voiceLabel = (mode: VoiceMode): string => t(`common.voice.label.${mode}`);

/** Said when the mode changes, and what the button is called. */
export const voiceName = (mode: VoiceMode): string => t(`common.voice.name.${mode}`);

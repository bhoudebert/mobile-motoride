import { TOP_INSET } from "./insets.ts";
import { t } from "../core/i18n/index.ts";
import { StyleSheet, Text, View } from "react-native";
import { formatDistance } from "../core/format.ts";
import type { InstructionKind } from "../core/instruction.ts";
import type { NavState } from "../core/navigator.ts";
import { colors, fonts, themed } from "./theme.ts";

const GLYPH: Record<InstructionKind, string> = {
  straight: "↑",
  left: "↰",
  right: "↱",
  uturn: "↶",
  finish: "⚑",
  rejoin: "!",
  roundabout: "⟳",
  lanes: "≣",
};

/** Eight arrows, clockwise from straight ahead: the way to the point to rejoin, relative to the rider's heading. */
const ARROWS = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];
const arrowFor = (relativeDeg: number) => ARROWS[Math.round((((relativeDeg % 360) + 360) % 360) / 45) % 8]!;

export const INSTRUCTION_BAR_TOP = TOP_INSET + 8;
export const INSTRUCTION_BAR_HEIGHT = 92;

/** "Straight 1.2 km", "Left in 150 m, then right": what comes next, at the top (spec turn-instructions). */
/** `inline`: sideways it is the head of the panel column, in the flow and smaller, not a bar over the map (ADR 0045). */
export function InstructionBar({
  nav,
  inline = false,
  corner,
}: {
  nav: NavState;
  inline?: boolean;
  /** Sideways, the warning of the next corner and the instruction are one card: yellow or rust, the corner first. */
  corner?: { title: string; sub: string; tone: "rust" | "signal" };
}) {
  const off = nav.offRoute;
  const { instruction } = nav;
  if (inline && corner) {
    const ink = corner.tone === "rust" ? colors.onRust : colors.onSignal;
    return (
      <View
        style={[styles.bar, styles.inline, styles.inlineCorner, { backgroundColor: colors[corner.tone] }]}
        accessibilityLiveRegion="polite"
        accessible
        accessibilityLabel={`${corner.title}. ${corner.sub}. ${instruction.headline ?? instruction.text}`}
        testID="corner-card"
      >
        <Text style={[styles.glyph, styles.glyphInline, { color: ink }]} importantForAccessibility="no">
          {instruction.kind === "rejoin" && instruction.relativeDeg != null
            ? arrowFor(instruction.relativeDeg)
            : GLYPH[instruction.kind]}
        </Text>
        <View style={styles.texts}>
          <Text style={[styles.main, styles.mainInline, { color: ink }]} numberOfLines={1} adjustsFontSizeToFit>
            {corner.title}
          </Text>
          <Text style={[styles.sub, styles.subInline, { color: ink }]} numberOfLines={1} adjustsFontSizeToFit>
            {corner.sub}
          </Text>
          <Text style={[styles.sub, styles.subInline, { color: ink }]} numberOfLines={1} adjustsFontSizeToFit>
            {instruction.headline ?? instruction.text}
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View
      style={[styles.bar, inline && styles.inline, { backgroundColor: off ? colors.ink : colors.moss }]}
      accessibilityLiveRegion="polite"
    >
      <Text
        style={[styles.glyph, inline && styles.glyphInline]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {instruction.kind === "rejoin" && instruction.relativeDeg != null
          ? arrowFor(instruction.relativeDeg)
          : off
            ? "!"
            : GLYPH[instruction.kind]}
      </Text>
      <View style={styles.texts}>
        <Text style={[styles.main, inline && styles.mainInline]} numberOfLines={1} adjustsFontSizeToFit={inline}>
          {instruction.headline ?? instruction.text}
        </Text>
        {off ? (
          <Text style={[styles.sub, inline && styles.subInline]}>
            {t("ride.bar.offRoute", { distance: formatDistance(nav.distanceToLineM) })}
          </Text>
        ) : instruction.kind === "roundabout" || instruction.kind === "lanes" ? (
          <Text style={[styles.sub, inline && styles.subInline]}>
            {`${instruction.detail ?? ""}${instruction.detail ? " · " : ""}${instruction.distanceM > 0 ? t("ride.bar.in", { distance: formatDistance(instruction.distanceM) }) : t("ride.bar.now")}`}
          </Text>
        ) : instruction.then ? (
          <Text style={[styles.sub, inline && styles.subInline]}>{t("ride.bar.then", { then: instruction.then })}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    bar: {
      position: "absolute",
      top: INSTRUCTION_BAR_TOP,
      left: 12,
      right: 12,
      height: INSTRUCTION_BAR_HEIGHT,
      borderRadius: 4,
      paddingHorizontal: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
    },
    glyph: { color: colors.signal, fontFamily: fonts.bold, fontSize: 48, width: 56, textAlign: "center" },
    // In the panel column: in the flow, 72 dp tall, a smaller glyph and words.
    inline: {
      position: "relative",
      top: undefined,
      left: undefined,
      right: undefined,
      height: 72,
      paddingHorizontal: 10,
      gap: 8,
    },
    inlineCorner: { height: 76 },
    glyphInline: { fontSize: 36, width: 40 },
    mainInline: { fontSize: 24 },
    subInline: { fontSize: 14 },
    texts: { flex: 1 },
    main: { color: colors.mossText, fontFamily: fonts.bold, fontSize: 30 },
    sub: { color: colors.mossMuted, fontFamily: fonts.sans, fontSize: 18 },
  }),
);

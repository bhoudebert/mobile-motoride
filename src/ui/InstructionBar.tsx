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
export function InstructionBar({ nav, top = INSTRUCTION_BAR_TOP }: { nav: NavState; top?: number }) {
  const off = nav.offRoute;
  const { instruction } = nav;
  return (
    <View
      style={[styles.bar, { top, backgroundColor: off ? colors.ink : colors.moss }]}
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.glyph} accessibilityElementsHidden importantForAccessibility="no">
        {instruction.kind === "rejoin" && instruction.relativeDeg != null
          ? arrowFor(instruction.relativeDeg)
          : off
            ? "!"
            : GLYPH[instruction.kind]}
      </Text>
      <View style={styles.texts}>
        <Text style={styles.main} numberOfLines={1}>
          {instruction.headline ?? instruction.text}
        </Text>
        {off ? (
          <Text style={styles.sub}>{t("ride.bar.offRoute", { distance: formatDistance(nav.distanceToLineM) })}</Text>
        ) : instruction.kind === "roundabout" || instruction.kind === "lanes" ? (
          <Text style={styles.sub}>
            {`${instruction.detail ?? ""}${instruction.detail ? " · " : ""}${instruction.distanceM > 0 ? t("ride.bar.in", { distance: formatDistance(instruction.distanceM) }) : t("ride.bar.now")}`}
          </Text>
        ) : instruction.then ? (
          <Text style={styles.sub}>{t("ride.bar.then", { then: instruction.then })}</Text>
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
    texts: { flex: 1 },
    main: { color: colors.mossText, fontFamily: fonts.bold, fontSize: 30 },
    sub: { color: colors.mossMuted, fontFamily: fonts.sans, fontSize: 18 },
  }),
);

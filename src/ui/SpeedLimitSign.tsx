import { t } from "../core/i18n/index.ts";
import { StyleSheet, Text, View } from "react-native";
import { formatDistance } from "../core/format.ts";
import type { SpeedLimit } from "../core/limits.ts";
import { colors, fonts, themed } from "./theme.ts";

export const SIGN_SIZE = 92;

/** What a screen reader says for the sign. */
export function signLabel(limit: SpeedLimit, over: boolean): string {
  if (limit.kmh === null) return t("ride.limit.unknown");
  const assumed = limit.posted ? "" : t("ride.limit.assumedSuffix");
  return t(over ? "ride.limit.over" : "ride.limit.is", { kmh: limit.kmh, assumed });
}

/** The speed limit as a round sign, always on screen; solid red when the rider is over it (spec speed-limits). */
/** `compact`: sideways, where the panel column has no height to spare (ADR 0045). */
export function SpeedLimitSign({
  limit,
  over,
  compact = false,
}: {
  limit: SpeedLimit;
  over: boolean;
  compact?: boolean;
}) {
  const known = limit.kmh !== null;
  return (
    <View style={styles.column}>
      <View
        style={[styles.sign, compact && styles.signCompact, !known && styles.unknown, over && styles.over]}
        accessible
        accessibilityRole="text"
        accessibilityLabel={signLabel(limit, over)}
        accessibilityLiveRegion={over ? "assertive" : "polite"}
      >
        <Text
          style={[
            styles.number,
            compact && styles.numberCompact,
            over && styles.numberOver,
            !known && styles.numberUnknown,
          ]}
        >
          {known ? limit.kmh : "?"}
        </Text>
      </View>
      {known && !limit.posted ? (
        <Text style={[styles.caption, compact && styles.captionCompact]}>{t("ride.limit.assumed")}</Text>
      ) : null}
      {limit.next ? (
        <Text style={[styles.caption, compact && styles.captionCompact]}>
          {t("ride.limit.then", { kmh: limit.next.kmh, distance: formatDistance(limit.next.distanceM) })}
        </Text>
      ) : null}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    column: { alignItems: "center", gap: 2 },
    sign: {
      width: SIGN_SIZE,
      height: SIGN_SIZE,
      borderRadius: SIGN_SIZE / 2,
      borderWidth: 9,
      borderColor: colors.limitRed,
      backgroundColor: colors.white,
      alignItems: "center",
      justifyContent: "center",
    },
    signCompact: { width: 68, height: 68, borderRadius: 34, borderWidth: 7 },
    numberCompact: { fontSize: 28 },
    captionCompact: { fontSize: 10 },
    unknown: { borderColor: colors.mossMuted, borderStyle: "dashed", backgroundColor: colors.moss2 },
    over: { backgroundColor: colors.limitRed, borderColor: colors.white },
    number: { color: colors.onSignal, fontFamily: fonts.bold, fontSize: 36 },
    numberOver: { color: colors.white },
    numberUnknown: { color: colors.mossText },
    caption: { color: colors.mossMuted, fontFamily: fonts.mono, fontSize: 11 },
  }),
);

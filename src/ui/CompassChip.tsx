import { StyleSheet, Text, View } from "react-native";
import { needleDeg, pointOf } from "../core/compass.ts";
import { t } from "../core/i18n/index.ts";
import { useLanguage } from "./languageSetting.ts";
import { LEVEL_COLOR } from "./TrafficUi.tsx";
import { colors, fonts, radii } from "./theme.ts";

/**
 * The compass beside the traffic chip while riding: a needle that points to the north of the screen, which is turned
 * along the heading, and the point the rider is facing (spec ride-navigation).
 */
export function CompassChip({ headingDeg }: { headingDeg: number }) {
  useLanguage();
  const point = pointOf(headingDeg);
  return (
    <View
      style={styles.chip}
      accessible
      accessibilityRole="image"
      accessibilityLabel={t("compass.name", { point: t(`compass.point.${point}`) })}
      testID="compass-chip"
    >
      <View style={[styles.needle, { transform: [{ rotate: `${needleDeg(headingDeg)}deg` }] }]} testID="compass-needle">
        <View style={styles.north} />
        <View style={styles.south} />
      </View>
      <Text style={styles.point}>{t(`compass.short.${point}`)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    backgroundColor: colors.moss,
  },
  needle: { width: 14, height: 26, alignItems: "center" },
  north: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 13,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: LEVEL_COLOR.heavy,
  },
  south: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 13,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: colors.mossText,
  },
  point: { color: colors.mossText, fontFamily: fonts.bold, fontSize: 10, lineHeight: 12 },
});

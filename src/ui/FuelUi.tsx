import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatDistance } from "../core/format.ts";
import { t } from "../core/i18n/index.ts";
import { nextFuelRange, nextFuel, poiName, upcomingFuel, fuelSummary, type RoutePoi } from "../core/pois.ts";
import { Sheet } from "./RideControlUi.tsx";
import { colors, fonts, radii, themed } from "./theme.ts";
import { useLanguage } from "./languageSetting.ts";
import type { FuelStatus } from "./useFuel.ts";

/** A small pump drawn with views, in the colour of the text around it. */
export function PumpIcon({ color = colors.mossText, size = 20 }: { color?: string; size?: number }) {
  const w = size * 0.5;
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          position: "absolute",
          left: size * 0.12,
          top: size * 0.05,
          width: w,
          height: size * 0.8,
          borderRadius: size * 0.1,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: "absolute",
          left: size * 0.22,
          top: size * 0.15,
          width: w * 0.7,
          height: size * 0.22,
          backgroundColor: colors.moss,
          borderRadius: 1,
        }}
      />
      <View
        style={{
          position: "absolute",
          left: size * 0.05,
          top: size * 0.85,
          width: w + size * 0.14,
          height: size * 0.1,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: "absolute",
          left: size * 0.66,
          top: size * 0.2,
          width: size * 0.22,
          height: size * 0.5,
          borderTopRightRadius: size * 0.2,
          borderRightWidth: Math.max(1.5, size * 0.09),
          borderTopWidth: Math.max(1.5, size * 0.09),
          borderColor: color,
        }}
      />
    </View>
  );
}

/** The next station on the way, over the panel: one tap opens the stops (spec fuel-stops). */
export function FuelChip({
  status,
  stops,
  progressM,
  onPress,
  inline,
}: {
  status: FuelStatus;
  stops: RoutePoi[];
  progressM: number;
  onPress: () => void;
  /** Without the pill, to stand in the panel over the distance left. */
  inline?: boolean;
}) {
  useLanguage();
  if (status === "loading") return null;
  const next = nextFuel(stops, progressM);
  const failed = status === "failed";
  const text = failed
    ? t("fuel.chip.failed")
    : next
      ? t("fuel.chip.next", { distance: formatDistance(next.distM) })
      : stops.length === 0
        ? t("fuel.chip.empty")
        : t("fuel.chip.none");
  const name = failed
    ? t("fuel.chip.name.failed")
    : next
      ? t("fuel.chip.name.next", { distance: formatDistance(next.distM) })
      : stops.length === 0
        ? t("fuel.chip.name.empty")
        : t("fuel.chip.name.none");
  return (
    <Pressable
      style={inline ? styles.inline : styles.chip}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={name}
      testID="fuel-chip"
    >
      <PumpIcon />
      <Text style={styles.chipText}>{text}</Text>
    </Pressable>
  );
}

/** The stations ahead, the longest stretch without fuel and the range of the tank. */
export function FuelCard({
  top,
  status,
  stops,
  progressM,
  totalM,
  rangeKm,
  onRange,
  onRetry,
  onClose,
}: {
  top: number;
  status: FuelStatus;
  stops: RoutePoi[];
  progressM: number;
  totalM: number;
  rangeKm: number;
  onRange: (km: number) => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  useLanguage();
  const summary = fuelSummary(stops, totalM, rangeKm, Math.max(0, progressM));
  const ahead = upcomingFuel(stops, progressM, 6);
  return (
    <Sheet
      top={top}
      footer={
        <Pressable
          style={[styles.button, styles.buttonMain]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("fuel.close")}
        >
          <Text style={styles.buttonText}>{t("fuel.close")}</Text>
        </Pressable>
      }
    >
      <Text style={styles.title}>{t("fuel.title")}</Text>
      {status === "loading" ? <Text style={styles.detail}>{t("fuel.loading")}</Text> : null}
      {status === "failed" ? (
        <>
          <Text style={styles.warn} accessibilityRole="alert">
            {t("fuel.failed")}
          </Text>
          <Pressable
            style={[styles.button, styles.buttonMain]}
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel={t("fuel.retry")}
          >
            <Text style={styles.buttonText}>{t("fuel.retry")}</Text>
          </Pressable>
        </>
      ) : null}
      {status === "ready" ? (
        <>
          <Text style={styles.detail}>
            {summary.count === 0 && stops.length === 0
              ? t("fuel.none")
              : `${t("fuel.count", { count: stops.length })} · ${t("fuel.gap", { gap: formatDistance(summary.longestGapM) })}`}
          </Text>
          {summary.tight ? (
            <Text style={styles.warn} accessibilityRole="alert">
              {t("fuel.tight")}
            </Text>
          ) : null}
          {ahead.length === 0 && stops.length > 0 ? <Text style={styles.detail}>{t("fuel.noMore")}</Text> : null}
          {ahead.map((a) => (
            <View
              key={a.stop.poi.id}
              style={styles.row}
              accessible
              accessibilityLabel={`${poiName(a.stop.poi) ?? t("fuel.station")}, ${itemDetail(a.distM, a.stop.offM)}`}
            >
              <PumpIcon color={colors.accent} size={22} />
              <View style={styles.rowText}>
                <Text style={styles.rowName}>{poiName(a.stop.poi) ?? t("fuel.station")}</Text>
                <Text style={styles.detail}>{itemDetail(a.distM, a.stop.offM)}</Text>
              </View>
            </View>
          ))}
        </>
      ) : null}
      <Pressable
        style={[styles.button, styles.buttonOther]}
        onPress={() => onRange(nextFuelRange(rangeKm))}
        accessibilityRole="button"
        accessibilityLabel={`${t("fuel.range", { km: rangeKm })}. ${t("fuel.range.hint")}`}
      >
        <Text style={styles.buttonText}>{t("fuel.range", { km: rangeKm })}</Text>
      </Pressable>
    </Sheet>
  );
}

const itemDetail = (distM: number, offM: number): string =>
  offM < 100
    ? t("fuel.item.on", { distance: formatDistance(distM) })
    : t("fuel.item.off", { distance: formatDistance(distM), off: formatDistance(offM) });

const styles = themed(() =>
  StyleSheet.create({
    chip: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      borderRadius: radii.pill,
      backgroundColor: colors.moss,
    },
    inline: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8 },
    chipText: { color: colors.mossText, fontFamily: fonts.bold, fontSize: 15 },
    title: { color: colors.ink, fontFamily: fonts.bold, fontSize: 20 },
    detail: { color: colors.ink2, fontFamily: fonts.sans, fontSize: 14 },
    warn: { color: colors.rustText, fontFamily: fonts.bold, fontSize: 14 },
    row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
    rowText: { flex: 1 },
    rowName: { color: colors.ink, fontFamily: fonts.bold, fontSize: 16 },
    button: {
      minHeight: 48,
      borderRadius: radii.card,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    buttonMain: { backgroundColor: colors.moss2 },
    buttonOther: { backgroundColor: colors.moss2 },
    buttonText: { color: colors.mossText, fontFamily: fonts.bold, fontSize: 16 },
  }),
);

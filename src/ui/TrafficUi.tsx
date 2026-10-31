import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatDistance } from "../core/format.ts";
import { t, type MessageKey } from "../core/i18n/index.ts";
import { type TrafficLevel, type TrafficOutlook } from "../core/traffic.ts";
import { MotorcycleIcon } from "./Icon.tsx";
import { Sheet } from "./RideControlUi.tsx";
import { colors, fonts, radii, themed } from "./theme.ts";
import { useLanguage } from "./languageSetting.ts";
import type { TrafficStatus } from "./useTraffic.ts";

const levelName = (l: TrafficLevel): string => t(`traffic.level.${l}`);
/** The colour of a level on the dark chip and on the map: green when it flows, amber for slow, red for heavy or closed. */
export const LEVEL_COLOR = { free: "#3fc27a", slow: "#f0a030", heavy: "#e5484d", closed: "#e5484d" } as const;

/** How a screen reader names the chip, and the colour of its picture: green, amber or red, grey when nothing is known. */
export function trafficChip(status: TrafficStatus, outlook: TrafficOutlook | null): { name: string; tint: string } {
  const grey = colors.mossText;
  if (status === "off") return { name: t("traffic.name.off"), tint: grey };
  if (!outlook) {
    if (status === "failed") return { name: t("traffic.name.failed"), tint: grey };
    return { name: t("traffic.name.loading"), tint: grey };
  }
  const first = outlook.first;
  if (first) {
    const here = first.point.distM === 0;
    const level = first.level as "slow" | "heavy" | "closed";
    return {
      name: here
        ? t("traffic.name.jamHere", { level: levelName(level) })
        : t("traffic.name.jam", { level: levelName(level), distance: formatDistance(first.point.distM) }),
      tint: LEVEL_COLOR[level],
    };
  }
  if (!outlook.known) return { name: t("traffic.name.unknown"), tint: grey };
  return { name: t("traffic.name.clear"), tint: LEVEL_COLOR.free };
}

/** The traffic chip beside the weather and the fuel: shown only when the rider's server has traffic. */
export function TrafficChip({
  status,
  outlook,
  onPress,
}: {
  status: TrafficStatus;
  outlook: TrafficOutlook | null;
  onPress: () => void;
}) {
  useLanguage();
  if (status === "none") return null;
  const chip = trafficChip(status, outlook);
  return (
    <Pressable
      style={[styles.chip, status === "off" && styles.chipOff]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={chip.name}
      testID="traffic-chip"
    >
      <MotorcycleIcon color={chip.tint} size={24} />
    </Pressable>
  );
}

/** The levels at each point ahead, the switch, and the credit. */
export function TrafficCard({
  top,
  status,
  outlook,
  enabled,
  budget,
  countries,
  onToggle,
  onRetry,
  onClose,
}: {
  top: number;
  status: TrafficStatus;
  outlook: TrafficOutlook | null;
  enabled: boolean;
  budget: boolean;
  countries: string[];
  onToggle: () => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  useLanguage();
  const toggle = enabled ? t("traffic.toggle.on") : t("traffic.toggle.off");
  return (
    <Sheet
      top={top}
      footer={
        <Pressable
          style={[styles.button, styles.buttonMain]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("traffic.close")}
        >
          <Text style={styles.buttonText}>{t("traffic.close")}</Text>
        </Pressable>
      }
    >
      <Text style={styles.title}>{t("traffic.title")}</Text>
      {!enabled ? <Text style={styles.detail}>{t("traffic.disabled")}</Text> : null}
      {enabled && status === "failed" && !outlook ? (
        <>
          <Text style={styles.warn} accessibilityRole="alert">
            {t("traffic.failed")}
          </Text>
          <Pressable
            style={[styles.button, styles.buttonMain]}
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel={t("traffic.retry")}
          >
            <Text style={styles.buttonText}>{t("traffic.retry")}</Text>
          </Pressable>
        </>
      ) : null}
      {enabled && !budget ? <Text style={styles.warn}>{t("traffic.budget")}</Text> : null}
      {enabled && outlook && !outlook.known ? <Text style={styles.warn}>{t("traffic.noData")}</Text> : null}
      {enabled && outlook
        ? outlook.readings.map((r, i) => {
            const where =
              r.point.distM === 0 ? t("traffic.here") : t("traffic.at", { distance: formatDistance(r.point.distM) });
            return (
              <View key={i} style={styles.point} accessible accessibilityLabel={`${where}, ${levelName(r.level)}`}>
                <View style={[styles.dot, { backgroundColor: dotColor(r.level) }]} />
                <Text style={styles.pointWhere}>{where}</Text>
                <Text style={styles.detail}>{levelName(r.level)}</Text>
              </View>
            );
          })
        : null}
      {enabled ? <Text style={styles.detail}>{t("traffic.note")}</Text> : null}
      {enabled && countries.length > 0 ? (
        <Text style={styles.detail}>{t("traffic.coverage", { countries: countries.map(countryName).join(", ") })}</Text>
      ) : null}
      <Pressable
        style={[styles.button, styles.buttonMain]}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${toggle}. ${t("traffic.toggle.hint")}`}
      >
        <Text style={styles.buttonText}>{toggle}</Text>
      </Pressable>
      <Text style={styles.attribution}>
        {countries.includes("FR") ? t("traffic.attribution.fr") : t("traffic.attribution")}
      </Text>
    </Sheet>
  );
}

/** A country the way the language writes it; a code with no name stays as it is. */
export const countryName = (code: string): string => {
  const key = `traffic.country.${code}` as MessageKey;
  const name = t(key);
  return name === key ? code : name;
};

const dotColor = (l: TrafficLevel): string =>
  l === "slow" || l === "heavy" || l === "closed" ? LEVEL_COLOR[l] : l === "free" ? "#3f9f5f" : "#8a8a80";

const styles = themed(() =>
  StyleSheet.create({
    chip: {
      width: 48,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radii.pill,
      backgroundColor: colors.moss,
    },
    chipOff: { opacity: 0.55 },
    title: { color: colors.ink, fontFamily: fonts.bold, fontSize: 20 },
    detail: { color: colors.ink2, fontFamily: fonts.sans, fontSize: 14 },
    warn: { color: colors.rustText, fontFamily: fonts.bold, fontSize: 14 },
    point: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
    dot: { width: 14, height: 14, borderRadius: 7 },
    pointWhere: { color: colors.ink, fontFamily: fonts.bold, fontSize: 16, flex: 1 },
    button: {
      minHeight: 48,
      borderRadius: radii.card,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    buttonMain: { backgroundColor: colors.moss2 },
    buttonText: { color: colors.mossText, fontFamily: fonts.bold, fontSize: 16 },
    attribution: { color: colors.ink2, fontFamily: fonts.mono, fontSize: 11 },
  }),
);

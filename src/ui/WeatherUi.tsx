import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatDistance } from "../core/format.ts";
import { formatDateTime, formatNumber, t } from "../core/i18n/index.ts";
import { isAlert, type Condition, type Outlook, type Weighed } from "../core/weather.ts";
import { Sheet } from "./RideControlUi.tsx";
import { colors, fonts, radii, themed } from "./theme.ts";
import { useLanguage } from "./languageSetting.ts";
import type { WeatherStatus } from "./useWeather.ts";

const GLYPH: Record<Condition, string> = {
  dry: "☀",
  light: "🌦",
  rain: "🌧",
  heavy: "🌧",
  storm: "⛈",
  snow: "❄",
  ice: "🧊",
};

const condName = (c: Condition): string => t(`weather.cond.${c}`);
const tempText = (c: number): string => t("weather.temp", { t: formatNumber(Math.round(c)) });
const clockText = (ms: number) => formatDateTime(ms, { hour: "2-digit", minute: "2-digit" });

/** What the row says, and the sign in front of it. */
export function weatherRow(status: WeatherStatus, outlook: Outlook | null): { glyph: string; text: string } {
  if (status === "off") return { glyph: "⊘", text: t("weather.row.off") };
  if (!outlook) {
    if (status === "failed") return { glyph: "☁", text: t("weather.row.failed") };
    return { glyph: "☁", text: t("weather.row.loading") };
  }
  const last = outlook.points[outlook.points.length - 1];
  const reach = formatDistance(last?.point.distM ?? 0);
  const temp = outlook.here?.forecast?.tempC;
  const withTemp = (text: string) => (temp === null || temp === undefined ? text : `${text} · ${tempText(temp)}`);
  if (outlook.now === null && !outlook.coming) return { glyph: "☁", text: t("weather.row.unknown") };
  if (outlook.now !== null && isAlert(outlook.now)) {
    const text = outlook.clearing
      ? t("weather.row.now", { cond: condName(outlook.now), distance: formatDistance(outlook.clearing.point.distM) })
      : t("weather.row.nowLong", { cond: condName(outlook.now), distance: reach });
    return { glyph: GLYPH[outlook.now], text: withTemp(text) };
  }
  if (outlook.coming && outlook.coming.condition) {
    const c = outlook.coming.condition;
    return {
      glyph: GLYPH[c],
      text: withTemp(
        t("weather.row.coming", { cond: condName(c), distance: formatDistance(outlook.coming.point.distM) }),
      ),
    };
  }
  if (outlook.now === "light") return { glyph: GLYPH.light, text: withTemp(condName("light")) };
  return { glyph: GLYPH.dry, text: withTemp(t("weather.row.dry", { distance: reach })) };
}

/** The few words of the chip: a sign, and the one thing that matters (the temperature, or where the rain is). */
export function weatherChipText(status: WeatherStatus, outlook: Outlook | null): { glyph: string; text: string } {
  const full = weatherRow(status, outlook);
  if (status === "off") return { glyph: full.glyph, text: t("weather.chip.off") };
  if (!outlook) return { glyph: full.glyph, text: "…" };
  const temp = outlook.here?.forecast?.tempC;
  const degrees = temp === null || temp === undefined ? null : tempText(temp);
  if (outlook.now !== null && isAlert(outlook.now)) {
    return {
      glyph: GLYPH[outlook.now],
      text: outlook.clearing
        ? t("weather.chip.clears", { distance: formatDistance(outlook.clearing.point.distM) })
        : condName(outlook.now),
    };
  }
  if (outlook.coming && outlook.coming.condition) {
    return { glyph: GLYPH[outlook.coming.condition], text: formatDistance(outlook.coming.point.distM) };
  }
  if (outlook.now === null) return { glyph: "☁", text: "?" };
  return { glyph: outlook.now === "light" ? GLYPH.light : GLYPH.dry, text: degrees ?? condName(outlook.now) };
}

/** The weather ahead as a chip beside Find and Fuel; a tap opens the details, and its name says it all. */
export function WeatherRow({
  status,
  outlook,
  onPress,
}: {
  status: WeatherStatus;
  outlook: Outlook | null;
  onPress: () => void;
}) {
  useLanguage();
  const full = weatherRow(status, outlook);
  const chip = weatherChipText(status, outlook);
  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("weather.row.name", { text: full.text })}
      testID="weather-row"
    >
      <Text style={styles.glyph}>{chip.glyph}</Text>
      <Text style={styles.rowText} numberOfLines={1}>
        {chip.text}
      </Text>
    </Pressable>
  );
}

const pointLine = (w: Weighed): string => {
  if (!w.forecast || w.condition === null) return t("weather.unknown");
  const parts = [clockText(w.point.etaMs), condName(w.condition)];
  if (w.forecast.tempC !== null) parts.push(tempText(w.forecast.tempC));
  if ((w.forecast.precipMm ?? 0) >= 0.1)
    parts.push(t("weather.precip", { mm: formatNumber(w.forecast.precipMm!, { maximumFractionDigits: 1 }) }));
  if (w.forecast.windMps !== null) parts.push(t("weather.wind", { kmh: Math.round(w.forecast.windMps * 3.6) }));
  return parts.join(" · ");
};

/** The forecast for here and every 15 km ahead, and the switch that turns the weather off. */
export function WeatherCard({
  top,
  status,
  outlook,
  enabled,
  onToggle,
  onRetry,
  onClose,
}: {
  top: number;
  status: WeatherStatus;
  outlook: Outlook | null;
  enabled: boolean;
  onToggle: () => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  useLanguage();
  const toggle = enabled ? t("weather.toggle.on") : t("weather.toggle.off");
  return (
    <Sheet
      top={top}
      footer={
        <Pressable
          style={[styles.button, styles.buttonMain]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("weather.close")}
        >
          <Text style={styles.buttonText}>{t("weather.close")}</Text>
        </Pressable>
      }
    >
      <Text style={styles.title}>{t("weather.title")}</Text>
      {!enabled ? <Text style={styles.detail}>{t("weather.disabled")}</Text> : null}
      {enabled && status === "failed" && !outlook ? (
        <>
          <Text style={styles.warn} accessibilityRole="alert">
            {t("weather.failed")}
          </Text>
          <Pressable
            style={[styles.button, styles.buttonMain]}
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel={t("weather.retry")}
          >
            <Text style={styles.buttonText}>{t("weather.retry")}</Text>
          </Pressable>
        </>
      ) : null}
      {enabled && outlook
        ? outlook.points.map((w, i) => (
            <View
              key={i}
              style={styles.point}
              accessible
              accessibilityLabel={`${i === 0 ? t("weather.here") : t("weather.at", { distance: formatDistance(w.point.distM) })}, ${pointLine(w)}`}
            >
              <Text style={styles.glyphDark}>{w.condition ? GLYPH[w.condition] : "☁"}</Text>
              <View style={styles.pointText}>
                <Text style={styles.pointWhere}>
                  {i === 0 ? t("weather.here") : t("weather.at", { distance: formatDistance(w.point.distM) })}
                </Text>
                <Text style={styles.detail}>{pointLine(w)}</Text>
              </View>
            </View>
          ))
        : null}
      <Pressable
        style={[styles.button, styles.buttonOther]}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${toggle}. ${t("weather.toggle.hint")}`}
      >
        <Text style={styles.buttonText}>{toggle}</Text>
      </Pressable>
      <Text style={styles.attribution}>{t("weather.attribution")}</Text>
    </Sheet>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    row: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      borderRadius: radii.pill,
      backgroundColor: colors.moss,
    },
    glyph: { fontSize: 18, color: colors.mossText },
    glyphDark: { fontSize: 22, color: colors.ink, width: 32, textAlign: "center" },
    rowText: { color: colors.mossText, fontFamily: fonts.bold, fontSize: 15, flexShrink: 1 },
    title: { color: colors.ink, fontFamily: fonts.bold, fontSize: 20 },
    detail: { color: colors.ink2, fontFamily: fonts.sans, fontSize: 14 },
    warn: { color: colors.rustText, fontFamily: fonts.bold, fontSize: 14 },
    point: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52 },
    pointText: { flex: 1 },
    pointWhere: { color: colors.ink, fontFamily: fonts.bold, fontSize: 16 },
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
    attribution: { color: colors.ink2, fontFamily: fonts.mono, fontSize: 11 },
  }),
);

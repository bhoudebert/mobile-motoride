import { Pressable, StyleSheet, Text, View } from "react-native";
import { t } from "../core/i18n/index.ts";
import type { OfflineState } from "./offlineMap.ts";
import { colors, fonts, themed } from "./theme.ts";

/** What is saved of the map for offline, and the one thing to do about it (spec offline-basemap). */
export function OfflineRow({
  state,
  onSave,
  onRemove,
}: {
  state: OfflineState;
  onSave: () => void;
  onRemove: () => void;
}) {
  if (state.kind === "saving")
    return (
      <Text style={styles.text} accessibilityLiveRegion="polite">
        {t("home.offline.saving", { percent: state.percent })}
      </Text>
    );
  if (state.kind === "toolarge") return <Text style={styles.text}>{t("home.offline.tooLarge")}</Text>;
  if (state.kind === "saved")
    return (
      <View style={styles.saved}>
        <Text style={styles.text}>{t("home.offline.saved")}</Text>
        <Pressable
          style={styles.link}
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={t("home.offline.removeLabel")}
        >
          <Text style={styles.linkText}>{t("home.offline.remove")}</Text>
        </Pressable>
      </View>
    );
  return (
    <Pressable
      style={styles.button}
      onPress={onSave}
      accessibilityRole="button"
      accessibilityLabel={t("home.offline.saveLabel")}
    >
      <Text style={styles.buttonText}>
        {state.kind === "failed" ? t("home.offline.failed") : t("home.offline.saveLabel")}
      </Text>
    </Pressable>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    text: { color: colors.mossMuted, fontFamily: fonts.mono, fontSize: 12 },
    saved: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    link: { minHeight: 48, minWidth: 48, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
    linkText: { color: colors.signal, fontFamily: fonts.bold, fontSize: 14 },
    button: {
      minHeight: 48,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.mossMuted,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
    },
    buttonText: { color: colors.mossText, fontFamily: fonts.bold, fontSize: 14 },
  }),
);

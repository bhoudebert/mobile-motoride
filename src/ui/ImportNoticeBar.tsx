import { TOP_INSET } from "./insets.ts";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { t } from "../core/i18n/index.ts";
import type { ImportNotice } from "./useImport.ts";
import { colors, fonts, lift, radii, themed } from "./theme.ts";

/** The result of an import that went wrong, or that is on its way, on top of whatever screen is shown. */
export function ImportNoticeBar({ notice, onDismiss }: { notice: ImportNotice; onDismiss: () => void }) {
  if (!notice) return null;
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.bar} accessibilityRole="alert" accessibilityLiveRegion="polite">
        <Text style={styles.text}>
          {notice.kind === "busy" ? (notice.text ?? t("home.notice.importing")) : notice.text}
        </Text>
        {notice.kind !== "busy" ? (
          <Pressable
            style={styles.ok}
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel={t("home.notice.dismiss")}
          >
            <Text style={styles.okText}>{t("home.notice.ok")}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    wrap: { position: "absolute", left: 12, right: 12, top: TOP_INSET + 76, zIndex: 10 },
    bar: {
      backgroundColor: colors.ink,
      borderRadius: radii.card,
      paddingLeft: 16,
      flexDirection: "row",
      alignItems: "center",
      ...lift,
    },
    text: { flex: 1, color: colors.mossText, fontFamily: fonts.sans, fontSize: 14, paddingVertical: 14 },
    ok: { minWidth: 56, minHeight: 48, alignItems: "center", justifyContent: "center" },
    okText: { color: colors.signal, fontFamily: fonts.bold, fontSize: 15 },
  }),
);

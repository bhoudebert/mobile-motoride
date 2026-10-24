import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { t, type MessageKey } from "../core/i18n/index.ts";
import { useLanguage } from "./languageSetting.ts";
import type { ShareStatus } from "./liveSharer.ts";
import { colors, fonts, themed } from "./theme.ts";

/** Before the ride: share it live, or not (spec live-share). Shown only when a server is set. */
export function LiveShareChoice({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  useLanguage();
  return (
    // The whole row is the switch: a bigger target at the bike, and one thing for a screen reader to name.
    <Pressable
      style={styles.row}
      onPress={() => onChange(!on)}
      accessibilityRole="switch"
      accessibilityLabel={t("server.share.label")}
      accessibilityState={{ checked: on }}
    >
      <Text style={styles.text}>{t("server.share.label")}</Text>
      <Switch
        value={on}
        testID="share-switch"
        onValueChange={onChange}
        importantForAccessibility="no-hide-descendants"
        trackColor={{ true: colors.signal, false: colors.mossMuted }}
        thumbColor={colors.paper}
      />
    </Pressable>
  );
}

/** During a ride that is not shared (never, or stopped): share it now, with a new link, to the same people or others. */
export function LiveShareOffer({ onShare }: { onShare: () => void }) {
  useLanguage();
  return (
    <View style={styles.row} testID="live-offer">
      <Text style={styles.text}>{t("server.share.notShared")}</Text>
      <Pressable
        style={styles.action}
        onPress={onShare}
        accessibilityRole="button"
        accessibilityLabel={t("server.share.label")}
      >
        <Text style={styles.actionText}>{t("server.share.button")}</Text>
      </Pressable>
    </View>
  );
}

const MESSAGE: Record<ShareStatus, MessageKey | null> = {
  starting: "server.share.starting",
  live: "server.share.live",
  interrupted: "server.share.interrupted",
  refused: "server.share.refused",
  stopped: null,
};

/** During the ride: that it is shared, and the two things to do about it. */
export function LiveShareLine({
  status,
  canLink,
  onLink,
  onStop,
}: {
  status: ShareStatus;
  canLink: boolean;
  onLink: () => void;
  onStop: () => void;
}) {
  useLanguage();
  return (
    <View style={styles.row} testID="live-line">
      <Text
        style={[styles.text, status === "interrupted" || status === "refused" ? styles.warn : null]}
        accessibilityLiveRegion="polite"
      >
        {MESSAGE[status] ? t(MESSAGE[status]) : ""}
      </Text>
      <View style={styles.actions}>
        {canLink ? (
          <Pressable
            style={styles.action}
            onPress={onLink}
            accessibilityRole="button"
            accessibilityLabel={t("server.share.sendAgain")}
          >
            <Text style={styles.actionText}>{t("server.share.link")}</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={styles.action}
          onPress={onStop}
          accessibilityRole="button"
          accessibilityLabel={t("server.share.stop.label")}
        >
          <Text style={styles.actionText}>{t("server.share.stop")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    row: {
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      // Clear of the screen's edge, where the system's own gestures begin.
      paddingRight: 12,
    },
    text: { color: colors.mossText, fontFamily: fonts.sans, fontSize: 14, flexShrink: 1 },
    warn: { color: colors.signal },
    actions: { flexDirection: "row" },
    action: { minHeight: 48, minWidth: 56, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
    actionText: { color: colors.signal, fontFamily: fonts.bold, fontSize: 14 },
  }),
);

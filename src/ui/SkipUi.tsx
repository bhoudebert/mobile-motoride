import { t } from "../core/i18n/index.ts";
import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Sheet } from "./RideControlUi.tsx";
import type { SkipState } from "./useRide.ts";
import { colors, fonts, themed } from "./theme.ts";

export const CONFIRM_TIMEOUT_MS = 10_000;
export const UNDO_TIMEOUT_MS = 15_000;

/** In the HUD: the point that can be skipped. Refused while moving (the app asks nothing of a rider who rides). */
export function SkipButton({ skip, onPress }: { skip: SkipState; onPress: () => void }) {
  if (!skip.plan) return null;
  const name = skip.plan.skipped.name;
  const allowed = skip.canSkip;
  return (
    <Pressable
      style={[styles.skip, !allowed && styles.skipOff]}
      onPress={allowed ? onPress : undefined}
      accessibilityRole="button"
      accessibilityLabel={allowed ? t("ride.skip.button", { name }) : t("ride.skip.blocked", { name })}
      accessibilityState={{ disabled: !allowed }}
    >
      <Text style={[styles.skipText, !allowed && styles.skipTextOff]} numberOfLines={1}>
        {skip.busy ? t("ride.skip.busy") : allowed ? t("ride.skip.button", { name }) : t("ride.skip.blocked", { name })}
      </Text>
    </Pressable>
  );
}

/** The second tap: what is skipped and where the rider goes instead. Cancels itself after 10 seconds. */
export function SkipConfirm({ skip, onClose, top }: { skip: SkipState; onClose: () => void; top: number }) {
  // One timer for as long as the card is up: the screen re-renders every second and must not restart it.
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const timer = setTimeout(() => close.current(), CONFIRM_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);
  if (!skip.plan) return null;
  return (
    <Sheet
      top={top}
      footer={
        <View style={styles.row}>
          <Pressable style={[styles.button, styles.cancel]} onPress={onClose} accessibilityRole="button">
            <Text style={[styles.buttonText, { color: colors.mossText }]}>{t("ride.btn.cancel")}</Text>
          </Pressable>
          <Pressable
            style={[styles.button, styles.confirm]}
            onPress={() => {
              onClose();
              skip.confirm();
            }}
            accessibilityRole="button"
            accessibilityLabel={t("ride.skip.confirmA11y", {
              skipped: skip.plan.skipped.name,
              target: skip.plan.target.name,
            })}
          >
            <Text style={[styles.buttonText, { color: colors.onRust }]}>{t("ride.skip.confirm")}</Text>
          </Pressable>
        </View>
      }
    >
      <Text style={styles.title}>{t("ride.skip.title", { name: skip.plan.skipped.name })}</Text>
      <Text style={styles.sub}>{t("ride.skip.sub", { name: skip.plan.target.name })}</Text>
    </Sheet>
  );
}

/** For 15 seconds after a skip: say what was done and let the rider take it back. */
export function UndoBar({ skip, top }: { skip: SkipState; top: number }) {
  const last = skip.last;
  const forget = useRef(skip.forgetLast);
  forget.current = skip.forgetLast;
  // Keyed on the skip itself, so the screen's own re-renders do not restart the 15 seconds.
  useEffect(() => {
    if (!last) return;
    const timer = setTimeout(() => forget.current(), UNDO_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [last]);
  if (!last) return null;
  return (
    <View style={[styles.undo, { top }]} accessibilityLiveRegion="polite">
      <Text style={styles.undoText} numberOfLines={2}>
        {t("ride.skip.undoText", { skipped: last.skipped, target: last.target })}
      </Text>
      <Pressable
        style={styles.undoButton}
        onPress={skip.undo}
        accessibilityRole="button"
        accessibilityLabel={t("ride.skip.undoA11y")}
      >
        <Text style={styles.undoButtonText}>{t("ride.skip.undo")}</Text>
      </Pressable>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    skip: {
      backgroundColor: colors.moss2,
      borderRadius: 4,
      minHeight: 48,
      justifyContent: "center",
      paddingHorizontal: 12,
    },
    skipOff: { backgroundColor: colors.moss, borderWidth: 1, borderColor: colors.mossMuted },
    skipText: { color: colors.mossText, fontFamily: fonts.bold, fontSize: 15 },
    skipTextOff: { color: colors.mossMuted },
    card: {
      position: "absolute",
      left: 12,
      right: 12,
      backgroundColor: colors.card,
      borderRadius: 4,
      padding: 16,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.rule,
    },
    title: { color: colors.ink, fontFamily: fonts.bold, fontSize: 20 },
    sub: { color: colors.ink2, fontFamily: fonts.sans, fontSize: 16 },
    row: { flexDirection: "row", gap: 12, marginTop: 4 },
    button: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 52, borderRadius: 4 },
    buttonText: { fontFamily: fonts.bold, fontSize: 18 },
    cancel: { backgroundColor: colors.moss2 },
    confirm: { backgroundColor: colors.rust },
    undo: {
      position: "absolute",
      left: 12,
      right: 12,
      backgroundColor: colors.ink,
      borderRadius: 4,
      paddingLeft: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    undoText: { flex: 1, color: colors.paper, fontFamily: fonts.sans, fontSize: 15, paddingVertical: 10 },
    undoButton: {
      minHeight: 52,
      minWidth: 80,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.signal,
      borderTopRightRadius: 4,
      borderBottomRightRadius: 4,
    },
    undoButtonText: { color: colors.onSignal, fontFamily: fonts.bold, fontSize: 17 },
  }),
);

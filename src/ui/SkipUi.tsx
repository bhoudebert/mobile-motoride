import { t } from "../core/i18n/index.ts";
import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Sheet } from "./RideControlUi.tsx";
import type { SkipState } from "./useRide.ts";
import { colors, fonts, themed } from "./theme.ts";

export const CONFIRM_TIMEOUT_MS = 10_000;
export const UNDO_TIMEOUT_MS = 7_500;

/**
 * The side of the skip square (dp), also the least height of a banner, so the two stand side by side as one row; and the width a
 * banner gives up for it. Large enough to be hit with a glove on a moving bike, and to read at a glance.
 */
export const SKIP_SQUARE = 92;
export const SKIP_GAP = 8;

/**
 * At the top, in the row of the banners, at the right: the point that can be skipped. Always available, at any speed (spec
 * live-corrections): the rider who finds the road blocked is riding. The banners leave room for it. For 7.5 seconds after a skip
 * it is the UNDO: yellow at first, it fades to the green of SKIP STEP, which it then is again.
 */
export function SkipSquare({ skip, top, onPress }: { skip: SkipState; top: number; onPress: () => void }) {
  const last = skip.last;
  const fade = useRef(new Animated.Value(0)).current;
  const forget = useRef(skip.forgetLast);
  forget.current = skip.forgetLast;
  // Keyed on the skip itself, so the screen's own re-renders do not restart the 7.5 seconds.
  useEffect(() => {
    if (!last) return;
    fade.setValue(0);
    const run = Animated.timing(fade, { toValue: 1, duration: UNDO_TIMEOUT_MS, useNativeDriver: false });
    run.start();
    const timer = setTimeout(() => forget.current(), UNDO_TIMEOUT_MS);
    return () => {
      run.stop();
      clearTimeout(timer);
    };
  }, [last, fade]);
  if (!skip.plan && !last) return null;
  const undoing = last !== null;
  const name = skip.plan?.skipped.name ?? "";
  const background = fade.interpolate({ inputRange: [0, 1], outputRange: [colors.signal, colors.moss] });
  const ink = fade.interpolate({ inputRange: [0, 1], outputRange: [colors.onSignal, colors.mossText] });
  return (
    <Pressable
      onPress={undoing ? skip.undo : skip.canSkip ? onPress : undefined}
      accessibilityRole="button"
      accessibilityLabel={undoing ? t("ride.skip.undoA11y") : t("ride.skip.button", { name })}
      accessibilityState={{ disabled: !undoing && !skip.canSkip }}
      style={[styles.skipPress, { top }]}
    >
      <Animated.View style={[styles.skip, undoing ? { backgroundColor: background } : null]}>
        <Animated.Text
          style={[styles.skipText, undoing ? { color: ink, textTransform: "uppercase" } : null]}
          numberOfLines={4}
          adjustsFontSizeToFit
          minimumFontScale={0.4}
        >
          {undoing ? t("ride.skip.undo") : skip.busy ? t("ride.skip.busy") : t("ride.skip.label")}
        </Animated.Text>
      </Animated.View>
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

const styles = themed(() =>
  StyleSheet.create({
    skipPress: { position: "absolute", right: 12, width: SKIP_SQUARE, height: SKIP_SQUARE, zIndex: 5 },
    skip: {
      flex: 1,
      backgroundColor: colors.moss,
      borderRadius: 4,
      alignItems: "center",
      justifyContent: "center",
      padding: 6,
    },
    skipText: { color: colors.mossText, fontFamily: fonts.bold, fontSize: 26, textAlign: "center" },
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
  }),
);

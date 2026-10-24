import { t } from "../core/i18n/index.ts";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { formatDistance } from "../core/format.ts";
import type { JoinOptions, StartChoice } from "../core/skip.ts";
import { colors, fonts, themed } from "./theme.ts";

/**
 * A card over the ride screen. It sits above everything (the bottom panel included), is never taller than the screen,
 * scrolls its content, and keeps its buttons (`footer`) pinned where they can always be reached. A scrim keeps touches
 * off the map underneath.
 */
export function Sheet({
  top,
  children,
  footer,
  bottomGap = 24,
}: {
  top: number;
  children: ReactNode;
  footer?: ReactNode;
  /** Room left under the card, for a long one that must not cover the buttons of the panel (the phone's tree still holds them). */
  bottomGap?: number;
}) {
  const { height } = useWindowDimensions();
  const maxHeight = Math.max(240, height - top - bottomGap);
  return (
    <View style={styles.scrim}>
      <View style={[styles.sheet, { top, maxHeight }]} accessibilityLiveRegion="polite" testID="sheet">
        <ScrollView testID="sheet-scroll" style={styles.sheetScroll} contentContainerStyle={styles.sheetBody}>
          {children}
        </ScrollView>
        {footer ? (
          <View testID="sheet-footer" style={styles.sheetFooter}>
            {footer}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** The question before a ride is ended: one stray tap must not lose a four-hour ride (spec ride-control). */
export function EndConfirm({
  roadbookName,
  leaving,
  onKeep,
  onEnd,
  top,
}: {
  roadbookName: string;
  /** The rider pressed Back, not End. */
  leaving: boolean;
  onKeep: () => void;
  onEnd: () => void;
  top: number;
}) {
  return (
    <Sheet
      top={top}
      footer={
        <View style={styles.row}>
          <Pressable style={[styles.button, styles.keep]} onPress={onKeep} accessibilityRole="button">
            <Text style={[styles.buttonText, { color: colors.mossText }]}>{t("ride.end.keep")}</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.end]} onPress={onEnd} accessibilityRole="button">
            <Text style={[styles.buttonText, { color: colors.onRust }]}>{t("ride.end.end")}</Text>
          </Pressable>
        </View>
      }
    >
      <Text style={styles.title}>{leaving ? t("ride.end.leave") : t("ride.end.title")}</Text>
      <Text style={styles.sub}>{t("ride.end.sub", { name: roadbookName })}</Text>
    </Sheet>
  );
}

/** What going to the nearest next point skips, short enough to read at a glance. */
export function skipsText(skipped: string[]): string {
  if (skipped.length === 0) return "";
  if (skipped.length <= 3) return t("ride.skips.some", { list: skipped.join(", ") });
  return t("ride.skips.more", { list: skipped.slice(0, 2).join(", "), count: skipped.length - 2 });
}

/**
 * Away from the roadbook, before the ride: where to join it. The nearest next point is the answer already chosen, one
 * tap away; the start, any other point, or no ride are the alternatives (spec ride-control, ADR 0016).
 */
export function JoinCard({
  options,
  onGo,
  onMore,
  onCancel,
  top,
}: {
  options: JoinOptions;
  onGo: (point: StartChoice | null) => void;
  onMore: () => void;
  onCancel: () => void;
  top: number;
}) {
  const { nearest, first, skipped } = options;
  const nearestIsStart = nearest.atM <= 1;
  return (
    <Sheet
      top={top}
      footer={
        <Pressable style={styles.cancelLink} onPress={onCancel} accessibilityRole="button">
          <Text style={styles.cancelLinkText}>{t("ride.btn.cancel")}</Text>
        </Pressable>
      }
    >
      <Text style={styles.title}>{t("ride.join.title")}</Text>
      <Text style={styles.sub}>{t("ride.join.sub")}</Text>
      {nearestIsStart ? null : (
        <Pressable
          style={[styles.choice, styles.choicePrimary]}
          onPress={() => onGo(nearest)}
          accessibilityRole="button"
          accessibilityLabel={t("ride.join.goToA11y", {
            name: nearest.name,
            distance: formatDistance(nearest.distanceM),
            skips: skipsText(skipped),
          })}
        >
          <Text style={styles.choiceTitle} numberOfLines={1}>
            {t("ride.join.goTo", { name: nearest.name })}
          </Text>
          <Text style={styles.choiceDetail} numberOfLines={2}>
            {t("ride.join.away", { distance: formatDistance(nearest.distanceM), skips: skipsText(skipped) })}
          </Text>
        </Pressable>
      )}
      <Pressable
        style={[styles.choice, nearestIsStart ? styles.choicePrimary : styles.choiceOther]}
        onPress={() => onGo(null)}
        accessibilityRole="button"
        accessibilityLabel={t("ride.join.goStartA11y", { name: first.name, distance: formatDistance(first.distanceM) })}
      >
        <Text style={nearestIsStart ? styles.choiceTitle : styles.choiceTitleLight} numberOfLines={1}>
          {t("ride.join.goStart")}
        </Text>
        <Text style={nearestIsStart ? styles.choiceDetail : styles.choiceDetailLight} numberOfLines={1}>
          {t("ride.join.startDetail", { name: first.name, distance: formatDistance(first.distanceM) })}
        </Text>
      </Pressable>
      <Pressable style={[styles.choice, styles.choiceOther]} onPress={onMore} accessibilityRole="button">
        <Text style={styles.choiceTitleLight}>{t("ride.join.another")}</Text>
      </Pressable>
    </Sheet>
  );
}

/** Every mark on the map, drawn as it is on the map and said in plain words. */
export function LegendCard({ onClose, top }: { onClose: () => void; top: number }) {
  return (
    <Sheet
      top={top}
      footer={
        <Pressable style={[styles.button, styles.keep]} onPress={onClose} accessibilityRole="button">
          <Text style={[styles.buttonText, { color: colors.mossText }]}>{t("ride.btn.close")}</Text>
        </Pressable>
      }
    >
      <Text style={styles.title}>{t("ride.legend.title")}</Text>
      <LegendRow
        swatch={<View style={styles.swLine} />}
        title={t("ride.legend.route")}
        detail={t("ride.legend.routeDetail")}
      />
      <LegendRow
        swatch={<View style={styles.swDashed} />}
        title={t("ride.legend.approach")}
        detail={t("ride.legend.approachDetail")}
      />
      <LegendRow
        swatch={<View style={styles.swPoint} />}
        title={t("ride.legend.point")}
        detail={t("ride.legend.pointDetail")}
      />
      <LegendRow
        swatch={<View style={styles.swStop} />}
        title={t("ride.legend.stop")}
        detail={t("ride.legend.stopDetail")}
      />
      <LegendRow
        swatch={<View style={[styles.swCorner, { backgroundColor: colors.rust }]} />}
        title={t("ride.legend.hairpin")}
        detail={t("ride.legend.hairpinDetail")}
      />
      <LegendRow
        swatch={<View style={[styles.swCorner, { backgroundColor: colors.signal }]} />}
        title={t("ride.legend.sharp")}
        detail={t("ride.legend.sharpDetail")}
      />
      <LegendRow
        swatch={<Text style={styles.swRider}>▲</Text>}
        title={t("ride.legend.you")}
        detail={t("ride.legend.youDetail")}
      />
      <Text style={styles.sub}>{t("ride.legend.zoom")}</Text>
    </Sheet>
  );
}

function LegendRow({ swatch, title, detail }: { swatch: ReactNode; title: string; detail: string }) {
  return (
    <View style={styles.legendRow} accessible accessibilityLabel={`${title}. ${detail}`}>
      <View style={styles.swatch}>{swatch}</View>
      <View style={styles.legendTexts}>
        <Text style={styles.legendTitle}>{title}</Text>
        <Text style={styles.legendDetail}>{detail}</Text>
      </View>
    </View>
  );
}

/** The route points of the roadbook, to go to; everything before the one chosen is dropped. */
export function StartFromList({
  choices,
  current,
  onPick,
  onClose,
  top,
}: {
  choices: StartChoice[];
  current: StartChoice;
  onPick: (c: StartChoice) => void;
  onClose: () => void;
  top: number;
}) {
  return (
    <Sheet
      top={top}
      footer={
        <Pressable style={[styles.button, styles.keep]} onPress={onClose} accessibilityRole="button">
          <Text style={[styles.buttonText, { color: colors.mossText }]}>{t("ride.btn.cancel")}</Text>
        </Pressable>
      }
    >
      <Text style={styles.title}>{t("ride.startFrom.title")}</Text>
      <Text style={styles.sub}>{t("ride.startFrom.sub")}</Text>
      {choices.map((c, i) => (
        <Pressable
          key={`${i}-${c.atM}`}
          style={[styles.row2, c.atM === current.atM && styles.row2Current]}
          onPress={() => onPick(c)}
          accessibilityRole="button"
          accessibilityLabel={t("ride.startFrom.a11y", { name: c.name, distance: formatDistance(c.atM) })}
        >
          <Text style={styles.row2Name} numberOfLines={1}>
            {c.atM === current.atM ? "✓ " : ""}
            {c.name}
          </Text>
          <Text style={styles.row2Km}>{formatDistance(c.atM)}</Text>
        </Pressable>
      ))}
    </Sheet>
  );
}

const styles = themed(() =>
  StyleSheet.create({
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
    keep: { backgroundColor: colors.moss2 },
    end: { backgroundColor: colors.rust },
    // Five whole rows: a scrolling list cut in the middle of a row is half a button.
    list: { maxHeight: 5 * 48 },
    row2: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.rule,
    },
    row2Current: { backgroundColor: colors.paper2 },
    row2Name: { flex: 1, color: colors.ink, fontFamily: fonts.sans, fontSize: 16 },
    row2Km: { color: colors.ink2, fontFamily: fonts.mono, fontSize: 13 },
    choice: {
      borderRadius: 4,
      minHeight: 56,
      justifyContent: "center",
      paddingHorizontal: 14,
      paddingVertical: 8,
      gap: 2,
    },
    choicePrimary: { backgroundColor: colors.signal },
    choiceOther: { backgroundColor: colors.moss2 },
    choiceTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 18 },
    choiceDetail: { color: colors.ink, fontFamily: fonts.sans, fontSize: 14 },
    choiceTitleLight: { color: colors.mossText, fontFamily: fonts.bold, fontSize: 17 },
    choiceDetailLight: { color: colors.mossText, fontFamily: fonts.sans, fontSize: 14 },
    cancelLink: { minHeight: 48, alignItems: "center", justifyContent: "center" },
    cancelLinkText: { color: colors.ink2, fontFamily: fonts.bold, fontSize: 16 },
    legendRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
    swatch: { width: 44, alignItems: "center", justifyContent: "center" },
    legendTexts: { flex: 1 },
    legendTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 15 },
    legendDetail: { color: colors.ink2, fontFamily: fonts.sans, fontSize: 13 },
    swLine: {
      width: 40,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.moss2,
      borderWidth: 2,
      borderColor: colors.paper,
    },
    swDashed: {
      width: 40,
      height: 5,
      borderRadius: 2,
      borderWidth: 2,
      borderColor: colors.rust,
      borderStyle: "dashed",
    },
    swPoint: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.moss,
      borderWidth: 3,
      borderColor: colors.paper,
    },
    swStop: {
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.paper,
      borderWidth: 3,
      borderColor: colors.moss,
    },
    swCorner: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: colors.ink },
    swRider: { color: colors.signal, fontSize: 22, textShadowColor: colors.onSignal, textShadowRadius: 2 },
    scrim: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(28, 29, 26, 0.45)" },
    sheet: {
      position: "absolute",
      left: 12,
      right: 12,
      backgroundColor: colors.card,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.rule,
      overflow: "hidden",
    },
    sheetScroll: { flexGrow: 0, flexShrink: 1 },
    sheetBody: { padding: 16, gap: 8 },
    sheetFooter: { padding: 12, borderTopWidth: 1, borderTopColor: colors.rule, backgroundColor: colors.card },
  }),
);

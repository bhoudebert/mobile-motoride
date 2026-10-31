import { TOP_INSET } from "./insets.ts";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useState } from "react";
import { BackHandler, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { formatDistance } from "../core/format.ts";
import { formatDateTime, t } from "../core/i18n/index.ts";
import { durationText, RIDE_STATE_LABEL, rideExtras, type RideMeta } from "../core/recording.ts";
import { deleteRide, gpxUri, listRides } from "./ridesStore.ts";
import { BackButton } from "./BackButton.tsx";
import { colors, fonts, radii, themed } from "./theme.ts";

const dateText = (ms: number) =>
  formatDateTime(ms, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** The rides the phone has recorded: share the GPX, or delete (spec ride-recording). */
export function RidesScreen({ onBack, onReview }: { onBack: () => void; onReview?: (ride: RideMeta) => void }) {
  const [rides, setRides] = useState<RideMeta[] | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(() => {
    listRides().then(setRides);
  }, []);
  useEffect(reload, [reload]);
  // Pull down from the top to read the rides again (spec home-screen, "Pull to refresh").
  const refresh = useCallback(() => {
    setRefreshing(true);
    void listRides()
      .then(setRides)
      .finally(() => setRefreshing(false));
  }, []);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const share = async (ride: RideMeta) => {
    setProblem(null);
    try {
      if (!(await Sharing.isAvailableAsync())) return setProblem(t("home.rides.cannotShare"));
      await Sharing.shareAsync(gpxUri(ride.id), {
        mimeType: "application/gpx+xml",
        dialogTitle: t("home.rides.shareTitle", { name: ride.roadbookName }),
        UTI: "com.topografix.gpx",
      });
    } catch {
      setProblem(t("home.rides.shareFailed"));
    }
  };

  return (
    <View style={styles.screen}>
      <BackButton onPress={onBack} label={t("home.back.map")} style={styles.back} />
      <Text style={styles.title}>{t("home.rides.title")}</Text>
      {problem ? (
        <Text style={styles.problem} accessibilityRole="alert">
          {problem}
        </Text>
      ) : null}
      {rides && rides.length === 0 ? <Text style={styles.empty}>{t("home.rides.empty")}</Text> : null}
      <FlatList
        data={rides ?? []}
        keyExtractor={(r) => r.id}
        contentContainerStyle={styles.list}
        testID="rides-list"
        refreshing={refreshing}
        onRefresh={refresh}
        renderItem={({ item: r }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{r.roadbookName}</Text>
            <Text style={styles.meta}>
              {dateText(r.startedAt)} · {formatDistance(r.distanceM)} · {durationText(r.endedAt - r.startedAt)}
            </Text>
            {rideExtras(r) ? <Text style={styles.meta}>{rideExtras(r)}</Text> : null}
            <Text style={[styles.state, r.state === "completed" && styles.done]}>{RIDE_STATE_LABEL[r.state]}</Text>
            {confirming === r.id ? (
              <View style={styles.actions}>
                <Text style={styles.confirmText}>{t("home.rides.confirmDelete")}</Text>
                <Pressable
                  style={styles.action}
                  onPress={async () => {
                    setConfirming(null);
                    await deleteRide(r.id);
                    reload();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t("home.rides.deleteRide", { name: r.roadbookName })}
                >
                  <Text style={styles.danger}>{t("home.rides.delete")}</Text>
                </Pressable>
                <Pressable
                  style={styles.action}
                  onPress={() => setConfirming(null)}
                  accessibilityRole="button"
                  accessibilityLabel={t("home.rides.keepIt")}
                >
                  <Text style={styles.link}>{t("home.rides.keep")}</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.actions}>
                {onReview ? (
                  <Pressable
                    style={styles.action}
                    onPress={() => onReview(r)}
                    accessibilityRole="button"
                    accessibilityLabel={t("home.rides.reviewRide", { name: r.roadbookName })}
                  >
                    <Text style={styles.link}>{t("home.rides.review")}</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  style={styles.action}
                  onPress={() => share(r)}
                  accessibilityRole="button"
                  accessibilityLabel={t("home.rides.shareRide", { name: r.roadbookName })}
                >
                  <Text style={styles.link}>{t("home.rides.share")}</Text>
                </Pressable>
                <Pressable
                  style={styles.action}
                  onPress={() => setConfirming(r.id)}
                  accessibilityRole="button"
                  accessibilityLabel={t("home.rides.deleteAsk", { name: r.roadbookName })}
                >
                  <Text style={styles.danger}>{t("home.rides.deleteLink")}</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.paper, paddingTop: TOP_INSET + 8 },
    back: { minHeight: 48, minWidth: 48, paddingHorizontal: 16, justifyContent: "center", alignSelf: "flex-start" },
    title: { color: colors.accent, fontFamily: fonts.bold, fontSize: 30, paddingHorizontal: 16, paddingBottom: 12 },
    empty: { color: colors.ink2, fontFamily: fonts.sans, fontSize: 15, paddingHorizontal: 16 },
    problem: { color: colors.rustText, fontFamily: fonts.sans, fontSize: 14, paddingHorizontal: 16, paddingBottom: 8 },
    list: { paddingHorizontal: 16, gap: 12, paddingBottom: 24 },
    card: {
      backgroundColor: colors.card,
      borderRadius: radii.card,
      borderWidth: 1,
      borderColor: colors.rule,
      padding: 16,
      gap: 4,
    },
    name: { color: colors.ink, fontFamily: fonts.bold, fontSize: 18 },
    meta: { color: colors.rustText, fontFamily: fonts.mono, fontSize: 12 },
    state: { color: colors.ink2, fontFamily: fonts.sans, fontSize: 13 },
    done: { color: colors.accent },
    actions: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4, marginTop: 4 },
    confirmText: { flex: 1, color: colors.ink2, fontFamily: fonts.sans, fontSize: 14 },
    action: { minHeight: 48, minWidth: 64, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
    link: { color: colors.accent, fontFamily: fonts.bold, fontSize: 15 },
    danger: { color: colors.limitRed, fontFamily: fonts.bold, fontSize: 15 },
  }),
);

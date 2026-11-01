import { TOP_INSET } from "./insets.ts";
import * as Sharing from "expo-sharing";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, BackHandler, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { formatDistance } from "../core/format.ts";
import { formatDateTime, t } from "../core/i18n/index.ts";
import { durationText, RIDE_STATE_LABEL, rideExtras, type RideMeta } from "../core/recording.ts";
import type { ServerSetting } from "../core/liveShare.ts";
import { mergeRides, type RideRow } from "../core/serverRides.ts";
import { fetchServerRide, removeServerRide } from "../services/serverRides.ts";
import type { ServerProblem } from "../services/serverRoadbooks.ts";
import { deleteRide, gpxUri, listRides, saveDownloaded } from "./ridesStore.ts";
import { useServerRides } from "./useServerRides.ts";
import { libraryKeyOf } from "./libraryIdentity.ts";
import { useRideUpload } from "./useRideUpload.ts";
import { BackButton } from "./BackButton.tsx";
import { Icon, type IconName } from "./Icon.tsx";
import { colors, fonts, radii, themed } from "./theme.ts";

const ICON = 24;

/** An action of a ride as one icon in a 48 dp target: it says what it does to a screen reader, and shows when it is pressed. */
function RideAction({
  icon,
  label,
  onPress,
  color = colors.accent,
  disabled = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.iconButton, pressed && styles.iconPressed, disabled && styles.iconDisabled]}
    >
      <Icon name={icon} color={color} size={ICON} />
    </Pressable>
  );
}

const dateText = (ms: number) =>
  formatDateTime(ms, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

type Asking = { id: string; kind: "phone" | "server" };

/** The rides of the phone and of the rider's server, once each (spec ride-recording): share, send, save, review or delete. */
export function RidesScreen({
  onBack,
  onReview,
  server = null,
}: {
  onBack: () => void;
  onReview?: (ride: RideMeta) => void;
  /** The rider's server, when there is one: a ride can then be sent to it, and the rides it keeps are listed too. */
  server?: ServerSetting | null;
}) {
  const [rides, setRides] = useState<RideMeta[] | null>(null);
  const [confirming, setConfirming] = useState<Asking | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const { uploading, upload } = useRideUpload(server);
  const { serverRides, refreshServer } = useServerRides(server);
  const rows = useMemo(() => mergeRides(rides ?? [], serverRides), [rides, serverRides]);

  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(() => {
    listRides().then(setRides);
  }, []);
  useEffect(reload, [reload]);
  // Pull down from the top to read the rides again, those of the server too (spec home-screen, "Pull to refresh").
  const refresh = useCallback(() => {
    setRefreshing(true);
    void Promise.all([listRides().then(setRides), refreshServer()]).finally(() => setRefreshing(false));
  }, [refreshServer]);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const said = (reason: ServerProblem) => t(`home.rides.problem.${reason}`);

  const send = async (ride: RideMeta) => {
    setProblem(null);
    const result = await upload(ride.id);
    if (!result.ok) return setProblem(t(`home.rides.uploadProblem.${result.reason}`));
    reload();
    await refreshServer();
  };

  /** Bring a ride of the server onto the phone, as the file it holds; null when it could not be done. */
  const save = async (row: RideRow): Promise<RideMeta | null> => {
    if (!server || !row.server) return null;
    setProblem(null);
    setSaving(row.id);
    try {
      const got = await fetchServerRide(server, row.id);
      if (!got.ok) {
        setProblem(said(got.reason));
        return null;
      }
      const meta = await saveDownloaded(row.id, got.gpx, row.server.uploadedAt, await libraryKeyOf(server));
      if (!meta) {
        setProblem(t("home.rides.problem.unreadable"));
        return null;
      }
      reload();
      return meta;
    } finally {
      setSaving(null);
    }
  };

  const removeFromServer = async (row: RideRow) => {
    if (!server) return;
    setProblem(null);
    const answer = await removeServerRide(server, row.id);
    if (!answer.ok) return setProblem(said(answer.reason));
    await refreshServer();
  };

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
      {rides && rows.length === 0 ? <Text style={styles.empty}>{t("home.rides.empty")}</Text> : null}
      <FlatList
        data={rows}
        keyExtractor={(row) => row.id}
        contentContainerStyle={styles.list}
        testID="rides-list"
        refreshing={refreshing}
        onRefresh={refresh}
        renderItem={({ item: row }) => {
          const r = row.ride;
          const local = row.local;
          const asked = confirming?.id === row.id ? confirming.kind : null;
          const onServerAt = row.server?.uploadedAt ?? local?.uploadedAt;
          return (
            <View style={styles.card}>
              <Text style={styles.name}>{r.roadbookName}</Text>
              <Text style={styles.meta}>
                {dateText(r.startedAt)} · {formatDistance(r.distanceM)} · {durationText(r.endedAt - r.startedAt)}
              </Text>
              {rideExtras(r as RideMeta) ? <Text style={styles.meta}>{rideExtras(r as RideMeta)}</Text> : null}
              {r.state ? (
                <Text style={[styles.state, r.state === "completed" && styles.done]}>{RIDE_STATE_LABEL[r.state]}</Text>
              ) : null}
              {row.place === "server" ? (
                <Text style={styles.meta}>{t("home.rides.serverOnly")}</Text>
              ) : row.place === "both" && onServerAt !== undefined ? (
                <Text style={styles.meta}>{t("home.rides.onServer", { date: dateText(onServerAt) })}</Text>
              ) : server ? (
                <Text style={styles.meta}>{t("home.rides.localOnly")}</Text>
              ) : null}
              {asked ? (
                <View style={styles.actions}>
                  <Text style={[styles.confirmText, row.place !== "both" && styles.danger]}>
                    {t(
                      asked === "phone"
                        ? row.place === "both"
                          ? "home.rides.confirmDeleteKept"
                          : "home.rides.confirmDeleteLost"
                        : row.place === "both"
                          ? "home.rides.confirmRemoveKept"
                          : "home.rides.confirmRemoveLost",
                    )}
                  </Text>
                  <Pressable
                    style={styles.action}
                    onPress={async () => {
                      setConfirming(null);
                      if (asked === "phone") {
                        await deleteRide(row.id);
                        reload();
                      } else await removeFromServer(row);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={t(asked === "phone" ? "home.rides.deleteRide" : "home.rides.removeRide", {
                      name: r.roadbookName,
                    })}
                  >
                    <Text style={styles.danger}>
                      {t(asked === "phone" ? "home.rides.delete" : "home.rides.remove")}
                    </Text>
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
                <View style={styles.iconRow}>
                  {/* The everyday actions together, what cannot be undone alone at the far end, out of reach of a slip. */}
                  <View style={styles.iconGroup}>
                    {onReview ? (
                      <RideAction
                        icon="analytics-outline"
                        label={t("home.rides.reviewRide", { name: r.roadbookName })}
                        disabled={saving !== null}
                        // A ride only on the server is brought to the phone to be reviewed.
                        onPress={async () => {
                          const meta = local ?? (await save(row));
                          if (meta) onReview(meta);
                        }}
                      />
                    ) : null}
                    {row.place === "server" ? (
                      saving === row.id ? (
                        <View
                          style={styles.iconButton}
                          accessible
                          accessibilityLabel={t("home.rides.saving")}
                          accessibilityLiveRegion="polite"
                        >
                          <ActivityIndicator color={colors.accent} />
                        </View>
                      ) : (
                        <RideAction
                          icon="download-outline"
                          label={t("home.rides.saveRide", { name: r.roadbookName })}
                          disabled={saving !== null}
                          onPress={() => void save(row)}
                        />
                      )
                    ) : row.place === "both" ? (
                      // On the server too: a status, not an action. The slot keeps its place so the others do not move.
                      <View
                        style={styles.iconButton}
                        accessible
                        accessibilityRole="image"
                        accessibilityLabel={t("home.rides.onServer", { date: dateText(onServerAt ?? r.startedAt) })}
                      >
                        <Icon name="cloud-done-outline" color={colors.accent} size={ICON} />
                      </View>
                    ) : uploading === row.id ? (
                      <View
                        style={styles.iconButton}
                        accessible
                        accessibilityLabel={t("home.rides.uploading")}
                        accessibilityLiveRegion="polite"
                      >
                        <ActivityIndicator color={colors.accent} />
                      </View>
                    ) : server && local ? (
                      <RideAction
                        icon="cloud-upload-outline"
                        label={t("home.rides.uploadRide", { name: r.roadbookName })}
                        disabled={uploading !== null}
                        onPress={() => send(local)}
                      />
                    ) : null}
                    {local ? (
                      <RideAction
                        icon="share-outline"
                        label={t("home.rides.shareRide", { name: r.roadbookName })}
                        onPress={() => share(local)}
                      />
                    ) : null}
                  </View>
                  <View style={styles.iconGroup}>
                    {server && row.place !== "phone" ? (
                      <RideAction
                        icon="cloud-offline-outline"
                        color={colors.rustText}
                        label={t("home.rides.removeAsk", { name: r.roadbookName })}
                        onPress={() => setConfirming({ id: row.id, kind: "server" })}
                      />
                    ) : null}
                    {local ? (
                      <RideAction
                        icon="trash-outline"
                        color={colors.rustText}
                        label={t("home.rides.deleteAsk", { name: r.roadbookName })}
                        onPress={() => setConfirming({ id: row.id, kind: "phone" })}
                      />
                    ) : null}
                  </View>
                </View>
              )}
            </View>
          );
        }}
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
    iconRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
    iconGroup: { flexDirection: "row", alignItems: "center", gap: 8 },
    iconButton: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
    // The press shows as a disc behind the icon; nothing moves.
    iconPressed: { backgroundColor: colors.rule },
    iconDisabled: { opacity: 0.38 },
    action: { minHeight: 48, minWidth: 64, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
    link: { color: colors.accent, fontFamily: fonts.bold, fontSize: 15 },
    danger: { color: colors.limitRed, fontFamily: fonts.bold, fontSize: 15 },
  }),
);

import { TOP_INSET } from "./insets.ts";
import { useEffect, useState } from "react";
import { ActivityIndicator, BackHandler, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { formatDistance } from "../core/format.ts";
import { t } from "../core/i18n/index.ts";
import type { PreparedRoadbook } from "../core/types.ts";
import { serverAction, type ServerRoadbook } from "../core/serverRoadbooks.ts";
import type { ImportedRoadbook } from "../core/library.ts";
import { BackButton } from "./BackButton.tsx";
import { Icon } from "./Icon.tsx";
import type { ServerList } from "./useServerRoadbooks.ts";
import { RouteThumb } from "./RouteThumb.tsx";
import { colors, fonts, radii, themed } from "./theme.ts";

export function RoadbookList({
  roadbooks,
  onOpen,
  onBack,
  imported,
  onImport,
  onDelete,
  pending,
  onComplete,
  server,
}: {
  roadbooks: PreparedRoadbook[];
  onOpen: (rb: PreparedRoadbook) => void;
  /** The ids of the roadbooks the rider brought in: marked, and the only ones that can be deleted. */
  imported?: ReadonlySet<string>;
  onImport?: () => void;
  onDelete?: (id: string) => void;
  /** Imported roadbooks still lacking speed limits and cameras, and the way to try again. */
  pending?: ReadonlySet<string>;
  onComplete?: (id: string) => void;
  /** The roadbooks of the rider's server, with what is kept to compare them with; absent with no server. */
  server?: {
    list: ServerList | null;
    kept: readonly ImportedRoadbook[];
    /** The server number being fetched. */
    fetching: number | null;
    onGet: (entry: ServerRoadbook) => void;
    onRetry: () => void;
  };
  /** Back to the home screen, with the phone's Back button too. */
  onBack?: () => void;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  useEffect(() => {
    if (!onBack) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);
  return (
    <View style={styles.screen}>
      {onBack ? <BackButton onPress={onBack} label={t("home.back.map")} style={styles.back} /> : null}
      <Text style={styles.title}>{t("home.roadbooks")}</Text>
      <Text style={styles.subtitle}>{t("home.list.subtitle")}</Text>
      {onImport ? (
        <Pressable
          style={styles.import}
          onPress={onImport}
          accessibilityRole="button"
          accessibilityLabel={t("home.list.import")}
        >
          <Text style={styles.importText}>{t("home.list.import")}</Text>
        </Pressable>
      ) : null}
      <FlatList
        data={roadbooks}
        keyExtractor={(rb) => rb.roadbook.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={server ? <ServerSection {...server} /> : undefined}
        renderItem={({ item: rb }) => {
          const danger = rb.corners.filter((c) => c.severity !== "bend").length;
          return (
            <View>
              <Pressable style={styles.card} onPress={() => onOpen(rb)} accessibilityRole="button">
                <RouteThumb line={rb.roadbook.line} />
                {imported?.has(rb.roadbook.id) ? <Text style={styles.tag}>{t("home.list.imported")}</Text> : null}
                <Text style={styles.name}>{rb.roadbook.name}</Text>
                <Text style={styles.meta}>
                  {formatDistance(rb.totalM)} · {t(rb.loop ? "home.list.loop" : "home.list.oneway")} ·{" "}
                  {t("home.list.stops", { count: Math.max(0, rb.stops.length - 2) })} ·{" "}
                  {t("home.list.corners", { count: danger })}
                </Text>
                {rb.roadbook.description ? <Text style={styles.desc}>{rb.roadbook.description}</Text> : null}
              </Pressable>
              {pending?.has(rb.roadbook.id) && onComplete ? (
                <Pressable
                  style={styles.complete}
                  onPress={() => onComplete(rb.roadbook.id)}
                  accessibilityRole="button"
                  accessibilityLabel={t("home.list.completeFor", { name: rb.roadbook.name })}
                >
                  <Text style={styles.completeText}>{t("home.list.complete")}</Text>
                </Pressable>
              ) : null}
              {imported?.has(rb.roadbook.id) && onDelete ? (
                confirming === rb.roadbook.id ? (
                  <View style={styles.confirm}>
                    <Text style={styles.confirmText}>{t("home.list.confirmDelete")}</Text>
                    <Pressable
                      style={styles.confirmButton}
                      onPress={() => {
                        setConfirming(null);
                        onDelete(rb.roadbook.id);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t("home.list.deleteNamed", { name: rb.roadbook.name })}
                    >
                      <Text style={styles.danger}>{t("home.list.delete")}</Text>
                    </Pressable>
                    <Pressable
                      style={styles.confirmButton}
                      onPress={() => setConfirming(null)}
                      accessibilityRole="button"
                      accessibilityLabel={t("home.list.keepIt")}
                    >
                      <Text style={styles.keep}>{t("home.list.keep")}</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    style={styles.deleteLink}
                    onPress={() => setConfirming(rb.roadbook.id)}
                    accessibilityRole="button"
                    accessibilityLabel={t("home.list.deleteAsk", { name: rb.roadbook.name })}
                  >
                    <Text style={styles.deleteText}>{t("home.list.deleteLink")}</Text>
                  </Pressable>
                )
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}

/** What the server holds, one row each with its one action; nothing for a server that does not offer roadbooks. */
function ServerSection({
  list,
  kept,
  fetching,
  onGet,
  onRetry,
}: NonNullable<Parameters<typeof RoadbookList>[0]["server"]>) {
  if (!list || (list.status === "problem" && list.reason === "unsupported")) return null;
  return (
    <View style={styles.server}>
      <Text style={styles.serverTitle}>{t("home.server.title")}</Text>
      {list.status === "checking" ? <Text style={styles.serverNote}>{t("home.server.checking")}</Text> : null}
      {list.status === "unreachable" || list.status === "problem" ? (
        <View style={styles.serverRow}>
          <Text style={[styles.serverNote, styles.serverGrow]}>
            {list.status === "unreachable" ? t("home.server.unreachable") : t(`home.server.problem.${list.reason}`)}
          </Text>
          <Pressable
            style={styles.serverAction}
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel={t("home.server.retry")}
          >
            <Text style={styles.completeText}>{t("home.server.retry")}</Text>
          </Pressable>
        </View>
      ) : null}
      {list.status === "ready" && list.items.length === 0 ? (
        <Text style={styles.serverNote}>{t("home.server.empty")}</Text>
      ) : null}
      {list.status === "ready"
        ? list.items.map((entry) => {
            const action = serverAction(entry, kept);
            return (
              <View key={entry.id} style={styles.serverRow}>
                <View style={styles.serverGrow}>
                  <Text style={styles.serverName}>{entry.name}</Text>
                  <Text style={styles.meta}>
                    {t("home.server.meta", { km: entry.distanceKm.toFixed(1), minutes: entry.ridingMinutes })}
                  </Text>
                </View>
                {fetching === entry.id ? (
                  <View
                    accessibilityLabel={t("home.server.fetching", { name: entry.name })}
                    style={styles.serverAction}
                  >
                    <ActivityIndicator color={colors.accent} />
                  </View>
                ) : action === "current" ? (
                  <View
                    style={styles.serverAction}
                    accessible
                    accessibilityLabel={`${entry.name}: ${t("home.server.current")}`}
                  >
                    <Icon name="checkmark" color={colors.ink2} />
                  </View>
                ) : (
                  <Pressable
                    style={styles.serverAction}
                    disabled={fetching !== null}
                    onPress={() => onGet(entry)}
                    accessibilityRole="button"
                    accessibilityLabel={t(action === "refresh" ? "home.server.refresh" : "home.server.download", {
                      name: entry.name,
                    })}
                  >
                    <Icon name={action === "refresh" ? "refresh" : "download-outline"} />
                  </Pressable>
                )}
              </View>
            );
          })
        : null}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.paper, paddingTop: TOP_INSET + 8 },
    title: { color: colors.accent, fontFamily: fonts.bold, fontSize: 30, paddingHorizontal: 16, paddingBottom: 4 },
    subtitle: { color: colors.ink2, fontFamily: fonts.sans, fontSize: 14, paddingHorizontal: 16, paddingBottom: 12 },
    back: { minHeight: 48, minWidth: 48, paddingHorizontal: 16, justifyContent: "center", alignSelf: "flex-start" },
    import: {
      minHeight: 48,
      marginHorizontal: 16,
      marginBottom: 12,
      borderRadius: radii.pill,
      backgroundColor: colors.moss,
      alignItems: "center",
      justifyContent: "center",
    },
    importText: { color: colors.mossText, fontFamily: fonts.bold, fontSize: 16 },
    tag: { color: colors.accent, fontFamily: fonts.mono, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 },
    complete: { minHeight: 48, justifyContent: "center", paddingHorizontal: 12 },
    completeText: { color: colors.accent, fontFamily: fonts.bold, fontSize: 14 },
    deleteLink: { minHeight: 48, alignSelf: "flex-end", justifyContent: "center", paddingHorizontal: 12 },
    deleteText: { color: colors.rustText, fontFamily: fonts.bold, fontSize: 14 },
    confirm: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4 },
    confirmText: { flex: 1, color: colors.ink2, fontFamily: fonts.sans, fontSize: 14, paddingLeft: 12 },
    confirmButton: {
      minHeight: 48,
      minWidth: 56,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8,
    },
    danger: { color: colors.limitRed, fontFamily: fonts.bold, fontSize: 15 },
    keep: { color: colors.accent, fontFamily: fonts.bold, fontSize: 15 },
    server: { gap: 4, paddingBottom: 12 },
    serverTitle: {
      color: colors.accent,
      fontFamily: fonts.mono,
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    serverNote: { color: colors.ink2, fontFamily: fonts.sans, fontSize: 14 },
    serverRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: radii.card,
      borderWidth: 1,
      borderColor: colors.rule,
      paddingLeft: 16,
      paddingVertical: 4,
    },
    serverGrow: { flex: 1 },
    serverName: { color: colors.ink, fontFamily: fonts.bold, fontSize: 16 },
    serverAction: { minHeight: 48, minWidth: 56, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
    list: { paddingHorizontal: 16, gap: 12, paddingBottom: 24 },
    card: {
      backgroundColor: colors.card,
      borderRadius: radii.card,
      borderWidth: 1,
      borderColor: colors.rule,
      padding: 16,
      gap: 6,
      overflow: "hidden",
    },
    name: { color: colors.ink, fontFamily: fonts.bold, fontSize: 18 },
    meta: { color: colors.rustText, fontFamily: fonts.mono, fontSize: 12 },
    desc: { color: colors.ink2, fontFamily: fonts.sans, fontSize: 13 },
  }),
);

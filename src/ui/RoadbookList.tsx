import { TOP_INSET } from "./insets.ts";
import { useEffect, useState } from "react";
import { ActivityIndicator, BackHandler, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { formatDistance } from "../core/format.ts";
import { t } from "../core/i18n/index.ts";
import type { PreparedRoadbook } from "../core/types.ts";
import { keptFor, serverAction, type ServerAction, type ServerRoadbook } from "../core/serverRoadbooks.ts";
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
  fromServer,
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
  /** The ids of the imported roadbooks that came from the rider's server rather than from a file. */
  fromServer?: ReadonlySet<string>;
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
  // One list: what the server has and the phone does not, then what is kept, each with its one mark.
  const listed = server?.list?.status === "ready" ? server.list.items : [];
  const rows = [
    ...listed.filter((e) => !keptFor(e, server?.kept ?? [])).map((entry) => ({ kind: "server" as const, entry })),
    ...roadbooks.map((rb) => ({ kind: "book" as const, rb })),
  ];
  const linked = new Map<string, { entry: ServerRoadbook; action: ServerAction }>();
  for (const entry of listed) {
    const copy = keptFor(entry, server?.kept ?? []);
    if (copy) linked.set(copy.roadbook.id, { entry, action: serverAction(entry, server?.kept ?? []) });
  }
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
        data={rows}
        keyExtractor={(row) => (row.kind === "server" ? `server-${row.entry.id}` : row.rb.roadbook.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={server ? <ServerNotes list={server.list} onRetry={server.onRetry} /> : undefined}
        renderItem={({ item: row }) => {
          if (row.kind === "server")
            return (
              <View style={[styles.card, styles.serverCard]}>
                <View style={styles.serverGrow}>
                  <Text style={styles.tag}>{t("home.list.onServer")}</Text>
                  <Text style={styles.name}>{row.entry.name}</Text>
                  <Text style={styles.meta}>
                    {t("home.server.meta", { km: row.entry.distanceKm.toFixed(1), minutes: row.entry.ridingMinutes })}
                  </Text>
                </View>
                <ServerIcon
                  action="download"
                  name={row.entry.name}
                  busy={server?.fetching === row.entry.id}
                  disabled={server?.fetching != null}
                  onPress={() => server?.onGet(row.entry)}
                />
              </View>
            );
          const { rb } = row;
          const id = rb.roadbook.id;
          const danger = rb.corners.filter((c) => c.severity !== "bend").length;
          const link = linked.get(id);
          return (
            <View>
              <Pressable style={styles.card} onPress={() => onOpen(rb)} accessibilityRole="button">
                <RouteThumb line={rb.roadbook.line} />
                {imported?.has(id) ? (
                  <Text style={styles.tag}>
                    {t(fromServer?.has(id) ? "home.list.fromServer" : "home.list.imported")}
                  </Text>
                ) : null}
                <Text style={styles.name}>{rb.roadbook.name}</Text>
                <Text style={styles.meta}>
                  {formatDistance(rb.totalM)} · {t(rb.loop ? "home.list.loop" : "home.list.oneway")} ·{" "}
                  {t("home.list.stops", { count: Math.max(0, rb.stops.length - 2) })} ·{" "}
                  {t("home.list.corners", { count: danger })}
                </Text>
                {rb.roadbook.description ? <Text style={styles.desc}>{rb.roadbook.description}</Text> : null}
              </Pressable>
              {pending?.has(id) && onComplete ? (
                <Pressable
                  style={styles.complete}
                  onPress={() => onComplete(id)}
                  accessibilityRole="button"
                  accessibilityLabel={t("home.list.completeFor", { name: rb.roadbook.name })}
                >
                  <Text style={styles.completeText}>{t("home.list.complete")}</Text>
                </Pressable>
              ) : null}
              {imported?.has(id) && onDelete ? (
                confirming === id ? (
                  <View style={styles.confirm}>
                    <Text style={styles.confirmText}>{t("home.list.confirmDelete")}</Text>
                    <Pressable
                      style={styles.confirmButton}
                      onPress={() => {
                        setConfirming(null);
                        onDelete(id);
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
                  <View style={styles.actions}>
                    {link ? (
                      <Text style={styles.syncText}>
                        {link.action === "refresh" ? t("home.server.newer") : t("home.server.current")}
                      </Text>
                    ) : null}
                    <View style={styles.serverGrow} />
                    {link ? (
                      <ServerIcon
                        action={link.action}
                        name={rb.roadbook.name}
                        busy={server?.fetching === link.entry.id}
                        disabled={server?.fetching != null}
                        onPress={() => server?.onGet(link.entry)}
                      />
                    ) : null}
                    <Pressable
                      style={styles.serverAction}
                      onPress={() => setConfirming(id)}
                      accessibilityRole="button"
                      accessibilityLabel={t("home.list.deleteAsk", { name: rb.roadbook.name })}
                    >
                      <Icon name="trash-outline" color={colors.rustText} />
                    </Pressable>
                  </View>
                )
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}

/** What the server said when it could not give a list: nothing when it has none to offer (an older server). */
function ServerNotes({ list, onRetry }: { list: ServerList | null; onRetry: () => void }) {
  if (!list || (list.status === "problem" && list.reason === "unsupported")) return null;
  const note =
    list.status === "checking"
      ? t("home.server.checking")
      : list.status === "unreachable"
        ? t("home.server.unreachable")
        : list.status === "problem"
          ? t(`home.server.problem.${list.reason}`)
          : list.items.length === 0
            ? t("home.server.empty")
            : null;
  if (!note) return null;
  return (
    <View style={styles.serverRow}>
      <Text style={[styles.serverNote, styles.serverGrow]}>{note}</Text>
      {list.status === "unreachable" || list.status === "problem" ? (
        <Pressable
          style={styles.serverAction}
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={t("home.server.retry")}
        >
          <Text style={styles.completeText}>{t("home.server.retry")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** The one mark of a roadbook against the server: to download, up to date, or to refresh; a spinner while it is fetched. */
function ServerIcon({
  action,
  name,
  busy,
  disabled,
  onPress,
}: {
  action: ServerAction;
  name: string;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  if (busy)
    return (
      <View accessibilityLabel={t("home.server.fetching", { name })} style={styles.serverAction}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  if (action === "current")
    return (
      <View style={styles.serverAction} accessible accessibilityLabel={`${name}: ${t("home.server.current")}`}>
        <Icon name="checkmark-circle" color={colors.accent} />
      </View>
    );
  return (
    <Pressable
      style={styles.serverAction}
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t(action === "refresh" ? "home.server.refresh" : "home.server.download", { name })}
    >
      <Icon name={action === "refresh" ? "refresh" : "download-outline"} />
    </Pressable>
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
    serverCard: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
    actions: { flexDirection: "row", alignItems: "center", paddingLeft: 12 },
    syncText: { color: colors.ink2, fontFamily: fonts.sans, fontSize: 13 },
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

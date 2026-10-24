import { useEffect, useRef, useState } from "react";
import { BackHandler, FlatList, Pressable, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";
import { searchable, type Place } from "../core/destination.ts";
import { t } from "../core/i18n/index.ts";
import type { PreparedRoadbook } from "../core/types.ts";
import { searchPlaces } from "../services/places.ts";
import { useGoTo } from "./useGoTo.ts";
import { BackButton } from "./BackButton.tsx";
import { colors, fonts, themed } from "./theme.ts";

type Status =
  { kind: "idle" } | { kind: "searching" } | { kind: "routing"; place: Place } | { kind: "message"; text: string };

/** Name a place, get a motorcycle route to it from here, and ride it (spec destination-routing, ADR 0022). */
export function DestinationScreen({
  onBack,
  onRoute,
}: {
  onBack: () => void;
  onRoute: (rb: PreparedRoadbook, place: Place) => void;
}) {
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  // A late answer of a search or a route the rider has left behind is ignored.
  const run = useRef(0);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const go = useGoTo(onRoute);
  const goStatus = go.status;

  const search = async () => {
    const q = searchable(query);
    if (!q) return setStatus({ kind: "message", text: t("home.dest.tooShort") });
    const id = ++run.current;
    go.reset();
    setStatus({ kind: "searching" });
    const found = await searchPlaces(q);
    if (run.current !== id) return;
    if (!found) return setStatus({ kind: "message", text: t("home.dest.offline") });
    setPlaces(found);
    setStatus(found.length ? { kind: "idle" } : { kind: "message", text: t("home.dest.none") });
  };

  const busy = status.kind === "searching" || go.busy;
  return (
    <View style={styles.screen}>
      <BackButton onPress={onBack} label={t("home.back.map")} style={styles.back} />
      <Text style={styles.title}>{t("home.dest.title")}</Text>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={search}
          placeholder={t("home.dest.placeholder")}
          placeholderTextColor={colors.ink2}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel={t("home.dest.input")}
        />
        <Pressable
          style={[styles.searchButton, busy && styles.disabled]}
          onPress={search}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t("home.dest.search")}
        >
          <Text style={styles.searchText}>{t("home.dest.search")}</Text>
        </Pressable>
      </View>
      {status.kind === "searching" ? <Text style={styles.status}>{t("home.dest.searching")}</Text> : null}
      {goStatus.kind === "routing" ? (
        <Text style={styles.status}>{t("home.routing", { name: goStatus.place.name })}</Text>
      ) : null}
      {goStatus.kind === "message" || status.kind === "message" ? (
        <Text style={styles.status} accessibilityRole="alert">
          {goStatus.kind === "message" ? goStatus.text : status.kind === "message" ? status.text : ""}
        </Text>
      ) : null}
      <FlatList
        data={places}
        keyExtractor={(p) => `${p.lat},${p.lon},${p.name}`}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => go.goTo(item)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t("home.ride.to", { name: item.name })}
          >
            <Text style={styles.name}>{item.name}</Text>
            {item.detail ? <Text style={styles.detail}>{item.detail}</Text> : null}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.paper, paddingTop: (StatusBar.currentHeight ?? 0) + 16 },
    back: { minHeight: 48, minWidth: 48, paddingHorizontal: 16, justifyContent: "center", alignSelf: "flex-start" },
    title: { color: colors.accent, fontFamily: fonts.bold, fontSize: 28, paddingHorizontal: 16, paddingBottom: 12 },
    searchRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16 },
    input: {
      flex: 1,
      minHeight: 48,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: 4,
      paddingHorizontal: 12,
      color: colors.ink,
      fontFamily: fonts.sans,
      fontSize: 16,
    },
    searchButton: {
      minHeight: 48,
      minWidth: 48,
      paddingHorizontal: 16,
      backgroundColor: colors.moss,
      borderRadius: 4,
      alignItems: "center",
      justifyContent: "center",
    },
    disabled: { opacity: 0.5 },
    searchText: { color: colors.mossText, fontFamily: fonts.bold, fontSize: 16 },
    status: { color: colors.ink2, fontFamily: fonts.sans, fontSize: 14, paddingHorizontal: 16, paddingTop: 12 },
    list: { paddingHorizontal: 16, paddingTop: 12, gap: 10, paddingBottom: 24 },
    card: {
      minHeight: 48,
      backgroundColor: colors.card,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.rule,
      padding: 14,
      gap: 4,
    },
    name: { color: colors.ink, fontFamily: fonts.bold, fontSize: 17 },
    detail: { color: colors.ink2, fontFamily: fonts.sans, fontSize: 13 },
  }),
);

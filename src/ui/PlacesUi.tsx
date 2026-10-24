import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatDistance } from "../core/format.ts";
import { t } from "../core/i18n/index.ts";
import { PLACE_KINDS, placesAhead, poiName, type PlaceKind, type RoutePoi } from "../core/pois.ts";
import { Icon } from "./Icon.tsx";
import { Sheet } from "./RideControlUi.tsx";
import { colors, fonts, radii, themed } from "./theme.ts";
import { useLanguage } from "./languageSetting.ts";
import type { PlacesStatus } from "./usePlaces.ts";

const kindName = (kind: PlaceKind): string => t(`places.kind.${kind}`);
const placeName = (p: RoutePoi): string =>
  poiName(p.poi) ?? t("places.unnamed", { kind: kindName(p.poi.kind as PlaceKind) });

/** "Find": opens the search along the route. */
export function PlacesChip({ onPress }: { onPress: () => void }) {
  useLanguage();
  return (
    <Pressable
      style={[styles.chip, styles.chipIcon]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t("places.chip.name")}
      testID="places-chip"
    >
      <Icon name="search" color={colors.mossText} />
    </Pressable>
  );
}

/** The place the rider chose, over the panel: how far ahead it is, and a tap clears it. */
export function SelectedPlaceChip({
  place,
  progressM,
  onClear,
}: {
  place: RoutePoi;
  progressM: number;
  onClear: () => void;
}) {
  useLanguage();
  const name = placeName(place);
  const ahead = place.atM - progressM;
  const passed = ahead < -100;
  return (
    <Pressable
      style={[styles.chip, styles.selected]}
      onPress={onClear}
      accessibilityRole="button"
      accessibilityLabel={
        passed
          ? t("places.selected.passedName", { name })
          : t("places.selected.name", { name, distance: formatDistance(Math.max(0, ahead)) })
      }
      testID="selected-place"
    >
      <Text style={styles.chipText} numberOfLines={1}>
        {passed
          ? t("places.selected.passed", { name })
          : t("places.selected", { name, distance: formatDistance(Math.max(0, ahead)) })}
      </Text>
      <Text style={styles.clear}>✕</Text>
    </Pressable>
  );
}

/** The kinds of place to look for, then what was found in the next 60 km. */
export function PlacesCard({
  top,
  kind,
  status,
  results,
  progressM,
  onKind,
  onSelect,
  onFuel,
  onClose,
}: {
  top: number;
  kind: PlaceKind | null;
  status: PlacesStatus;
  results: RoutePoi[];
  progressM: number;
  onKind: (kind: PlaceKind) => void;
  onSelect: (place: RoutePoi) => void;
  onFuel: () => void;
  onClose: () => void;
}) {
  useLanguage();
  const shown = placesAhead(results, progressM, 12);
  return (
    <Sheet
      top={top}
      footer={
        <Pressable
          style={[styles.button, styles.buttonMain]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("places.close")}
        >
          <Text style={styles.buttonText}>{t("places.close")}</Text>
        </Pressable>
      }
    >
      <Text style={styles.title}>{t("places.title")}</Text>
      {kind === null ? <Text style={styles.detail}>{t("places.hint")}</Text> : null}
      {/* The kinds stay on top, the one looked for marked: switching is one tap, however long the list under it. */}
      <View style={styles.kinds}>
        <Pressable
          style={[styles.kind, styles.kindFuel]}
          onPress={onFuel}
          accessibilityRole="button"
          accessibilityLabel={t("places.kind.name", { kind: t("places.kind.fuel") })}
        >
          <Text style={styles.kindText}>{t("places.kind.fuel")}</Text>
        </Pressable>
        {PLACE_KINDS.map((k) => (
          <Pressable
            key={k}
            style={[styles.kind, k === kind && styles.kindOn]}
            onPress={() => onKind(k)}
            accessibilityRole="button"
            accessibilityState={{ selected: k === kind }}
            accessibilityLabel={t("places.kind.name", { kind: kindName(k) })}
          >
            <Text style={[styles.kindText, k === kind && styles.kindTextOn]}>{kindName(k)}</Text>
          </Pressable>
        ))}
      </View>
      {kind !== null ? (
        <>
          {status === "loading" ? (
            <Text style={styles.detail}>{t("places.loading", { kind: kindName(kind) })}</Text>
          ) : null}
          {status === "failed" ? (
            <>
              <Text style={styles.warn} accessibilityRole="alert">
                {t("places.failed")}
              </Text>
              <Pressable
                style={[styles.button, styles.buttonMain]}
                onPress={() => onKind(kind)}
                accessibilityRole="button"
                accessibilityLabel={t("places.retry")}
              >
                <Text style={styles.buttonText}>{t("places.retry")}</Text>
              </Pressable>
            </>
          ) : null}
          {status === "ready" && shown.length === 0 ? <Text style={styles.detail}>{t("places.none")}</Text> : null}
          {shown.map((s) => (
            <Pressable
              key={s.stop.poi.id}
              style={styles.row}
              onPress={() => onSelect(s.stop)}
              accessibilityRole="button"
              accessibilityLabel={`${placeName(s.stop)}, ${itemDetail(s.distM, s.stop.offM)}. ${t("places.item.hint")}`}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowName}>{placeName(s.stop)}</Text>
                <Text style={styles.detail}>{itemDetail(s.distM, s.stop.offM)}</Text>
              </View>
            </Pressable>
          ))}
        </>
      ) : null}
    </Sheet>
  );
}

const itemDetail = (distM: number, offM: number): string =>
  offM < 100
    ? t("places.item.on", { distance: formatDistance(distM) })
    : t("places.item.off", { distance: formatDistance(distM), off: formatDistance(offM) });

const styles = themed(() =>
  StyleSheet.create({
    chip: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      borderRadius: radii.pill,
      backgroundColor: colors.moss,
      alignSelf: "flex-start",
    },
    chipIcon: { width: 48, paddingHorizontal: 0, justifyContent: "center" },
    selected: { backgroundColor: colors.moss2, maxWidth: 280 },
    chipText: { color: colors.mossText, fontFamily: fonts.bold, fontSize: 15, flexShrink: 1 },
    clear: { color: colors.mossText, fontFamily: fonts.bold, fontSize: 16 },
    title: { color: colors.ink, fontFamily: fonts.bold, fontSize: 20 },
    detail: { color: colors.ink2, fontFamily: fonts.sans, fontSize: 14 },
    warn: { color: colors.rustText, fontFamily: fonts.bold, fontSize: 14 },
    kinds: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    kind: {
      minHeight: 48,
      paddingHorizontal: 16,
      borderRadius: radii.pill,
      backgroundColor: colors.moss2,
      alignItems: "center",
      justifyContent: "center",
    },
    kindFuel: { backgroundColor: colors.moss },
    kindOn: { backgroundColor: colors.signal },
    kindTextOn: { color: colors.onSignal },
    kindText: { color: colors.mossText, fontFamily: fonts.bold, fontSize: 15 },
    row: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12 },
    rowText: { flex: 1 },
    rowName: { color: colors.ink, fontFamily: fonts.bold, fontSize: 16 },
    button: {
      minHeight: 48,
      borderRadius: radii.card,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    buttonMain: { backgroundColor: colors.moss2 },
    buttonOther: { backgroundColor: colors.moss2 },
    buttonText: { color: colors.mossText, fontFamily: fonts.bold, fontSize: 16 },
  }),
);

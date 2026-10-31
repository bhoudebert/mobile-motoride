import { Children, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import {
  altitudeText,
  compassText,
  gText,
  leanText,
  pointOf,
  slopeText,
  WIDGETS,
  type Calibration,
  type InstrumentSettings,
  type Widget,
} from "../core/instruments.ts";
import { formatDateTime, formatNumber, t } from "../core/i18n/index.ts";
import { useLanguage } from "./languageSetting.ts";
import { Sheet } from "./RideControlUi.tsx";
import { colors, fonts, themed } from "./theme.ts";
import type { CalibrationResult, InstrumentValues } from "./useInstruments.ts";

/** One reading: a small label, the value. */
function Chip({
  label,
  value,
  sub,
  name,
  onPress,
  testID,
  side = false,
}: {
  label: string;
  value: string;
  sub?: string;
  /** What a screen reader says. */
  name: string;
  onPress?: () => void;
  testID: string;
  /** Sideways the tiles are narrower and lie in two columns (ADR 0045). */
  side?: boolean;
}) {
  const body = (
    <>
      <Text style={styles.chipLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.chipValue}>{value}</Text>
      {sub ? <Text style={styles.chipSub}>{sub}</Text> : null}
    </>
  );
  return onPress ? (
    <Pressable
      testID={testID}
      style={[styles.chip, side && styles.chipSide]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={name}
    >
      {body}
    </Pressable>
  ) : (
    <View testID={testID} style={[styles.chip, side && styles.chipSide]} accessible accessibilityLabel={name}>
      {body}
    </View>
  );
}

/** The readings the rider switched on, at the left of the map, small and still (spec instruments). */
export function InstrumentsOverlay({
  top,
  settings,
  values,
  calibrated,
  onCalibrate,
  landscape = false,
}: {
  top: number;
  settings: InstrumentSettings;
  values: InstrumentValues;
  calibrated: boolean;
  onCalibrate: () => void;
  landscape?: boolean;
}) {
  useLanguage();
  if (!settings.on || !WIDGETS.some((w) => settings.widgets[w])) return null;
  const { heading, elevation, motion } = values;
  const w = settings.widgets;
  // The tiles in order; a widget that is off leaves none.
  const tiles = Children.toArray([
    w.compass ? (
      <Chip
        side={landscape}
        testID="gauge-compass"
        label={t("gauges.heading")}
        value={compassText(heading)}
        name={
          heading === null
            ? t("gauges.heading.unknown")
            : t("gauges.heading.name", { point: pointOf(heading), degrees: Math.round(heading) })
        }
      />
    ) : null,
    w.altitude ? (
      <Chip
        side={landscape}
        testID="gauge-altitude"
        label={t("gauges.altitude")}
        value={altitudeText(elevation)}
        name={
          elevation.altitudeM === null
            ? t("gauges.altitude.unknown")
            : t("gauges.altitude.name", {
                altitude: Math.round(elevation.altitudeM),
                climb: Math.round(elevation.climbM),
              })
        }
      />
    ) : null,
    w.slope ? (
      <Chip
        side={landscape}
        testID="gauge-slope"
        label={t("gauges.slope")}
        value={slopeText(elevation.slopePct)}
        name={
          elevation.slopePct === null
            ? t("gauges.slope.unknown")
            : t("gauges.slope.name", { slope: slopeText(elevation.slopePct) })
        }
      />
    ) : null,
    w.lean ? (
      calibrated ? (
        <Chip
          side={landscape}
          testID="gauge-lean"
          label={t("gauges.lean")}
          value={motion ? `${leanText(motion.leanDeg)} · ${gText(motion.lateralG)}` : "–"}
          sub={
            motion
              ? t("gauges.lean.peak", { left: leanText(motion.peakLeftDeg), right: leanText(-motion.peakRightDeg) })
              : undefined
          }
          name={
            motion
              ? t(motion.leanDeg >= 0 ? "gauges.lean.left" : "gauges.lean.right", {
                  degrees: Math.round(Math.abs(motion.leanDeg)),
                })
              : t("gauges.lean.unknown")
          }
        />
      ) : (
        <Chip
          side={landscape}
          testID="gauge-lean"
          label={t("gauges.lean")}
          value={t("gauges.calibrate.value")}
          name={t("gauges.lean.needsCalibration")}
          onPress={onCalibrate}
        />
      )
    ) : null,
    w.braking ? (
      calibrated ? (
        <Chip
          side={landscape}
          testID="gauge-braking"
          label={motion && motion.brakingG < -0.05 ? t("gauges.acceleration") : t("gauges.braking")}
          value={motion ? gText(motion.brakingG) : "–"}
          name={
            motion
              ? t("gauges.braking.name", {
                  g: formatNumber(motion.brakingG, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                })
              : t("gauges.braking.unknown")
          }
        />
      ) : (
        <Chip
          side={landscape}
          testID="gauge-braking"
          label={t("gauges.braking")}
          value={t("gauges.calibrate.value")}
          name={t("gauges.braking.needsCalibration")}
          onPress={onCalibrate}
        />
      )
    ) : null,
  ]);
  // Sideways the tiles share the map's two sides, so neither side is a tall stack reaching the chips (ADR 0045).
  if (landscape) {
    const half = Math.ceil(tiles.length / 2);
    return (
      <>
        <View style={[styles.column, { top }]} pointerEvents="box-none" testID="instruments">
          {tiles.slice(0, half)}
        </View>
        {tiles.length > half ? (
          <View
            style={[styles.column, styles.columnRight, { top }]}
            pointerEvents="box-none"
            testID="instruments-right"
          >
            {tiles.slice(half)}
          </View>
        ) : null}
      </>
    );
  }
  return (
    <View style={[styles.column, { top }]} pointerEvents="box-none" testID="instruments">
      {tiles}
    </View>
  );
}

const labels = (w: Widget): { title: string; detail: string } => ({
  title: t(`gauges.widget.${w}.title`),
  detail: t(`gauges.widget.${w}.detail`),
});

function SwitchRow({
  title,
  detail,
  value,
  disabled,
  onChange,
  testID,
}: {
  title: string;
  detail?: string;
  value: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
  testID: string;
}) {
  return (
    <Pressable
      style={styles.switchRow}
      disabled={disabled}
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
    >
      <View style={styles.switchTexts}>
        <Text style={[styles.switchTitle, disabled && styles.dim]}>{title}</Text>
        {detail ? <Text style={[styles.switchDetail, disabled && styles.dim]}>{detail}</Text> : null}
      </View>
      <Switch testID={testID} value={value} disabled={disabled} onValueChange={onChange} />
    </Pressable>
  );
}

/** The card stops above the panel's last row, which a long card would cover. */
const SHEET_GAP = 110;

/** What the rider can switch on, and the calibration of the phone on its mount (spec instruments). */
export function InstrumentsCard({
  top,
  settings,
  onChange,
  calibration,
  onCalibrate,
  onResetPeaks,
  onClose,
}: {
  top: number;
  settings: InstrumentSettings;
  onChange: (next: InstrumentSettings) => void;
  calibration: Calibration | null;
  onCalibrate: () => Promise<CalibrationResult>;
  onResetPeaks: () => void;
  onClose: () => void;
}) {
  useLanguage();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const calibrateNow = async () => {
    setBusy(true);
    setMessage(t("gauges.holdStill"));
    const result = await onCalibrate();
    setBusy(false);
    setMessage(
      "done" in result
        ? t("gauges.calibrated")
        : result.failed === "moving"
          ? t("gauges.moving")
          : t("gauges.unreadable"),
    );
  };
  return (
    <Sheet
      top={top}
      bottomGap={SHEET_GAP}
      footer={
        <View style={styles.footer}>
          {message ? (
            <Text style={styles.message} accessibilityLiveRegion="polite" testID="calibration-message">
              {message}
            </Text>
          ) : null}
          <Pressable style={styles.close} onPress={onClose} accessibilityRole="button">
            <Text style={styles.closeText}>{t("gauges.close")}</Text>
          </Pressable>
        </View>
      }
    >
      <Text style={styles.title}>{t("gauges.title")}</Text>
      <SwitchRow
        testID="gauges-master"
        title={t("gauges.show")}
        value={settings.on}
        onChange={(on) => onChange({ ...settings, on })}
      />
      {WIDGETS.map((w) => (
        <SwitchRow
          key={w}
          testID={`gauge-switch-${w}`}
          title={labels(w).title}
          detail={labels(w).detail}
          value={settings.widgets[w]}
          disabled={!settings.on}
          onChange={(on) => onChange({ ...settings, widgets: { ...settings.widgets, [w]: on } })}
        />
      ))}
      <View style={styles.sensorsHead}>
        <Text style={styles.section}>{t("gauges.sensors")}</Text>
        <Text style={styles.status} testID="calibration-status">
          {calibration ? t("gauges.calibratedAt", { when: formatDateTime(calibration.at) }) : t("gauges.notCalibrated")}
        </Text>
      </View>
      <Text style={styles.detail}>{t("gauges.instructions")}</Text>
      <View style={styles.buttons}>
        <Pressable
          testID="calibrate"
          style={[styles.action, styles.actionHalf, busy && styles.dimButton]}
          disabled={busy}
          onPress={() => {
            void calibrateNow();
          }}
          accessibilityRole="button"
        >
          <Text style={styles.actionText}>{calibration ? t("gauges.calibrateAgain") : t("gauges.calibrate")}</Text>
        </Pressable>
        <Pressable
          testID="reset-peaks"
          style={[styles.action, styles.actionHalf]}
          onPress={onResetPeaks}
          accessibilityRole="button"
        >
          <Text style={styles.actionText}>{t("gauges.resetPeaks")}</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    column: { position: "absolute", left: 8, gap: 6, alignItems: "flex-start" },
    columnRight: { left: undefined, right: 8, alignItems: "flex-end" },
    chipSide: { width: 112, minWidth: 0, paddingVertical: 3 },
    chip: {
      backgroundColor: "rgba(36, 56, 45, 0.88)",
      borderRadius: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      minWidth: 96,
    },
    chipLabel: { color: colors.signal, fontFamily: fonts.mono, fontSize: 10 },
    chipValue: { color: colors.mossText, fontFamily: fonts.bold, fontSize: 16 },
    chipSub: { color: colors.mossMuted, fontFamily: fonts.mono, fontSize: 11 },
    title: { color: colors.ink, fontFamily: fonts.bold, fontSize: 20 },
    sensorsHead: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: 8,
      marginTop: 10,
    },
    section: { color: colors.ink, fontFamily: fonts.bold, fontSize: 16 },
    buttons: { flexDirection: "row", gap: 8 },
    actionHalf: { flex: 1 },
    detail: { color: colors.ink2, fontFamily: fonts.sans, fontSize: 14 },
    status: { color: colors.ink, fontFamily: fonts.mono, fontSize: 13 },
    footer: { gap: 8 },
    message: { color: colors.ink, fontFamily: fonts.bold, fontSize: 15, textAlign: "center" },
    switchRow: {
      minHeight: 46,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.rule,
    },
    switchTexts: { flex: 1, paddingVertical: 2 },
    switchTitle: { color: colors.ink, fontFamily: fonts.bold, fontSize: 16 },
    switchDetail: { color: colors.ink2, fontFamily: fonts.sans, fontSize: 13 },
    dim: { opacity: 0.45 },
    action: {
      minHeight: 48,
      borderRadius: 4,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.moss2,
      marginTop: 4,
    },
    dimButton: { opacity: 0.6 },
    actionText: { color: colors.mossText, fontFamily: fonts.bold, fontSize: 16 },
    close: {
      minHeight: 52,
      borderRadius: 4,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.moss2,
    },
    closeText: { color: colors.mossText, fontFamily: fonts.bold, fontSize: 18 },
  }),
);

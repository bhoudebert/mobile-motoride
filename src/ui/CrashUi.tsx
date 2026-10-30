import { TOP_INSET } from "./insets.ts";
import { useEffect, useState } from "react";
import { BackHandler, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  EMERGENCY_NUMBER,
  isPhoneNumber,
  mapLink,
  normalizeNumber,
  smsUrl,
  telUrl,
  type Contact,
} from "../core/crashAlert.ts";
import { formatDateTime, t } from "../core/i18n/index.ts";
import { useLanguage } from "./languageSetting.ts";
import { BackButton } from "./BackButton.tsx";
import { colors, fonts, radii, themed } from "./theme.ts";
import { useAlertFlow, type AlertState } from "./useAlertFlow.ts";

/** The message to send after a possible crash, with the last position. */
export const crashMessage = (pos: { lat: number; lon: number; time: number } | null): string =>
  t("safety.msg", {
    link: pos ? mapLink(pos.lat, pos.lon) : "?",
    time: formatDateTime(pos?.time ?? Date.now(), { hour: "2-digit", minute: "2-digit" }),
  });

/**
 * The alert over the whole screen (spec crash-detection): a countdown and one very large button; once it ran out, what was done
 * and the two things a rider or a passer-by can do: write to the contact and call 112. Back does not close it: only "I'm OK".
 */
export function CrashAlert({
  alert,
  contact,
  position,
  onOk,
}: {
  alert: AlertState;
  contact: Contact | null;
  position: { lat: number; lon: number; time: number } | null;
  onOk: () => void;
}) {
  useLanguage();
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
    return () => sub.remove();
  }, []);
  const sent = alert.phase === "sent";
  const open = (url: string) => void Linking.openURL(url).catch(() => {});
  return (
    <View style={styles.screen} accessibilityViewIsModal testID="crash-alert">
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title} accessibilityRole="header" accessibilityLiveRegion="assertive">
          {sent && !alert.test ? t("safety.sent.title") : t("safety.alert.title")}
        </Text>
        {alert.test ? <Text style={styles.test}>{t("safety.alert.test")}</Text> : null}
        {!sent ? (
          <>
            <Text style={styles.count} testID="crash-count" accessibilityLiveRegion="polite">
              {t("safety.alert.count", { n: alert.left })}
            </Text>
            <Text style={styles.text}>{t("safety.alert.body")}</Text>
          </>
        ) : (
          <>
            <Text style={styles.text} accessibilityLiveRegion="assertive">
              {alert.test ? t("safety.sent.test") : alert.live ? t("safety.sent.live") : t("safety.sent.none")}
            </Text>
            {!alert.test ? (
              <>
                <Pressable
                  style={styles.action}
                  onPress={() => open(smsUrl(contact?.number ?? "", crashMessage(position)))}
                  accessibilityRole="button"
                  accessibilityLabel={
                    contact ? t("safety.sms", { name: contact.name || contact.number }) : t("safety.sms.nobody")
                  }
                >
                  <Text style={styles.actionText}>
                    {contact ? t("safety.sms", { name: contact.name || contact.number }) : t("safety.sms.nobody")}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.action}
                  onPress={() => open(telUrl(EMERGENCY_NUMBER))}
                  accessibilityRole="button"
                  accessibilityLabel={t("safety.call")}
                >
                  <Text style={styles.actionText}>{t("safety.call")}</Text>
                </Pressable>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
      <Pressable
        style={styles.ok}
        onPress={onOk}
        accessibilityRole="button"
        accessibilityLabel={t("safety.alert.ok")}
        testID="crash-ok"
      >
        <Text style={styles.okText}>{t("safety.alert.ok")}</Text>
      </Pressable>
    </View>
  );
}

/** Crash detection on or off, the emergency contact, and a test of the alert (spec crash-detection). */
export function SafetyScreen({
  enabled,
  onEnabled,
  contact,
  onContact,
  onBack,
}: {
  enabled: boolean;
  onEnabled: (on: boolean) => void;
  contact: Contact | null;
  onContact: (c: Contact | null) => void;
  onBack: () => void;
}) {
  useLanguage();
  const [name, setName] = useState(contact?.name ?? "");
  const [number, setNumber] = useState(contact?.number ?? "");
  const [note, setNote] = useState<"saved" | "invalid" | null>(null);
  const trial = useAlertFlow(
    () => false,
    () => {},
  );
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!trial.alert) onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack, trial.alert]);

  const save = () => {
    if (!isPhoneNumber(number)) return setNote("invalid");
    onContact({ name: name.trim().slice(0, 60), number: normalizeNumber(number) });
    setNote("saved");
  };
  const toggle = enabled ? t("safety.detect.on") : t("safety.detect.off");

  return (
    <View style={styles.page}>
      {/* While the test runs the page is not drawn: the alert has the screen to itself (the fields keep what was typed). */}
      {trial.alert ? null : (
        <ScrollView contentContainerStyle={styles.pageBody}>
          <BackButton onPress={onBack} label={t("safety.screen.back")} style={styles.back} />
          <Text style={styles.pageTitle}>{t("safety.screen.title")}</Text>
          <Pressable
            style={styles.switch}
            onPress={() => onEnabled(!enabled)}
            accessibilityRole="button"
            accessibilityLabel={`${toggle}. ${t("safety.detect.hint")}`}
          >
            <Text style={styles.switchText}>{toggle}</Text>
          </Pressable>
          <Text style={styles.explain}>{t("safety.detect.explain")}</Text>
          <Text style={styles.explain}>{t("safety.live.note")}</Text>

          <Text style={styles.section}>{t("safety.contact.title")}</Text>
          {!contact ? <Text style={styles.explain}>{t("safety.contact.none")}</Text> : null}
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={(text) => {
              setName(text);
              setNote(null);
            }}
            placeholder={t("safety.contact.name")}
            placeholderTextColor={colors.ink2}
            accessibilityLabel={t("safety.contact.name")}
            maxLength={60}
          />
          <TextInput
            style={styles.input}
            value={number}
            onChangeText={(text) => {
              setNumber(text);
              setNote(null);
            }}
            placeholder={t("safety.contact.number")}
            placeholderTextColor={colors.ink2}
            accessibilityLabel={t("safety.contact.number")}
            keyboardType="phone-pad"
            maxLength={24}
          />
          {note === "invalid" ? (
            <Text style={styles.warn} accessibilityRole="alert">
              {t("safety.contact.invalid")}
            </Text>
          ) : null}
          {note === "saved" ? <Text style={styles.explain}>{t("safety.contact.saved")}</Text> : null}
          <Pressable
            style={styles.switch}
            onPress={save}
            accessibilityRole="button"
            accessibilityLabel={t("safety.contact.save")}
          >
            <Text style={styles.switchText}>{t("safety.contact.save")}</Text>
          </Pressable>
          {contact ? (
            <Pressable
              style={styles.switch}
              onPress={() => {
                onContact(null);
                setName("");
                setNumber("");
                setNote(null);
              }}
              accessibilityRole="button"
              accessibilityLabel={t("safety.contact.remove")}
            >
              <Text style={styles.switchText}>{t("safety.contact.remove")}</Text>
            </Pressable>
          ) : null}

          <Pressable
            style={styles.switch}
            onPress={() => trial.start(true)}
            accessibilityRole="button"
            accessibilityLabel={`${t("safety.test")}. ${t("safety.test.hint")}`}
          >
            <Text style={styles.switchText}>{t("safety.test")}</Text>
          </Pressable>
          <Text style={styles.explain}>{t("safety.test.hint")}</Text>
        </ScrollView>
      )}
      {trial.alert ? <CrashAlert alert={trial.alert} contact={contact} position={null} onOk={trial.ok} /> : null}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    screen: {
      ...StyleSheet.absoluteFill,
      backgroundColor: colors.rust,
      zIndex: 100,
      paddingTop: TOP_INSET + 16,
    },
    body: { padding: 24, gap: 16, flexGrow: 1, justifyContent: "center" },
    title: { color: colors.onRust, fontFamily: fonts.bold, fontSize: 36 },
    test: { color: colors.onRust, fontFamily: fonts.mono, fontSize: 14 },
    count: { color: colors.onRust, fontFamily: fonts.bold, fontSize: 56 },
    text: { color: colors.onRust, fontFamily: fonts.sans, fontSize: 22 },
    action: {
      minHeight: 64,
      borderRadius: radii.card,
      borderWidth: 3,
      borderColor: colors.onRust,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    actionText: { color: colors.onRust, fontFamily: fonts.bold, fontSize: 22 },
    ok: {
      minHeight: 140,
      margin: 16,
      borderRadius: radii.card,
      backgroundColor: colors.signal,
      alignItems: "center",
      justifyContent: "center",
    },
    okText: { color: colors.onSignal, fontFamily: fonts.bold, fontSize: 40 },
    page: { flex: 1, backgroundColor: colors.paper, paddingTop: TOP_INSET + 8 },
    pageBody: { padding: 16, gap: 12, paddingBottom: 48 },
    back: { minHeight: 48, minWidth: 48, justifyContent: "center", alignSelf: "flex-start" },
    pageTitle: { color: colors.accent, fontFamily: fonts.bold, fontSize: 30 },
    switch: {
      minHeight: 52,
      borderRadius: radii.card,
      backgroundColor: colors.moss2,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    switchText: { color: colors.mossText, fontFamily: fonts.bold, fontSize: 16 },
    explain: { color: colors.ink2, fontFamily: fonts.sans, fontSize: 14 },
    section: { color: colors.ink, fontFamily: fonts.bold, fontSize: 18, marginTop: 8 },
    warn: { color: colors.rustText, fontFamily: fonts.bold, fontSize: 14 },
    input: {
      minHeight: 52,
      borderRadius: radii.card,
      borderWidth: 1,
      borderColor: colors.rule,
      backgroundColor: colors.card,
      color: colors.ink,
      fontFamily: fonts.sans,
      fontSize: 16,
      paddingHorizontal: 14,
    },
  }),
);

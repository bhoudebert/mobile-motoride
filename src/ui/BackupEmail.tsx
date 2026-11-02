import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { t, type MessageKey } from "../core/i18n/index.ts";
import type { HostedStatus } from "../core/hosted.ts";
import { removeEmail, setEmail, verifyEmail, type SidecarFailure } from "../services/sidecar.ts";
import { accountToken } from "./hostedAccount.ts";
import { hostedServer } from "./settings.ts";
import { colors, fonts, radii, themed } from "./theme.ts";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PROBLEM: Partial<Record<SidecarFailure["reason"], MessageKey>> = {
  badCode: "server.backup.err.badCode",
  busy: "server.backup.err.busy",
  emailUnavailable: "server.backup.err.unavailable",
  rejected: "server.backup.err.invalid",
  failed: "server.backup.err.failed",
  unreachable: "server.hosted.err.unreachable",
};

/**
 * The backup email of a server the app made (spec hosted-server): a warning while there is none, the address masked once
 * confirmed. The address goes to the sidecar only; it mails a six-digit code to confirm it.
 */
export function BackupEmail({ status, onStatus }: { status: HostedStatus; onStatus: (s: HostedStatus) => void }) {
  const [phase, setPhase] = useState<"idle" | "email" | "code">("idle");
  const [email, setEmailText] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const base = hostedServer()?.sidecarUrl;
  if (!base) return null;

  const say = (reason: SidecarFailure["reason"]) => setMessage(t(PROBLEM[reason] ?? "server.backup.err.failed"));

  const send = async () => {
    const address = email.trim();
    if (!EMAIL.test(address)) return setMessage(t("server.backup.err.invalid"));
    setBusy(true);
    const r = await setEmail(base, await accountToken(), address);
    setBusy(false);
    if (!r.ok) return say(r.reason);
    setPhase("code");
    setMessage(t("server.backup.sent", { email: address }));
  };
  const confirm = async () => {
    setBusy(true);
    const r = await verifyEmail(base, await accountToken(), code.trim());
    setBusy(false);
    if (!r.ok) return say(r.reason);
    onStatus(r.value);
    setPhase("idle");
    setCode("");
    setEmailText("");
    setMessage(t("server.backup.done", { masked: r.value.emailMasked ?? "" }));
  };
  const remove = async () => {
    setBusy(true);
    const r = await removeEmail(base, await accountToken());
    setBusy(false);
    if (!r.ok) return say(r.reason);
    onStatus(r.value);
    setMessage(t("server.backup.removed"));
  };

  return (
    <View style={styles.box} testID="backup-email">
      <Text style={styles.heading}>{t("server.backup.title")}</Text>
      {status.emailConfirmed && phase === "idle" ? (
        <>
          <Text style={styles.detail}>{t("server.backup.current", { masked: status.emailMasked ?? "" })}</Text>
          <View style={styles.row}>
            <Pressable
              style={styles.link}
              onPress={() => setPhase("email")}
              accessibilityRole="button"
              accessibilityLabel={t("server.backup.change.label")}
            >
              <Text style={styles.linkText}>{t("server.backup.change")}</Text>
            </Pressable>
            <Pressable
              style={styles.link}
              disabled={busy}
              onPress={() => void remove()}
              accessibilityRole="button"
              accessibilityLabel={t("server.backup.remove.label")}
            >
              <Text style={styles.danger}>{t("server.backup.remove")}</Text>
            </Pressable>
          </View>
        </>
      ) : null}
      {!status.emailConfirmed ? (
        <Text style={styles.warn} accessibilityRole="alert">
          {"⚠ "}
          {t("server.backup.warn")}
        </Text>
      ) : null}
      {!status.emailConfirmed && phase === "idle" ? (
        <Pressable
          style={styles.link}
          onPress={() => setPhase("email")}
          accessibilityRole="button"
          accessibilityLabel={t("server.backup.add.label")}
        >
          <Text style={styles.linkText}>{t("server.backup.add")}</Text>
        </Pressable>
      ) : null}
      {phase === "email" ? (
        <>
          <Text style={styles.detail}>{t("server.backup.protects")}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmailText}
            placeholder={t("server.backup.email.placeholder")}
            placeholderTextColor={colors.ink2}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            accessibilityLabel={t("server.backup.email.label")}
          />
          <Pressable
            style={styles.action}
            disabled={busy}
            onPress={() => void send()}
            accessibilityRole="button"
            accessibilityLabel={t("server.backup.send.label")}
          >
            <Text style={styles.actionText}>{t("server.backup.send")}</Text>
          </Pressable>
        </>
      ) : null}
      {phase === "code" ? (
        <>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
            placeholder={t("server.backup.code.placeholder")}
            placeholderTextColor={colors.ink2}
            keyboardType="number-pad"
            maxLength={6}
            textContentType="oneTimeCode"
            accessibilityLabel={t("server.backup.code.label")}
          />
          <Pressable
            style={styles.action}
            disabled={busy || code.length !== 6}
            onPress={() => void confirm()}
            accessibilityRole="button"
            accessibilityLabel={t("server.backup.verify.label")}
          >
            <Text style={styles.actionText}>{t("server.backup.verify")}</Text>
          </Pressable>
        </>
      ) : null}
      {message ? (
        <Text style={styles.detail} accessibilityRole="alert">
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    box: { borderTopWidth: 1, borderTopColor: colors.rule, paddingTop: 10, gap: 8 },
    heading: { color: colors.ink2, fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
    detail: { color: colors.ink2, fontFamily: fonts.sans, fontSize: 14, lineHeight: 20 },
    warn: { color: colors.limitRed, fontFamily: fonts.bold, fontSize: 14, lineHeight: 20 },
    row: { flexDirection: "row", gap: 16 },
    input: {
      minHeight: 48,
      borderRadius: radii.card,
      borderWidth: 1,
      borderColor: colors.rule,
      paddingHorizontal: 12,
      color: colors.ink,
      fontFamily: fonts.sans,
      fontSize: 16,
    },
    action: {
      minHeight: 48,
      borderRadius: radii.card,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    actionText: { color: "#fff", fontFamily: fonts.bold, fontSize: 15 },
    link: { minHeight: 48, justifyContent: "center", alignSelf: "flex-start" },
    linkText: { color: colors.accent, fontFamily: fonts.bold, fontSize: 15 },
    danger: { color: colors.limitRed, fontFamily: fonts.bold, fontSize: 15 },
  }),
);

import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { t, type MessageKey } from "../core/i18n/index.ts";
import { confirmRecovery, startRecovery, type SidecarFailure } from "../services/sidecar.ts";
import { accountToken, replaceAccountToken } from "./hostedAccount.ts";
import { joinHosted } from "./hostedJoin.ts";
import { hostedServer } from "./settings.ts";
import { colors, fonts, radii, themed } from "./theme.ts";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROBLEM: Partial<Record<SidecarFailure["reason"], MessageKey>> = {
  badCode: "server.backup.err.badCode",
  busy: "server.backup.err.busy",
  emailUnavailable: "server.backup.err.unavailable",
  rejected: "server.backup.err.invalid",
  unreachable: "server.hosted.err.unreachable",
};

/**
 * "I already have a server" (spec hosted-server): the backup email, a mailed code, and this phone's own new token is bound to
 * the same server and library. The same words whether or not the address is known.
 */
export function RecoverServer() {
  const [phase, setPhase] = useState<"closed" | "email" | "code" | "working">("closed");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const base = hostedServer()?.sidecarUrl;
  if (!base) return null;
  const say = (reason: SidecarFailure["reason"]) => setMessage(t(PROBLEM[reason] ?? "server.backup.err.failed"));

  const send = async () => {
    const address = email.trim();
    if (!EMAIL.test(address)) return setMessage(t("server.backup.err.invalid"));
    const r = await startRecovery(base, address);
    if (!r.ok) return say(r.reason);
    setPhase("code");
    setMessage(t("server.recover.sent"));
  };

  const confirm = async () => {
    setPhase("working");
    setMessage(null);
    let token = await accountToken();
    let r = await confirmRecovery(base, email.trim(), code, token);
    // This phone's token already belongs to another server of its own: a fresh one binds to the one being recovered.
    if (!r.ok && r.reason === "tokenInUse") {
      token = await replaceAccountToken();
      r = await confirmRecovery(base, email.trim(), code, token);
    }
    if (!r.ok) {
      setPhase("code");
      return say(r.reason);
    }
    const failure = await joinHosted(base, token, "yes");
    if (failure) {
      setPhase("code");
      return say(failure);
    }
    // The server is set: the screen shows it, and this card goes.
  };

  if (phase === "closed")
    return (
      <Pressable
        style={styles.link}
        onPress={() => setPhase("email")}
        accessibilityRole="button"
        accessibilityLabel={t("server.recover.link.label")}
      >
        <Text style={styles.linkText}>{t("server.recover.link")}</Text>
      </Pressable>
    );
  return (
    <View style={styles.box} testID="recover-server">
      {phase === "working" ? <Text style={styles.detail}>{t("server.recover.working")}</Text> : null}
      {phase === "email" ? (
        <>
          <Text style={styles.detail}>{t("server.recover.intro")}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
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
            disabled={code.length !== 6}
            onPress={() => void confirm()}
            accessibilityRole="button"
            accessibilityLabel={t("server.recover.confirm.label")}
          >
            <Text style={styles.actionText}>{t("server.recover.confirm")}</Text>
          </Pressable>
        </>
      ) : null}
      {message ? (
        <Text style={styles.detail} accessibilityRole="alert">
          {message}
        </Text>
      ) : null}
      <Pressable
        style={styles.link}
        onPress={() => {
          setPhase("closed");
          setMessage(null);
        }}
        accessibilityRole="button"
        accessibilityLabel={t("server.hosted.close.label")}
      >
        <Text style={styles.linkText}>{t("server.hosted.close")}</Text>
      </Pressable>
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    box: { borderTopWidth: 1, borderTopColor: colors.rule, paddingTop: 10, gap: 8 },
    detail: { color: colors.ink2, fontFamily: fonts.sans, fontSize: 14, lineHeight: 20 },
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
  }),
);

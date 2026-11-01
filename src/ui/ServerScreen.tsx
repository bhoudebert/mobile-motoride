import { TOP_INSET } from "./insets.ts";
import * as Crypto from "expo-crypto";
import { useEffect, useState } from "react";
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { t, type MessageKey } from "../core/i18n/index.ts";
import { isTokenShaped, maskToken, newChannel, normalizeServer } from "../core/liveShare.ts";
import { joinServer, type JoinResult } from "../services/enrol.ts";
import { testServer, type RelayResult } from "../services/relay.ts";
import { useLanguage } from "./languageSetting.ts";
import { setInvitation, usePendingInvitation } from "./invitation.ts";
import { removeServer, saveServer, useServer } from "./serverSetting.ts";
import { BackButton } from "./BackButton.tsx";
import { GetServer } from "./GetServer.tsx";
import { HostedServer } from "./HostedServer.tsx";
import { ServerBrings, ServerOffer } from "./ServerFeatures.tsx";
import { hostedServer } from "./settings.ts";
import { colors, fonts, radii, themed } from "./theme.ts";

const RESULT: Record<RelayResult, MessageKey> = {
  ok: "server.result.ok",
  refused: "server.result.refused",
  unreachable: "server.result.unreachable",
  gone: "server.result.gone",
  busy: "server.result.busy",
  failed: "server.result.failed",
};

const NOT_JOINED: Record<string, MessageKey> = {
  locked: "server.join.locked",
  invalid: "server.join.invalid",
  busy: "server.join.busy",
  unreachable: "server.join.unreachable",
  failed: "server.join.failed",
};
const joinMessage = (r: Exclude<JoinResult, { ok: true }>): string =>
  r.reason === "pin"
    ? r.triesLeft >= 3
      ? t("server.pin.needed")
      : t("server.pin.wrong", { count: r.triesLeft })
    : t(NOT_JOINED[r.reason]!);

/** The server the rider uses for live sharing (spec live-share): an address and a token, saved, tested or removed. */
export function ServerScreen({ onBack }: { onBack: () => void }) {
  useLanguage();
  const saved = useServer();
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const invitation = usePendingInvitation();
  const [pin, setPin] = useState("");

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const save = async () => {
    const address = normalizeServer(url);
    if (!address) return setMessage(t("server.address.invalid"));
    if (!isTokenShaped(token.trim())) return setMessage(t("server.token.invalid"));
    await saveServer({ url: address, token: token.trim() });
    setUrl("");
    setToken("");
    setMessage(t("server.saved"));
  };

  const join = async () => {
    if (!invitation) return;
    setBusy(true);
    setMessage(t("server.joining"));
    const result = await joinServer(invitation, pin.trim());
    setBusy(false);
    if (!result.ok) return setMessage(joinMessage(result));
    await saveServer({ url: invitation.url, token: result.token });
    setInvitation(null);
    setPin("");
    setMessage(t("server.joined"));
  };

  const test = async () => {
    if (!saved) return;
    setBusy(true);
    setMessage(t("server.testing"));
    const result = await testServer(saved, () => newChannel((n) => Crypto.getRandomBytes(n)));
    setBusy(false);
    setMessage(t(RESULT[result]));
  };

  // What was just done or went wrong is told right above the block it concerns: the invitation, the server with its Test
  // button, or else the address and token fields.
  const notice = message ? (
    <Text style={styles.message} accessibilityRole="alert">
      {message}
    </Text>
  ) : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <BackButton onPress={onBack} label={t("server.back.label")} style={styles.back} />
      <Text style={styles.title}>{t("server.title")}</Text>
      <Text style={styles.help}>{t("server.help")}</Text>

      {saved ? <ServerBrings server={saved} /> : <ServerOffer />}
      {!saved && hostedServer() ? <GetServer /> : null}
      {saved ? <HostedServer server={saved} onMessage={setMessage} /> : null}

      {invitation ? notice : null}
      {invitation ? (
        <View style={styles.card} testID="invitation">
          <Text style={styles.label}>{t("server.invitation")}</Text>
          <Text style={styles.value}>{invitation.url}</Text>
          <Text style={styles.help}>{t("server.invitation.ask")}</Text>
          <TextInput
            style={styles.input}
            value={pin}
            onChangeText={(text) => setPin(text.replace(/\D/g, "").slice(0, 6))}
            placeholder={t("server.pin.placeholder")}
            placeholderTextColor={colors.ink2}
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry
            accessibilityLabel={t("server.pin.label")}
          />
          <View style={styles.row}>
            <Pressable
              style={styles.action}
              onPress={join}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={t("server.join.label")}
            >
              <Text style={styles.actionText}>{t("server.join")}</Text>
            </Pressable>
            <Pressable
              style={styles.action}
              onPress={() => {
                setInvitation(null);
                setPin("");
                setMessage(null);
              }}
              accessibilityRole="button"
              accessibilityLabel={t("server.notNow.label")}
            >
              <Text style={styles.danger}>{t("server.notNow")}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {saved && !invitation ? notice : null}
      {saved ? (
        <View style={styles.card}>
          <Text style={styles.label}>{t("server.yours")}</Text>
          <Text style={styles.value}>{saved.url}</Text>
          <Text style={styles.value}>{t("server.token", { token: maskToken(saved.token) })}</Text>
          <View style={styles.row}>
            <Pressable
              style={styles.action}
              onPress={test}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={t("server.test.label")}
            >
              <Text style={styles.actionText}>{t("server.test")}</Text>
            </Pressable>
            <Pressable
              style={styles.action}
              onPress={async () => {
                await removeServer();
                setMessage(t("server.removed"));
              }}
              accessibilityRole="button"
              accessibilityLabel={t("server.remove.label")}
            >
              <Text style={styles.danger}>{t("server.remove")}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {!saved && !invitation ? notice : null}
      {!saved ? (
        <>
          <Text style={styles.label}>{t("server.address")}</Text>
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="https://rides.example.org"
            placeholderTextColor={colors.ink2}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            accessibilityLabel={t("server.address.label")}
          />
          <Text style={styles.label}>{t("server.tokenField")}</Text>
          <TextInput
            style={styles.input}
            value={token}
            onChangeText={setToken}
            placeholder="mrt_…"
            placeholderTextColor={colors.ink2}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            accessibilityLabel={t("server.token.label")}
          />
          <Pressable
            style={styles.save}
            onPress={save}
            accessibilityRole="button"
            accessibilityLabel={t("server.save.label")}
          >
            <Text style={styles.saveText}>{t("server.save")}</Text>
          </Pressable>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.paper },
    content: { paddingTop: TOP_INSET + 8, paddingHorizontal: 16, paddingBottom: 32, gap: 8 },
    back: { minHeight: 48, minWidth: 48, justifyContent: "center", alignSelf: "flex-start" },
    title: { color: colors.accent, fontFamily: fonts.bold, fontSize: 30 },
    help: { color: colors.ink2, fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, paddingBottom: 8 },
    card: {
      backgroundColor: colors.card,
      borderRadius: radii.card,
      borderWidth: 1,
      borderColor: colors.rule,
      padding: 16,
      gap: 4,
      marginBottom: 12,
    },
    label: {
      color: colors.ink2,
      fontFamily: fonts.mono,
      fontSize: 11,
      letterSpacing: 1,
      textTransform: "uppercase",
      paddingTop: 8,
    },
    value: { color: colors.ink, fontFamily: fonts.bold, fontSize: 16 },
    row: { flexDirection: "row", justifyContent: "flex-end", gap: 4 },
    action: { minHeight: 48, minWidth: 64, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
    actionText: { color: colors.accent, fontFamily: fonts.bold, fontSize: 15 },
    danger: { color: colors.limitRed, fontFamily: fonts.bold, fontSize: 15 },
    input: {
      minHeight: 48,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: 8,
      paddingHorizontal: 12,
      color: colors.ink,
      fontFamily: fonts.sans,
      fontSize: 16,
    },
    save: {
      minHeight: 48,
      marginTop: 8,
      borderRadius: radii.pill,
      backgroundColor: colors.moss,
      alignItems: "center",
      justifyContent: "center",
    },
    saveText: { color: colors.mossText, fontFamily: fonts.bold, fontSize: 16 },
    message: { color: colors.accent, fontFamily: fonts.sans, fontSize: 14, paddingTop: 8 },
  }),
);

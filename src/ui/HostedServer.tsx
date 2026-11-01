import { useEffect, useState } from "react";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import { t } from "../core/i18n/index.ts";
import { trafficLeft, type Me } from "../core/hosted.ts";
import type { ServerSetting } from "../core/liveShare.ts";
import { getMe, linkCode } from "../services/hostedServer.ts";
import { accountStatus, deleteAccount } from "../services/sidecar.ts";
import { accountToken, forgetHosted, markHosted, readHosted, type HostedMark } from "./hostedAccount.ts";
import { removeServer } from "./serverSetting.ts";
import { hostedServer } from "./settings.ts";
import { colors, fonts, radii, themed } from "./theme.ts";

type Check =
  { kind: "loading" } | { kind: "me"; me: Me } | { kind: "invalid" } | { kind: "unreachable" } | { kind: "none" };

const mb = (bytes: number) => Math.round((bytes / 1_048_576) * 10) / 10;

/**
 * What the Server screen says about the server in use (spec server-features): who provides it, the plan, the library
 * and the traffic, and for a server the app made (spec hosted-server) its support code, the code to connect ChatGPT or
 * Claude and the deletion of it.
 */
export function HostedServer({ server, onMessage }: { server: ServerSetting; onMessage: (m: string) => void }) {
  const [mark, setMark] = useState<HostedMark | null | undefined>(undefined);
  const [support, setSupport] = useState<string | null>(null);
  const [check, setCheck] = useState<Check>({ kind: "loading" });
  const [code, setCode] = useState<{ code: string } | string | null>(null);
  const [deleting, setDeleting] = useState<"ask" | "working" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void readHosted().then((m) => live && setMark(m));
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    let live = true;
    setCheck({ kind: "loading" });
    void getMe(server).then((r) => {
      if (!live) return;
      setCheck(
        r.ok
          ? { kind: "me", me: r.value }
          : r.reason === "refused"
            ? { kind: "invalid" }
            : r.reason === "unreachable"
              ? { kind: "unreachable" }
              : { kind: "none" },
      );
    });
    return () => {
      live = false;
    };
  }, [server.url, server.token]);

  // The support code of a server the app made comes from the sidecar's account status.
  useEffect(() => {
    const base = hostedServer()?.sidecarUrl;
    if (!mark || !base) return;
    let live = true;
    void accountToken().then((token) =>
      accountStatus(base, token).then((r) => live && setSupport(r.ok ? r.value.supportCode : null)),
    );
    return () => {
      live = false;
    };
  }, [mark]);

  if (mark === undefined) return null;
  const hosted = mark !== null;

  const connect = async () => {
    setError(null);
    const r = await linkCode(server);
    if (r.ok) return setCode({ code: r.value.code });
    setCode(null);
    setError(t(r.reason === "busy" ? "server.chat.busy" : "server.chat.err"));
  };

  const remove = async () => {
    const base = hostedServer()?.sidecarUrl;
    if (!base) return;
    setDeleting("working");
    const r = await deleteAccount(base, await accountToken());
    if (!r.ok) {
      setDeleting("ask");
      return setError(t(r.reason === "unreachable" ? "server.delete.offline" : "server.delete.failed"));
    }
    await removeServer();
    await forgetHosted();
    onMessage(t("server.delete.done"));
  };

  const me = check.kind === "me" ? check.me : null;
  const left = me ? trafficLeft(me) : null;
  return (
    <View style={styles.card} testID="hosted-server">
      <Text style={styles.heading}>{t(hosted ? "server.mine.title" : "server.info.title")}</Text>
      <Text style={styles.title}>{t(hosted ? "server.info.provider.hosted" : "server.info.provider.own")}</Text>
      {hosted ? (
        <Text style={styles.detail}>{t("server.info.plan", { plan: t("server.hosted.plan.free") })}</Text>
      ) : null}
      {mark === "new" ? (
        <View accessible accessibilityLabel={`${t("server.mine.ready")}. ${t("server.mine.ready.detail")}`}>
          <Text style={styles.title}>{t("server.mine.ready")}</Text>
          <Text style={styles.detail}>{t("server.mine.ready.detail")}</Text>
          <Pressable
            style={styles.action}
            onPress={() => {
              setMark("yes");
              void markHosted("yes");
            }}
            accessibilityRole="button"
            accessibilityLabel={t("server.mine.done.label")}
          >
            <Text style={styles.actionText}>{t("server.mine.done")}</Text>
          </Pressable>
        </View>
      ) : null}
      {check.kind === "loading" ? <Text style={styles.detail}>{t("server.mine.loading")}</Text> : null}
      {check.kind === "invalid" ? <Text style={styles.detail}>{t("server.mine.invalid")}</Text> : null}
      {check.kind === "unreachable" ? <Text style={styles.detail}>{t("server.mine.unreachable")}</Text> : null}
      {me?.library ? <Text style={styles.detail}>{t("server.info.library.what")}</Text> : null}
      {me?.suspended ? (
        <View>
          <Text style={styles.title}>{t("server.mine.paused")}</Text>
          <Text style={styles.detail}>
            {me.suspended.until
              ? t("server.mine.paused.until", { date: me.suspended.until.slice(0, 10) })
              : t("server.mine.paused.open")}
          </Text>
        </View>
      ) : null}
      {me && !me.suspended ? (
        <>
          <Text style={styles.detail}>
            {me.traffic.mode === "off"
              ? t("server.mine.traffic.off")
              : left === null
                ? t("server.mine.traffic.on")
                : t("server.mine.traffic.left", { count: left })}
          </Text>
          <Text style={styles.detail}>
            {me.library.limitMb === null
              ? t("server.mine.library.free", { used: mb(me.library.usedBytes) })
              : t("server.mine.library", { used: mb(me.library.usedBytes), limit: me.library.limitMb })}
          </Text>
        </>
      ) : null}

      {hosted && support ? (
        <Text style={styles.detail} selectable>
          {t("server.info.support", { code: support })}
        </Text>
      ) : null}

      {hosted && me && !me.suspended ? (
        <Pressable
          style={styles.link}
          onPress={() => void connect()}
          accessibilityRole="button"
          accessibilityLabel={t("server.chat.button.label")}
        >
          <Text style={styles.linkText}>{t("server.chat.button")}</Text>
        </Pressable>
      ) : null}
      {code && typeof code === "object" ? (
        <View style={styles.code} testID="chat-code">
          <Text style={styles.heading}>{t("server.chat.title")}</Text>
          <Text style={styles.codeText} selectable accessibilityLabel={code.code.split("").join(" ")}>
            {code.code}
          </Text>
          <Text style={styles.detail}>{t("server.chat.detail")}</Text>
          <Text style={styles.detail}>{t("server.chat.steps")}</Text>
          <Pressable
            style={styles.link}
            onPress={() => void Share.share({ message: code.code }).catch(() => {})}
            accessibilityRole="button"
            accessibilityLabel={t("server.chat.share.label")}
          >
            <Text style={styles.linkText}>{t("server.chat.share")}</Text>
          </Pressable>
          <Pressable style={styles.link} onPress={() => void connect()} accessibilityRole="button">
            <Text style={styles.linkText}>{t("server.chat.new")}</Text>
          </Pressable>
        </View>
      ) : null}
      {error ? (
        <Text style={styles.detail} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      {!hosted ? null : deleting === null ? (
        <Pressable
          style={styles.link}
          onPress={() => setDeleting("ask")}
          accessibilityRole="button"
          accessibilityLabel={t("server.delete.label")}
        >
          <Text style={styles.danger}>{t("server.delete")}</Text>
        </Pressable>
      ) : (
        <View style={styles.code} testID="delete-confirm">
          <Text style={styles.detail}>{t("server.delete.warn")}</Text>
          {deleting === "working" ? <Text style={styles.detail}>{t("server.delete.working")}</Text> : null}
          <View style={styles.row}>
            <Pressable
              style={styles.link}
              disabled={deleting === "working"}
              onPress={() => void remove()}
              accessibilityRole="button"
              accessibilityLabel={t("server.delete.confirm.label")}
            >
              <Text style={styles.danger}>{t("server.delete.confirm")}</Text>
            </Pressable>
            <Pressable
              style={styles.link}
              disabled={deleting === "working"}
              onPress={() => {
                setDeleting(null);
                setError(null);
              }}
              accessibilityRole="button"
              accessibilityLabel={t("server.delete.keep.label")}
            >
              <Text style={styles.linkText}>{t("server.delete.keep")}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: radii.card,
      borderWidth: 1,
      borderColor: colors.rule,
      padding: 16,
      gap: 8,
      marginBottom: 12,
    },
    heading: { color: colors.ink2, fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
    title: { color: colors.ink, fontFamily: fonts.bold, fontSize: 16 },
    detail: { color: colors.ink2, fontFamily: fonts.sans, fontSize: 14, lineHeight: 20 },
    code: { borderTopWidth: 1, borderTopColor: colors.rule, paddingTop: 10, gap: 6 },
    codeText: { color: colors.ink, fontFamily: fonts.mono, fontSize: 32, letterSpacing: 4 },
    row: { flexDirection: "row", gap: 16 },
    action: {
      minHeight: 48,
      borderRadius: radii.card,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
      marginTop: 8,
    },
    actionText: { color: "#fff", fontFamily: fonts.bold, fontSize: 15 },
    link: { minHeight: 48, justifyContent: "center", alignSelf: "flex-start" },
    linkText: { color: colors.accent, fontFamily: fonts.bold, fontSize: 15 },
    danger: { color: colors.limitRed, fontFamily: fonts.bold, fontSize: 15 },
  }),
);

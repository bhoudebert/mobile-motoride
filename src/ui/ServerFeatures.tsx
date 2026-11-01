import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import type { Capabilities } from "../core/capabilities.ts";
import type { ServerSetting } from "../core/liveShare.ts";
import { t } from "../core/i18n/index.ts";
import { fetchCapabilities } from "../services/capabilities.ts";
import { Icon } from "./Icon.tsx";
import { countryName } from "./TrafficUi.tsx";
import { hostedServer } from "./settings.ts";
import { colors, fonts, radii, themed } from "./theme.ts";

/** The hosting guide, where whoever runs a server learns what each feature needs (agentRide's self-hosting page). */
export const HOSTING_GUIDE = "https://bhoudebert.github.io/agent-motoride/guide/self-hosting";

function Row({ on, title, detail }: { on: boolean; title: string; detail: string }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${title}. ${detail}`}>
      <Icon name={on ? "checkmark-circle" : "close-circle-outline"} color={on ? colors.moss : colors.ink2} />
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.detail}>{detail}</Text>
      </View>
    </View>
  );
}

/** What the rider's server offers, read from its health answer: each feature on, or off with the way to turn it on. */
export function ServerBrings({ server }: { server: ServerSetting }) {
  const [caps, setCaps] = useState<Capabilities | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    setCaps(undefined);
    void fetchCapabilities(server).then((c) => live && setCaps(c));
    return () => {
      live = false;
    };
  }, [server.url, server.token]);

  return (
    <View style={styles.card} testID="server-brings">
      <Text style={styles.heading}>{t("server.brings.title")}</Text>
      {caps === undefined ? <Text style={styles.detail}>{t("server.brings.checking")}</Text> : null}
      {caps === null ? <Text style={styles.detail}>{t("server.brings.unreachable")}</Text> : null}
      {caps ? (
        <>
          <Row on title={t("server.brings.share")} detail={t("server.brings.share.on")} />
          <Row
            on={caps.traffic}
            title={t("server.brings.traffic")}
            detail={
              !caps.traffic
                ? t("server.brings.traffic.off")
                : caps.countries.length > 0
                  ? t("server.brings.traffic.on", { countries: caps.countries.map(countryName).join(", ") })
                  : t("server.brings.traffic.onAny")
            }
          />
        </>
      ) : null}
      <HostLink />
    </View>
  );
}

/** What a server would add, for a rider who has none, and where to learn how to run one. */
export function ServerOffer() {
  return (
    <View style={styles.card} testID="server-offer">
      <Text style={styles.heading}>{t("server.none.title")}</Text>
      <Row on={false} title={t("server.brings.share")} detail={t("server.none.share")} />
      <Row on={false} title={t("server.brings.traffic")} detail={t("server.none.traffic")} />
      <Text style={styles.detail}>{t("server.none.without")}</Text>
      <HostLink />
    </View>
  );
}

function HostLink() {
  return (
    <>
      <Pressable
        style={styles.link}
        onPress={() => void Linking.openURL(HOSTING_GUIDE).catch(() => {})}
        accessibilityRole="link"
        accessibilityLabel={t("server.host.label")}
      >
        <Text style={styles.linkText}>{t("server.host")}</Text>
      </Pressable>
      {hostedServer() ? null : <Text style={styles.detail}>{t("server.rent")}</Text>}
    </>
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
    row: { flexDirection: "row", gap: 12, alignItems: "flex-start", minHeight: 44 },
    text: { flex: 1, gap: 2 },
    title: { color: colors.ink, fontFamily: fonts.bold, fontSize: 16 },
    detail: { color: colors.ink2, fontFamily: fonts.sans, fontSize: 14, lineHeight: 20 },
    link: { minHeight: 48, justifyContent: "center", alignSelf: "flex-start" },
    linkText: { color: colors.accent, fontFamily: fonts.bold, fontSize: 15 },
  }),
);

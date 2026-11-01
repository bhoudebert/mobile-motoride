import { Pressable, StyleSheet, Text, View } from "react-native";
import { t, type MessageKey } from "../core/i18n/index.ts";
import type { Plan } from "../core/hosted.ts";
import type { SidecarFailure } from "../services/sidecar.ts";
import { colors, fonts, radii, themed } from "./theme.ts";
import { useGetServer } from "./useGetServer.ts";

const FAILURE: Record<SidecarFailure["reason"], MessageKey> = {
  unreachable: "server.hosted.err.unreachable",
  busy: "server.hosted.err.busy",
  unavailable: "server.hosted.err.unavailable",
  suspended: "server.hosted.err.suspended",
  rejected: "server.hosted.err.failed",
  failed: "server.hosted.err.failed",
};

const KIND_TEXT = {
  free: ["server.hosted.plan.free", "server.hosted.plan.free.detail"],
  paid: ["server.hosted.plan.paid", "server.hosted.plan.paid.detail"],
  premium: ["server.hosted.plan.premium", "server.hosted.plan.premium.detail"],
} as const;

function PlanCard({ plan, onFree }: { plan: Plan; onFree: () => void }) {
  const [name, detail] = KIND_TEXT[plan.kind];
  // Only Free can be chosen for now: the paid plan waits for the store, Premium for the backend.
  const choosable = plan.kind === "free" && plan.available;
  return (
    <View
      style={styles.plan}
      accessible
      accessibilityLabel={`${t(name)}. ${t(detail)}${choosable ? "" : ` ${t("server.hosted.plan.soon")}`}`}
    >
      <Text style={styles.planName}>{t(name)}</Text>
      <Text style={styles.detail}>{t(detail)}</Text>
      {choosable ? (
        <Pressable
          style={styles.action}
          onPress={onFree}
          accessibilityRole="button"
          accessibilityLabel={t("server.hosted.choose.free.label")}
        >
          <Text style={styles.actionText}>{t("server.hosted.choose.free")}</Text>
        </Pressable>
      ) : (
        <Text style={styles.soon}>{t("server.hosted.plan.soon")}</Text>
      )}
    </View>
  );
}

/** "Get a server" for a rider with none (spec hosted-server): the plans, then the setup, nothing to type or scan. */
export function GetServer() {
  const { view, open, close, getFree } = useGetServer();
  if (view.kind === "closed") {
    return (
      <View style={styles.card} testID="get-server">
        <Text style={styles.heading}>{t("server.hosted.title")}</Text>
        <Text style={styles.detail}>{t("server.hosted.intro")}</Text>
        <Pressable
          style={styles.action}
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={t("server.hosted.see.label")}
        >
          <Text style={styles.actionText}>{t("server.hosted.see")}</Text>
        </Pressable>
      </View>
    );
  }
  if (view.kind === "plans") {
    return (
      <View style={styles.card} testID="get-server-plans">
        <Text style={styles.heading}>{t("server.hosted.title")}</Text>
        {view.failure ? (
          <Text style={styles.detail} accessibilityRole="alert">
            {t(FAILURE[view.failure])}
          </Text>
        ) : view.plans ? (
          view.plans.map((p) => <PlanCard key={p.id} plan={p} onFree={getFree} />)
        ) : (
          <Text style={styles.detail}>{t("server.hosted.loading")}</Text>
        )}
        <Text style={styles.detail}>{t("server.hosted.seller")}</Text>
        <Pressable
          style={styles.link}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel={t("server.hosted.close.label")}
        >
          <Text style={styles.linkText}>{t("server.hosted.close")}</Text>
        </Pressable>
      </View>
    );
  }
  const steps = ["creating", "connecting"] as const;
  return (
    <View style={styles.card} testID="get-server-setup">
      <Text style={styles.heading}>{t("server.hosted.setup")}</Text>
      {steps.map((s) => {
        const at = steps.indexOf(view.step);
        const mark = steps.indexOf(s) < at ? "✓" : s === view.step ? "●" : "○";
        return (
          <Text key={s} style={styles.step} accessibilityLabel={`${t(`server.hosted.step.${s}`)}`}>
            {mark} {t(`server.hosted.step.${s}`)}
          </Text>
        );
      })}
      {view.slow ? <Text style={styles.detail}>{t("server.hosted.slow")}</Text> : null}
      {view.failure ? (
        <>
          <Text style={styles.detail} accessibilityRole="alert">
            {t(FAILURE[view.failure])}
          </Text>
          <Pressable
            style={styles.action}
            onPress={getFree}
            accessibilityRole="button"
            accessibilityLabel={t("server.hosted.retry.label")}
          >
            <Text style={styles.actionText}>{t("server.hosted.retry")}</Text>
          </Pressable>
        </>
      ) : null}
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
      gap: 10,
      marginBottom: 12,
    },
    heading: { color: colors.ink2, fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
    plan: { borderTopWidth: 1, borderTopColor: colors.rule, paddingTop: 10, gap: 4 },
    planName: { color: colors.ink, fontFamily: fonts.bold, fontSize: 16 },
    detail: { color: colors.ink2, fontFamily: fonts.sans, fontSize: 14, lineHeight: 20 },
    soon: { color: colors.ink2, fontFamily: fonts.mono, fontSize: 12 },
    step: { color: colors.ink, fontFamily: fonts.sans, fontSize: 16, minHeight: 28 },
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

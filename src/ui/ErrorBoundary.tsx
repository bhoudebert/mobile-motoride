import { Component, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { t } from "../core/i18n/index.ts";
import { colors, fonts, themed } from "./theme.ts";

interface Props {
  children: ReactNode;
  onBack: () => void;
}

/** A render error shows its message and a way back, instead of closing the app. */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>{t("home.error.title")}</Text>
        <ScrollView style={styles.scroll}>
          <Text style={styles.message}>{`${error.name}: ${error.message}`}</Text>
        </ScrollView>
        <Pressable style={styles.button} onPress={this.props.onBack} accessibilityRole="button">
          <Text style={styles.buttonText}>{t("home.back.list")}</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = themed(() =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.paper, padding: 24, paddingTop: 64, gap: 16 },
    title: { color: colors.rustText, fontFamily: fonts.bold, fontSize: 24 },
    scroll: { flex: 1 },
    message: { color: colors.ink, fontFamily: fonts.mono, fontSize: 13 },
    button: { backgroundColor: colors.moss, borderRadius: 4, padding: 16, alignItems: "center" },
    buttonText: { color: colors.mossText, fontFamily: fonts.bold, fontSize: 18 },
  }),
);

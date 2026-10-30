import { TOP_INSET } from "./insets.ts";
import { useEffect } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { nextThemeSetting, type Scheme, type ThemeSetting } from "../core/theme.ts";
import { LANGUAGE_NAME, nextLanguageSetting, t, type LanguageSetting } from "../core/i18n/index.ts";
import { nextVoice, voiceName, type VoiceMode } from "../core/voice.ts";
import { CloseIcon, PinIcon, RoadIcon } from "./icons.tsx";
import { colors, fonts, lift, radii, themed } from "./theme.ts";

/** The menu of the home screen: where to go, the voice, the recent rides, and what the app is (spec home-screen). */
export function HomeMenu({
  voice,
  onVoice,
  hasRecents,
  onClearRecents,
  onRoadbooks,
  onSearch,
  onImport,
  onRides,
  onServer,
  onSafety,
  onClose,
  language = "system",
  onLanguage,
  theme = "system",
  scheme = "light",
  onTheme,
}: {
  voice: VoiceMode;
  onVoice: (mode: VoiceMode) => void;
  hasRecents: boolean;
  onClearRecents: () => void;
  onRoadbooks: () => void;
  onSearch: () => void;
  onImport: () => void;
  onRides: () => void;
  onServer: () => void;
  /** Without it the menu has no safety item. */
  onSafety?: () => void;
  onClose: () => void;
  language?: LanguageSetting;
  /** The look choice, the look in use, and how to change it; the menu offers the item when there is a way (spec appearance). */
  theme?: ThemeSetting;
  scheme?: Scheme;
  onTheme?: (next: ThemeSetting) => void;
  /** Without it the menu has no language item. */
  onLanguage?: (next: LanguageSetting) => void;
}) {
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  return (
    <View style={styles.overlay} testID="home-menu">
      <Pressable
        style={styles.scrim}
        onPress={onClose}
        accessibilityLabel={t("home.menu.close")}
        accessibilityRole="button"
      />
      <View style={styles.panel} testID="home-menu-panel">
        <Pressable
          style={styles.close}
          onPress={onClose}
          accessibilityLabel={t("home.menu.closeButton")}
          accessibilityRole="button"
        >
          <CloseIcon />
        </Pressable>
        <Item label={t("home.roadbooks")} onPress={onRoadbooks} icon={<RoadIcon />} />
        <Item label={t("home.menu.search")} onPress={onSearch} icon={<PinIcon />} />
        <Item label={t("home.menu.rides")} onPress={onRides} icon={<Text style={styles.glyph}>◔</Text>} />
        {onSafety ? (
          <Item label={t("home.menu.safety")} onPress={onSafety} icon={<Text style={styles.glyph}>✚</Text>} />
        ) : null}
        <Item label={t("home.menu.server")} onPress={onServer} icon={<Text style={styles.glyph}>⇄</Text>} />
        <Item label={t("home.menu.import")} onPress={onImport} icon={<Text style={styles.glyph}>⇩</Text>} />
        <Item
          label={voiceName(voice)}
          hint={t("home.menu.tapToChange")}
          onPress={() => onVoice(nextVoice(voice))}
          icon={<Text style={styles.glyph}>♪</Text>}
        />
        {onLanguage ? (
          <Item
            label={t("home.menu.language", { choice: languageChoice(language) })}
            hint={t("home.menu.tapToChange")}
            onPress={() => onLanguage(nextLanguageSetting(language))}
            icon={<Text style={styles.glyph}>A</Text>}
          />
        ) : null}
        {onTheme ? (
          <Item
            label={t("home.menu.theme", { choice: themeChoice(theme, scheme) })}
            hint={t("home.menu.tapToChange")}
            onPress={() => onTheme(nextThemeSetting(theme))}
            icon={<Text style={styles.glyph}>◐</Text>}
          />
        ) : null}
        {hasRecents ? (
          <Item
            label={t("home.menu.clearRecents")}
            onPress={onClearRecents}
            icon={<Text style={styles.glyph}>⌫</Text>}
          />
        ) : null}
        <View style={styles.about}>
          <Text style={styles.aboutName}>MotoRide</Text>
          <Text style={styles.aboutText}>{t("home.menu.aboutApp")}</Text>
          <Text style={styles.aboutText}>{t("home.menu.aboutMap")}</Text>
        </View>
      </View>
    </View>
  );
}

/** "System (English)", "English", "Français": the language names are never translated (spec languages). */
const languageChoice = (setting: LanguageSetting): string =>
  setting === "system"
    ? t("home.menu.languageSystem", { language: t("home.menu.systemLanguage") })
    : LANGUAGE_NAME[setting];

/** "System (dark)", "Light", "Dark". */
const themeChoice = (setting: ThemeSetting, scheme: Scheme): string =>
  setting === "system"
    ? t("home.menu.themeSystem", { look: t(`home.theme.${scheme}`).toLowerCase() })
    : t(`home.theme.${setting}`);

function Item({
  label,
  hint,
  icon,
  onPress,
}: {
  label: string;
  hint?: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={styles.item}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
    >
      <View style={styles.icon}>{icon}</View>
      <Text style={styles.itemText}>{label}</Text>
    </Pressable>
  );
}

const styles = themed(() =>
  StyleSheet.create({
    overlay: { ...StyleSheet.absoluteFill, flexDirection: "row" },
    scrim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(20, 30, 24, 0.5)" },
    panel: {
      width: 300,
      maxWidth: "84%",
      backgroundColor: colors.paper,
      borderTopRightRadius: radii.sheet,
      borderBottomRightRadius: radii.sheet,
      paddingTop: TOP_INSET + 12,
      paddingHorizontal: 12,
      paddingBottom: 24,
      ...lift,
    },
    close: { width: 48, height: 48, alignItems: "center", justifyContent: "center", alignSelf: "flex-end" },
    item: {
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingHorizontal: 12,
      borderRadius: radii.card,
    },
    icon: { width: 28, alignItems: "center", justifyContent: "center" },
    glyph: { color: colors.accent, fontFamily: fonts.bold, fontSize: 20 },
    itemText: { color: colors.ink, fontFamily: fonts.bold, fontSize: 17, flexShrink: 1 },
    about: { marginTop: 24, paddingHorizontal: 12, gap: 6 },
    aboutName: { color: colors.accent, fontFamily: fonts.bold, fontSize: 22 },
    aboutText: { color: colors.ink2, fontFamily: fonts.sans, fontSize: 13 },
  }),
);

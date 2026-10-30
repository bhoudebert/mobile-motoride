import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useMemo, useState } from "react";
import type { Place } from "./src/core/destination.ts";
import { prepareRoadbook } from "./src/core/roadbook.ts";
import type { PreparedRoadbook } from "./src/core/types.ts";
import { bundledRoadbooks } from "./src/data/bundled/index.ts";
import spaceGroteskBold from "./assets/fonts/SpaceGrotesk-Bold.ttf";
import spaceGroteskMedium from "./assets/fonts/SpaceGrotesk-Medium.ttf";
import jetBrainsMono from "./assets/fonts/JetBrainsMono-Regular.ttf";
import { DestinationScreen } from "./src/ui/DestinationScreen.tsx";
import { ErrorBoundary } from "./src/ui/ErrorBoundary.tsx";
import { HomeScreen, roadbookDetail } from "./src/ui/HomeScreen.tsx";
import { RideScreen } from "./src/ui/RideScreen.tsx";
import { RidesScreen } from "./src/ui/RidesScreen.tsx";
import { RideReviewScreen } from "./src/ui/RideReviewScreen.tsx";
import type { RideMeta } from "./src/core/recording.ts";
import { ServerScreen } from "./src/ui/ServerScreen.tsx";
import { SafetyScreen } from "./src/ui/CrashUi.tsx";
import { useCrashSettings } from "./src/ui/crashStore.ts";
import { useServerLink } from "./src/ui/useServerLink.ts";
import { ImportNoticeBar } from "./src/ui/ImportNoticeBar.tsx";
import { RoadbookList } from "./src/ui/RoadbookList.tsx";
import { useImport, type ImportNotice } from "./src/ui/useImport.ts";
import { useServer } from "./src/ui/serverSetting.ts";
import { useServerRoadbooks } from "./src/ui/useServerRoadbooks.ts";
import { recoverRide } from "./src/ui/ridesStore.ts";
import { formatDistance } from "./src/core/format.ts";
import { t } from "./src/core/i18n/index.ts";
import { useLanguage, useLanguageSetting } from "./src/ui/languageSetting.ts";
import { useScheme, useThemeSetting } from "./src/ui/themeSetting.ts";
import { useRecents } from "./src/ui/recents.ts";

SplashScreen.preventAutoHideAsync().catch(() => {});

type Screen =
  | { name: "home" }
  | { name: "roadbooks" }
  | { name: "search" }
  | { name: "rides" }
  | { name: "review"; ride: RideMeta }
  | { name: "server" }
  | { name: "safety" }
  // A ride goes back to the screen it was opened from (spec home-screen).
  | { name: "ride"; rb: PreparedRoadbook; from: "home" | "roadbooks" };

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    "SpaceGrotesk-Medium": spaceGroteskMedium,
    "SpaceGrotesk-Bold": spaceGroteskBold,
    "JetBrainsMono-Regular": jetBrainsMono,
  });
  // The language in use redraws the whole tree when it changes (ADR 0032); the stored choice is read before the first screen.
  const lang = useLanguageSetting();
  useLanguage();
  // The look in use, light or dark, redraws it the same way (ADR 0033).
  const look = useThemeSetting();
  const scheme = useScheme();
  const crashSettings = useCrashSettings();
  const ready = (fontsLoaded || fontError !== null) && lang.ready && look.ready;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  const bundled = useMemo(() => bundledRoadbooks.map(prepareRoadbook), []);
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const { recents, remember, clear } = useRecents();
  // What happened on its own: a ride that was saved. The import's own messages come first.
  const [info, setInfo] = useState<ImportNotice>(null);
  const saved = (m: { distanceM: number; state: string }, recovered = false) =>
    setInfo({
      kind: "info",
      text: t(recovered ? "home.saved.recovered" : "home.saved.ride", { distance: formatDistance(m.distanceM) }),
    });
  // A link that sets the server, after the rider says yes.
  useServerLink(setInfo, () => setScreen({ name: "server" }));
  // A message about a ride that was saved fades by itself.
  useEffect(() => {
    if (info?.kind !== "info") return;
    const timer = setTimeout(() => setInfo(null), 9000);
    return () => clearTimeout(timer);
  }, [info]);
  // A ride the app was closed during is saved at the next launch.
  useEffect(() => {
    void recoverRide().then((m) => m && saved(m, true));
  }, []);
  // A roadbook that has just come in opens its ride, from the list it now belongs to.
  const library = useImport((rb) => {
    const prepared = prepareRoadbook(rb);
    void remember({
      kind: "roadbook",
      id: prepared.roadbook.id,
      name: prepared.roadbook.name,
      detail: roadbookDetail(prepared),
      at: Date.now(),
    });
    setScreen({ name: "ride", rb: prepared, from: "roadbooks" });
  });
  const server = useServer();
  const serverRoadbooks = useServerRoadbooks(server, screen.name === "roadbooks");
  const imported = useMemo(() => library.items.map((i) => prepareRoadbook(i.roadbook)), [library.items]);
  const pendingIds = useMemo(
    () => new Set(library.items.filter((i) => i.completion === "pending").map((i) => i.roadbook.id)),
    [library.items],
  );
  const importedIds = useMemo(() => new Set(imported.map((r) => r.roadbook.id)), [imported]);
  // What the rider brought in comes first, then the bundled ones.
  const roadbooks = useMemo(
    () => [...imported, ...bundled.filter((b) => !importedIds.has(b.roadbook.id))],
    [imported, bundled, importedIds],
  );

  if (!ready) return null;

  const openRoadbook = (rb: PreparedRoadbook, from: "home" | "roadbooks") => {
    void remember({
      kind: "roadbook",
      id: rb.roadbook.id,
      name: rb.roadbook.name,
      detail: roadbookDetail(rb),
      at: Date.now(),
    });
    setScreen({ name: "ride", rb, from });
  };
  const openRoute = (rb: PreparedRoadbook, place: Place) => {
    void remember({ kind: "place", place, at: Date.now() });
    setScreen({ name: "ride", rb, from: "home" });
  };
  const home = () => setScreen({ name: "home" });
  const leave = (from: "home" | "roadbooks") => setScreen(from === "home" ? { name: "home" } : { name: "roadbooks" });

  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <ImportNoticeBar
        notice={library.notice ?? info}
        onDismiss={library.notice ? library.dismiss : () => setInfo(null)}
      />
      {screen.name === "ride" ? (
        <ErrorBoundary key={screen.rb.roadbook.id} onBack={() => leave(screen.from)}>
          <RideScreen
            rb={screen.rb}
            backLabel={screen.from === "home" ? t("home.back.map") : t("home.back.list")}
            onRideSaved={(m) => saved(m)}
            onBack={() => leave(screen.from)}
          />
        </ErrorBoundary>
      ) : screen.name === "safety" ? (
        <SafetyScreen
          enabled={crashSettings.enabled}
          onEnabled={crashSettings.setEnabled}
          contact={crashSettings.contact}
          onContact={crashSettings.setContact}
          onBack={home}
        />
      ) : screen.name === "server" ? (
        <ServerScreen onBack={home} />
      ) : screen.name === "review" ? (
        <RideReviewScreen ride={screen.ride} onBack={() => setScreen({ name: "rides" })} />
      ) : screen.name === "rides" ? (
        <RidesScreen onBack={home} onReview={(ride) => setScreen({ name: "review", ride })} />
      ) : screen.name === "search" ? (
        <DestinationScreen onBack={home} onRoute={openRoute} />
      ) : screen.name === "roadbooks" ? (
        <RoadbookList
          roadbooks={roadbooks}
          onOpen={(rb) => openRoadbook(rb, "roadbooks")}
          onBack={home}
          imported={importedIds}
          onImport={() => void library.pick()}
          onDelete={(id) => void library.remove(id)}
          pending={pendingIds}
          onComplete={(id) => void library.retry(id)}
          server={
            server
              ? {
                  list: serverRoadbooks.list,
                  kept: library.items,
                  fetching: library.fetching,
                  onGet: (entry) => void library.fromServer(server, entry),
                  onRetry: serverRoadbooks.reload,
                }
              : undefined
          }
        />
      ) : (
        <HomeScreen
          roadbooks={roadbooks}
          recents={recents}
          onOpenRoadbook={(rb) => openRoadbook(rb, "home")}
          onRoute={openRoute}
          onSearch={() => setScreen({ name: "search" })}
          onRoadbooks={() => setScreen({ name: "roadbooks" })}
          onClearRecents={() => void clear()}
          onImport={() => void library.pick()}
          onRides={() => setScreen({ name: "rides" })}
          onServer={() => setScreen({ name: "server" })}
          onSafety={() => setScreen({ name: "safety" })}
          language={lang.setting}
          onLanguage={lang.change}
          theme={look.setting}
          scheme={scheme}
          onTheme={look.change}
        />
      )}
    </>
  );
}

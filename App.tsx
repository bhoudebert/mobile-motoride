import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Place } from "./src/core/destination.ts";
import { prepareRoadbook } from "./src/core/roadbook.ts";
import type { PreparedRoadbook } from "./src/core/types.ts";
import spaceGroteskBold from "./assets/fonts/SpaceGrotesk-Bold.ttf";
import spaceGroteskMedium from "./assets/fonts/SpaceGrotesk-Medium.ttf";
import jetBrainsMono from "./assets/fonts/JetBrainsMono-Regular.ttf";
import { DestinationScreen } from "./src/ui/DestinationScreen.tsx";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ErrorBoundary } from "./src/ui/ErrorBoundary.tsx";
import { HomeScreen, roadbookDetail } from "./src/ui/HomeScreen.tsx";
import { RideScreen } from "./src/ui/RideScreen.tsx";
import { RidesScreen } from "./src/ui/RidesScreen.tsx";
import { RideReviewScreen } from "./src/ui/RideReviewScreen.tsx";
import { ServerScreen } from "./src/ui/ServerScreen.tsx";
import { SafetyScreen } from "./src/ui/CrashUi.tsx";
import { useCrashSettings } from "./src/ui/crashStore.ts";
import { useServerLink } from "./src/ui/useServerLink.ts";
import { ImportNoticeBar } from "./src/ui/ImportNoticeBar.tsx";
import { RoadbookList } from "./src/ui/RoadbookList.tsx";
import { SwipeBack } from "./src/ui/SwipeBack.tsx";
import { useImport, type ImportNotice } from "./src/ui/useImport.ts";
import { useServer, useServerSettled } from "./src/ui/serverSetting.ts";
import { useSendRoadbooks } from "./src/ui/useSendRoadbooks.ts";
import { useLibraryId } from "./src/ui/libraryIdentity.ts";
import { detachRides } from "./src/ui/ridesStore.ts";
import { useRideUpload } from "./src/ui/useRideUpload.ts";
import type { RideMeta } from "./src/core/recording.ts";
import { onlyOnPhone, serverAction, type ServerRoadbook } from "./src/core/serverRoadbooks.ts";
import { useServerRoadbooks } from "./src/ui/useServerRoadbooks.ts";
import { recoverRides } from "./src/ui/ridesStore.ts";
import { formatDistance } from "./src/core/format.ts";
import { t } from "./src/core/i18n/index.ts";
import { useLanguage, useLanguageSetting } from "./src/ui/languageSetting.ts";
import { useScheme, useThemeSetting } from "./src/ui/themeSetting.ts";
import { useRecents } from "./src/ui/recents.ts";
import { lockPortrait } from "./src/ui/orientation.ts";

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
  // Every screen is portrait; the ride screen lets the phone turn while it is open (ADR 0045).
  useEffect(() => lockPortrait(), []);
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const { recents, remember, clear } = useRecents();
  // What happened on its own: a ride that was saved. The import's own messages come first.
  const [info, setInfo] = useState<ImportNotice>(null);
  // A ride that was saved: with a server enrolled the notice offers to send it there (spec ride-recording).
  const saved = (m: RideMeta, recovered = false) =>
    setInfo({
      kind: "info",
      text: t(recovered ? "home.saved.recovered" : "home.saved.ride", { distance: formatDistance(m.distanceM) }),
      ...(serverNow.current
        ? { action: { label: t("home.saved.upload"), onPress: () => void uploadFromNotice(m) } }
        : {}),
    });
  const uploadFromNotice = async (m: RideMeta) => {
    setInfo({ kind: "busy", text: t("home.rides.uploading") });
    const result = await rideUpload.upload(m.id);
    setInfo({
      kind: "info",
      text: result.ok ? t("home.rides.uploaded") : t(`home.rides.uploadProblem.${result.reason}`),
    });
  };
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
    void recoverRides().then((list) => list.forEach((m) => saved(m, true)));
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
  // The ride notice is made before the server is known to this render: read it when the ride ends.
  const serverNow = useRef(server);
  serverNow.current = server;
  const rideUpload = useRideUpload(server);
  // Copies kept from a server that is not the one in use (none set, another set, or kept before libraries had an identity)
  // become roadbooks and rides of the phone only: nothing is lost, nothing is matched across servers (ADR 0049).
  const libraryId = useLibraryId(server);
  const detach = library.detach;
  const serverSettled = useServerSettled();
  useEffect(() => {
    if (!serverSettled) return;
    void detach(libraryId);
    void detachRides(libraryId);
  }, [serverSettled, libraryId?.address, libraryId?.rider, detach]);
  // A roadbook the rider asked to update comes down by itself once the server has its new file.
  const serverRoadbooks = useServerRoadbooks(
    server,
    screen.name === "roadbooks",
    server
      ? (entry, listed) => {
          // Only a file that is not the one held comes down: a refresh that ends on the same stamp changes nothing.
          const action = serverAction(entry, library.items, listed);
          if (action === "refresh" || action === "download") void library.fromServer(server, entry, false);
        }
      : undefined,
  );
  // The roadbooks that are only on the phone can be sent to the server (spec roadbook-library).
  const onlyLocal = onlyOnPhone(
    library.items,
    serverRoadbooks.list?.status === "ready" ? serverRoadbooks.list.items : null,
  );
  const sendRoadbooks = useSendRoadbooks(server, onlyLocal, library.link, serverRoadbooks.reload);
  // A file the server has not made yet is made on the first request and a long route takes minutes: the phone waits a
  // little, then asks the server to prepare it and the roadbook comes down by itself when it is ready.
  const getRoadbook = async (s: NonNullable<typeof server>, entry: ServerRoadbook) => {
    if ((await library.fromServer(s, entry)) === "slow") void serverRoadbooks.refresh(entry);
  };
  const imported = useMemo(() => library.items.map((i) => prepareRoadbook(i.roadbook)), [library.items]);
  const pendingIds = useMemo(
    () => new Set(library.items.filter((i) => i.completion === "pending").map((i) => i.roadbook.id)),
    [library.items],
  );
  const fromServerIds = useMemo(
    () => new Set(library.items.filter((i) => i.serverId !== undefined).map((i) => i.roadbook.id)),
    [library.items],
  );
  const importedIds = useMemo(() => new Set(imported.map((r) => r.roadbook.id)), [imported]);
  // The app ships no roadbook (ADR 0044): the list is what the rider brought in or fetched from the server.
  const roadbooks = imported;

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
    <SafeAreaProvider>
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
        <SwipeBack onBack={home}>
          <ServerScreen onBack={home} />
        </SwipeBack>
      ) : screen.name === "review" ? (
        <SwipeBack onBack={() => setScreen({ name: "rides" })}>
          <RideReviewScreen ride={screen.ride} onBack={() => setScreen({ name: "rides" })} />
        </SwipeBack>
      ) : screen.name === "rides" ? (
        <SwipeBack onBack={home}>
          <RidesScreen server={server} onBack={home} onReview={(ride) => setScreen({ name: "review", ride })} />
        </SwipeBack>
      ) : screen.name === "search" ? (
        <SwipeBack onBack={home}>
          <DestinationScreen onBack={home} onRoute={openRoute} />
        </SwipeBack>
      ) : screen.name === "roadbooks" ? (
        <SwipeBack onBack={home}>
          <RoadbookList
            roadbooks={roadbooks}
            onOpen={(rb) => openRoadbook(rb, "roadbooks")}
            onBack={home}
            imported={importedIds}
            onImport={() => void library.pick()}
            onDelete={(id) => void library.remove(id)}
            onShare={(id) => void library.share(id)}
            fromServer={fromServerIds}
            pending={pendingIds}
            onComplete={(id) => void library.retry(id)}
            server={
              server
                ? {
                    list: serverRoadbooks.list,
                    kept: library.items,
                    fetching: library.fetching,
                    onGet: (entry) => void getRoadbook(server, entry),
                    onRefresh: (entry) => void serverRoadbooks.refresh(entry),
                    asking: serverRoadbooks.asking,
                    problem: serverRoadbooks.problem,
                    onRetry: serverRoadbooks.reload,
                    send: {
                      count: onlyLocal.length,
                      ids: new Set(onlyLocal.map((k) => k.roadbook.id)),
                      state: sendRoadbooks,
                      onRides: () => setScreen({ name: "rides" }),
                    },
                  }
                : undefined
            }
          />
        </SwipeBack>
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
    </SafeAreaProvider>
  );
}

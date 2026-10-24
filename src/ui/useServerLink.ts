import { useEffect, useRef } from "react";
import { Alert, Linking } from "react-native";
import { t } from "../core/i18n/index.ts";
import { isServerLink, parseInviteLink, parseServerLink } from "../core/liveShare.ts";
import { setInvitation } from "./invitation.ts";
import { saveServer } from "./serverSetting.ts";
import type { ImportNotice } from "./useImport.ts";

/** A link `mobilemotoride://server?url=…&token=…` sets the server, but only after the rider has read the address and said yes; one with `&code=…` is an invitation to join (the Server screen). */
export function useServerLink(say: (notice: ImportNotice) => void, showServer: () => void) {
  const seen = useRef(new Set<string>());
  useEffect(() => {
    const handle = (link: string | null | undefined) => {
      if (!link || !isServerLink(link) || seen.current.has(link)) return;
      seen.current.add(link);
      // An invitation (`&code=`) opens the Server screen on it: nothing is set until the rider joins.
      if (/[?&]code=/i.test(link)) {
        const invitation = parseInviteLink(link);
        if (!invitation) return say({ kind: "error", text: t("server.link.invitationInvalid") });
        setInvitation(invitation);
        return showServer();
      }
      const setting = parseServerLink(link);
      if (!setting) return say({ kind: "error", text: t("server.link.invalid") });
      Alert.alert(t("server.link.useTitle"), t("server.link.useBody", { url: setting.url }), [
        { text: t("server.link.no"), style: "cancel" },
        {
          text: t("server.link.yes"),
          onPress: () => {
            void saveServer(setting).then(() =>
              say({ kind: "info", text: t("server.link.set", { url: setting.url }) }),
            );
          },
        },
      ]);
    };
    Linking.getInitialURL()
      .then(handle)
      .catch(() => {});
    const sub = Linking.addEventListener("url", (e) => handle(e.url));
    return () => sub.remove();
    // The setter is stable for the life of the app.
  }, []);
}

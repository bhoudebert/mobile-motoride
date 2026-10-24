import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { parseContact, type Contact } from "../core/crashAlert.ts";

const DETECT_KEY = "crash-detection";
const CONTACT_KEY = "crash-contact";

/**
 * Crash detection on or off, and the emergency contact, kept between launches (spec crash-detection). Detection is on until the
 * stored choice says otherwise; `ready` turns true once both are read, so a ride never starts watching before it is known.
 */
export function useCrashSettings(): {
  enabled: boolean;
  setEnabled: (on: boolean) => void;
  contact: Contact | null;
  setContact: (c: Contact | null) => void;
  ready: boolean;
} {
  const [enabled, setOn] = useState(true);
  const [contact, setCon] = useState<Contact | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    Promise.all([AsyncStorage.getItem(DETECT_KEY), AsyncStorage.getItem(CONTACT_KEY)])
      .then(([on, c]) => {
        if (!live) return;
        if (on === "off") setOn(false);
        setCon(parseContact(c));
      })
      .catch(() => {})
      .finally(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, []);
  return {
    enabled,
    setEnabled: (on) => {
      setOn(on);
      AsyncStorage.setItem(DETECT_KEY, on ? "on" : "off").catch(() => {});
    },
    contact,
    setContact: (c) => {
      setCon(c);
      (c ? AsyncStorage.setItem(CONTACT_KEY, JSON.stringify(c)) : AsyncStorage.removeItem(CONTACT_KEY)).catch(() => {});
    },
    ready,
  };
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, screen, within } from "@testing-library/react-native";
import * as Speech from "expo-speech";
import { Linking, Vibration } from "react-native";
import App from "../../App.tsx";
import { setLanguage } from "../../src/core/i18n/index.ts";
import { RideScreen } from "../../src/ui/RideScreen.tsx";
import * as location from "./location.mock.ts";
import { resetMapMock } from "./maplibre.mock.tsx";
import { Accelerometer, resetSensors } from "./sensors.mock.ts";
import { flush } from "./flush.ts";
import { at, first } from "./helpers.ts";

// Spec crash-detection: a hard shock and ten seconds without moving, then a countdown, then what can be done.
const speak = Speech.speak as jest.Mock;
const said = () => speak.mock.calls.map((c) => c[0] as string);
const SAY = "Crash detected. Tap the screen if you are all right.";

const UPRIGHT = { x: 0, y: 1, z: 0 };
const LYING = { x: 1, y: 0.05, z: 0 };

beforeEach(async () => {
  jest.useFakeTimers();
  jest.setSystemTime(Date.UTC(2026, 9, 20, 9, 0, 0));
  resetMapMock();
  resetSensors();
  speak.mockClear();
  (Vibration.vibrate as jest.Mock).mockClear();
  (Vibration.cancel as jest.Mock).mockClear();
  await AsyncStorage.clear();
  setLanguage("en");
  location.state.permission = "granted";
  location.state.watcher = null;
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  setLanguage("en");
});

const startRide = async (start = "Start") => {
  const rb = first();
  const [lat, lon] = at(rb, 1_000);
  location.state.position = { latitude: lat, longitude: lon };
  await render(<RideScreen rb={rb} onBack={() => {}} />);
  await flush(30);
  await fireEvent.press(screen.getByText(start));
  await flush(30);
  return rb;
};

/** A second of riding: a position, and the accelerometer 20 times, the first two being a shock when `shock` is set. */
const second = async (m: number, mps: number, accel = UPRIGHT, shock = 0) => {
  const rb = first();
  const [lat, lon] = at(rb, m);
  await act(async () => location.pushFix(lat, lon, mps, Date.now(), 90));
  for (let k = 0; k < 20; k++) {
    await act(async () => {
      Accelerometer.emit(shock && k < 2 ? { x: shock * 0.6, y: shock * 0.8, z: 0 } : accel);
      jest.advanceTimersByTime(50);
    });
  }
};

const cruise = async (seconds: number, mps = 20) => {
  for (let i = 0; i < seconds; i++) await second(1_000 + i * mps, mps);
};
const crash = async () => {
  await cruise(10);
  await second(1_300, 20, LYING, 8); // the shock
  for (let i = 0; i < 16; i++) await second(1_320, 0, LYING); // and it lies still
};

test("a crash at speed starts the alert: the title, a countdown, vibration, and the voice asking if all is well", async () => {
  await startRide();
  await crash();
  expect(screen.getByTestId("crash-alert")).toBeTruthy();
  expect(screen.getByText("Possible crash")).toBeTruthy();
  expect(screen.getByText("Are you all right? Tap the button.")).toBeTruthy();
  expect(screen.getByTestId("crash-count").props.children).toMatch(/^Alert in (30|2\d) s$/);
  expect(Vibration.vibrate).toHaveBeenCalledWith(expect.any(Array), true);
  expect(said()).toContain(SAY);
});

test("I'm OK stops it: vibration, voice and the alert are gone", async () => {
  await startRide();
  await crash();
  speak.mockClear();
  await fireEvent.press(screen.getByTestId("crash-ok"));
  expect(screen.queryByTestId("crash-alert")).toBeNull();
  expect(Vibration.cancel).toHaveBeenCalled();
  expect(Speech.stop).toHaveBeenCalled();
  await act(async () => {
    jest.advanceTimersByTime(60_000);
  });
  expect(said()).toEqual([]);
});

test("the voice asks again every eight seconds, and not in Off", async () => {
  await startRide();
  await crash();
  const first = said().filter((s) => s === SAY).length;
  await act(async () => {
    jest.advanceTimersByTime(9_000);
  });
  expect(said().filter((s) => s === SAY).length).toBeGreaterThan(first);
});

test("when no one answers in 30 seconds the alert says so, with the two things to do: write to the contact and call 112", async () => {
  await AsyncStorage.setItem("crash-contact", JSON.stringify({ name: "Anna", number: "+33 6 12 34 56 78" }));
  const open = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
  await startRide();
  await crash();
  await act(async () => {
    jest.advanceTimersByTime(31_000);
  });
  expect(screen.getByText("Alert")).toBeTruthy();
  expect(screen.getByText("No one was told automatically. Send the message or call.")).toBeTruthy();
  expect(said()).toContain("No answer. Alert sent.");
  await fireEvent.press(screen.getByLabelText("Message Anna"));
  const url = String(open.mock.calls[0]![0]);
  expect(url.startsWith("sms:+33612345678?body=")).toBe(true);
  const body = decodeURIComponent(url.split("?body=")[1]!);
  expect(body).toMatch(
    /^MotoRide: I may have crashed\. My last position: https:\/\/www\.openstreetmap\.org\/\?mlat=50\.\d+&mlon=3\.\d+#map=17\/50\.\d+\/3\.\d+ \(at \d\d:\d\d\)\./,
  );
  await fireEvent.press(screen.getByLabelText("Call 112"));
  expect(open).toHaveBeenLastCalledWith("tel:112");
  // The rider can still say they are fine.
  await fireEvent.press(screen.getByTestId("crash-ok"));
  expect(screen.queryByTestId("crash-alert")).toBeNull();
});

test("with no contact the message can still be written, and it is not sent by the app", async () => {
  const open = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
  await startRide();
  await crash();
  await act(async () => {
    jest.advanceTimersByTime(31_000);
  });
  await fireEvent.press(screen.getByLabelText("Write the message"));
  expect(String(open.mock.calls[0]![0]).startsWith("sms:?body=")).toBe(true);
});

test("a pothole at speed, hard braking to a stop and a corner raise no alert", async () => {
  await startRide();
  await cruise(10);
  await second(1_300, 20, UPRIGHT, 6); // a pothole: a shock, and it goes on
  await cruise(15);
  for (let i = 0; i < 5; i++) await second(1_600, 20 - i * 5, { x: 0, y: 1, z: 0.8 }); // braking
  for (let i = 0; i < 20; i++) await second(1_700, 0);
  expect(screen.queryByTestId("crash-alert")).toBeNull();
  expect(said()).not.toContain(SAY);
});

test("with detection off the sensors are not listened to and nothing is raised", async () => {
  await AsyncStorage.setItem("crash-detection", "off");
  await startRide();
  expect(Accelerometer.addListener).not.toHaveBeenCalled();
  await crash();
  expect(screen.queryByTestId("crash-alert")).toBeNull();
});

test("a demo and a ride that is not on the phone's GPS are not watched", async () => {
  await render(<RideScreen rb={first()} onBack={() => {}} />);
  await flush(30);
  expect(Accelerometer.addListener).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("Demo"));
  await flush(30);
  expect(Accelerometer.addListener).not.toHaveBeenCalled();
});

test("the alert is in French in French", async () => {
  setLanguage("fr");
  await startRide("Démarrer");
  await crash();
  expect(screen.getByText("Chute possible")).toBeTruthy();
  expect(screen.getByText("Tout va bien ? Appuyez sur le bouton.")).toBeTruthy();
  expect(screen.getByLabelText("Ça va")).toBeTruthy();
  expect(said()).toContain("Chute détectée. Touchez l'écran si tout va bien.");
});

const openSafety = async () => {
  await render(<App />);
  await flush(30);
  await fireEvent.press(screen.getByLabelText("Open the menu"));
  await fireEvent.press(screen.getByLabelText("Safety"));
  await flush(30);
};

test("the Safety page switches detection and keeps it", async () => {
  await openSafety();
  expect(screen.getByText("Safety")).toBeTruthy();
  await fireEvent.press(screen.getByLabelText("Crash detection: on. Tap to change"));
  expect(screen.getByLabelText("Crash detection: off. Tap to change")).toBeTruthy();
  expect(await AsyncStorage.getItem("crash-detection")).toBe("off");
  await fireEvent.press(screen.getByLabelText("Crash detection: off. Tap to change"));
  expect(await AsyncStorage.getItem("crash-detection")).toBe("on");
});

test("the emergency contact is checked, saved, shown again and removed", async () => {
  await openSafety();
  await fireEvent.changeText(screen.getByLabelText("Phone number"), "abc");
  await fireEvent.press(screen.getByLabelText("Save the contact"));
  expect(screen.getByText("That is not a phone number.")).toBeTruthy();
  expect(await AsyncStorage.getItem("crash-contact")).toBeNull();
  await fireEvent.changeText(screen.getByLabelText("Name"), "Anna");
  await fireEvent.changeText(screen.getByLabelText("Phone number"), "06 12 34 56 78");
  await fireEvent.press(screen.getByLabelText("Save the contact"));
  expect(screen.getByText("Saved.")).toBeTruthy();
  expect(JSON.parse((await AsyncStorage.getItem("crash-contact"))!)).toEqual({ name: "Anna", number: "0612345678" });
  await fireEvent.press(screen.getByLabelText("Remove the contact"));
  expect(await AsyncStorage.getItem("crash-contact")).toBeNull();
  expect(screen.getByText(/^No contact: after an alert/)).toBeTruthy();
});

test("a stored contact is shown on the Safety page", async () => {
  await AsyncStorage.setItem("crash-contact", JSON.stringify({ name: "Anna", number: "+33612345678" }));
  await openSafety();
  expect(screen.getByDisplayValue("Anna")).toBeTruthy();
  expect(screen.getByDisplayValue("+33612345678")).toBeTruthy();
});

test("the test of the alert runs ten seconds, says nothing will be sent, and offers nothing to send", async () => {
  const open = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
  await openSafety();
  await fireEvent.press(screen.getByLabelText(/^Try the alert/));
  const alert = within(screen.getByTestId("crash-alert"));
  expect(alert.getByText("Test: nothing will be sent")).toBeTruthy();
  expect(alert.getByTestId("crash-count").props.children).toMatch(/^Alert in (10|9) s$/);
  await act(async () => {
    jest.advanceTimersByTime(11_000);
  });
  expect(alert.getByText("The test is over. Nothing was sent.")).toBeTruthy();
  expect(alert.queryByLabelText("Call 112")).toBeNull();
  expect(said()).not.toContain("No answer. Alert sent.");
  await fireEvent.press(alert.getByTestId("crash-ok"));
  expect(screen.queryByTestId("crash-alert")).toBeNull();
  expect(open).not.toHaveBeenCalled();
});

test("the Safety page is in French in French", async () => {
  setLanguage("fr");
  await render(<App />);
  await flush(30);
  await fireEvent.press(screen.getByLabelText("Ouvrir le menu"));
  await fireEvent.press(screen.getByLabelText("Sécurité"));
  await flush(30);
  expect(screen.getByLabelText("Détection de chute : activée. Touchez pour changer")).toBeTruthy();
  expect(screen.getByText("Contact d'urgence")).toBeTruthy();
});

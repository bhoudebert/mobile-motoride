import { t } from "../core/i18n/index.ts";
import * as Location from "expo-location";
import { PermissionsAndroid, Platform } from "react-native";
import * as TaskManager from "expo-task-manager";

/** The name of the location task that backs the foreground service. */
export const RIDE_TASK = "mobilemotoride-ride";

// The positions reach the app through its own subscription: the task only has to exist for Android to keep the app alive.
TaskManager.defineTask(RIDE_TASK, async () => {});

/**
 * Keeps the app running with the screen off, as an Android foreground service with a notification (ADR 0020).
 * Says whether it started; a ride that cannot have it carries on with the screen on.
 */
export async function startRideService(roadbookName: string): Promise<boolean> {
  try {
    // From Android 13 the notification that goes with the service is hidden until the rider allows notifications.
    if (Platform.OS === "android" && Number(Platform.Version) >= 33) {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }
    if (await Location.hasStartedLocationUpdatesAsync(RIDE_TASK)) return true;
    await Location.startLocationUpdatesAsync(RIDE_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 1000,
      distanceInterval: 0,
      foregroundService: {
        notificationTitle: "MotoRide",
        notificationBody: t("ride.service.riding", { name: roadbookName }),
        notificationColor: "#24382d",
        killServiceOnDestroy: true,
      },
    });
    return true;
  } catch (e) {
    console.warn("The ride service did not start", e);
    return false;
  }
}

export async function stopRideService(): Promise<void> {
  try {
    if (await Location.hasStartedLocationUpdatesAsync(RIDE_TASK)) await Location.stopLocationUpdatesAsync(RIDE_TASK);
  } catch {
    // Nothing left to stop.
  }
}

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export const RAIN_CHANNEL_ID = "rain-alerts";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function setupAndroidChannel(): Promise<void> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(RAIN_CHANNEL_ID, {
      name: "Rain alerts",
      description: "Spoken alerts when rain starts and stops",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 300, 200, 300],
      // Default sound; per-alert content.sound overrides it.
      sound: "rain_started",
    });
  }
}

async function notifySpoken(
  title: string,
  body: string,
  sound: "rain_started" | "rain_stopped"
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      // Android: plays assets/sounds/<name>.mp3 (bundled to res/raw by the
      // withRainSounds config plugin), so the phone literally speaks.
      // iOS: falls back to the default sound.
      sound: Platform.OS === "android" ? sound : true,
      ...(Platform.OS === "android" ? { channelId: RAIN_CHANNEL_ID } : {}),
    },
    trigger: null,
  });
}

export async function notifyRainStarted(): Promise<void> {
  await notifySpoken(
    "Rain has started",
    "It's raining at your location.",
    "rain_started"
  );
}

export async function notifyRainStopped(): Promise<void> {
  await notifySpoken(
    "Rain has stopped",
    "The rain has stopped at your location.",
    "rain_stopped"
  );
}

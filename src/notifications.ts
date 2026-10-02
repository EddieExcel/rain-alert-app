import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export const RAIN_STARTED_CHANNEL_ID = "rain-alerts-started";
export const RAIN_STOPPED_CHANNEL_ID = "rain-alerts-stopped";
// Legacy single channel from earlier builds — removed on startup because
// Android channels are immutable once created; a stale channel would keep a
// missing/wrong sound forever.
const LEGACY_CHANNEL_ID = "rain-alerts";

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
  if (Platform.OS !== "android") return;
  // Drop the legacy channel so a corrupt/stale single-sound channel can
  // never stick around (no-op when it doesn't exist).
  try {
    await Notifications.deleteNotificationChannelAsync(LEGACY_CHANNEL_ID);
  } catch {}
  // NOTE: on Android 8+ the CHANNEL's sound is what plays — a per-notification
  // `sound` is ignored. So each spoken phrase gets its own channel.
  await Notifications.setNotificationChannelAsync(RAIN_STARTED_CHANNEL_ID, {
    name: "Rain started",
    description: "Spoken alert when rain starts",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 300, 200, 300],
    sound: "rain_started",
  });
  await Notifications.setNotificationChannelAsync(RAIN_STOPPED_CHANNEL_ID, {
    name: "Rain stopped",
    description: "Spoken alert when rain stops",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 300, 200, 300],
    sound: "rain_stopped",
  });
}

async function notifySpoken(
  title: string,
  body: string,
  channelId: string,
  sound: "rain_started" | "rain_stopped"
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      // Android: the channel's sound is what actually plays (see above);
      // the raw clip is bundled to res/raw by the withRainSounds plugin,
      // so the phone literally speaks even with the screen off.
      // iOS: falls back to the default sound.
      sound: Platform.OS === "android" ? sound : true,
      ...(Platform.OS === "android" ? { channelId } : {}),
    },
    trigger: null,
  });
}

export async function notifyRainStarted(): Promise<void> {
  await notifySpoken(
    "It is raining",
    "It is raining at your location.",
    RAIN_STARTED_CHANNEL_ID,
    "rain_started"
  );
}

export async function notifyRainStopped(): Promise<void> {
  await notifySpoken(
    "It has stopped raining",
    "It has stopped raining at your location.",
    RAIN_STOPPED_CHANNEL_ID,
    "rain_stopped"
  );
}

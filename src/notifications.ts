import * as Notifications from "expo-notifications";
import * as Speech from "expo-speech";
import { Platform } from "react-native";

export const RAIN_STARTED_CHANNEL_ID = "rain-alerts-started";
export const RAIN_STOPPED_CHANNEL_ID = "rain-alerts-stopped";
// Channels from earlier builds — removed on startup because Android channels
// are immutable once created; a stale channel would keep its old sound
// forever.
const LEGACY_CHANNEL_IDS = [
  "rain-alerts",
  "rain-alerts-started",
  "rain-alerts-stopped",
];

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
  // Drop legacy channels so a stale custom-sound channel can never stick
  // around (no-op when one doesn't exist). The voice is spoken via TTS now,
  // so the channels stay silent — banner + vibration only.
  for (const id of LEGACY_CHANNEL_IDS) {
    try {
      await Notifications.deleteNotificationChannelAsync(id);
    } catch {}
  }
  // NOTE: on Android 8+ the CHANNEL's sound is what plays — a per-notification
  // `sound` is ignored. Custom channel sounds proved unreliable on-device, so
  // the spoken phrase goes through expo-speech (TTS) instead; these channels
  // are deliberately silent.
  await Notifications.setNotificationChannelAsync(RAIN_STARTED_CHANNEL_ID, {
    name: "Rain started",
    description: "Alert when rain starts (spoken via voice)",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 300, 200, 300],
    sound: null,
  });
  await Notifications.setNotificationChannelAsync(RAIN_STOPPED_CHANNEL_ID, {
    name: "Rain stopped",
    description: "Alert when rain stops (spoken via voice)",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 300, 200, 300],
    sound: null,
  });
}

async function notifySpoken(
  title: string,
  body: string,
  spoken: string,
  channelId: string
): Promise<void> {
  // The voice goes through TTS (proven to work on-device); the notification
  // is the visual/vibration record. Speech.speak is fire-and-forget — the
  // system TTS service plays it even if the app suspends.
  Speech.speak(spoken);
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      // Android: the channel governs sound (ours are silent; TTS is the
      // voice), so no per-notification sound is set. iOS: default sound.
      ...(Platform.OS === "android" ? { channelId } : { sound: true }),
    },
    trigger: null,
  });
}

export async function notifyRainStarted(): Promise<void> {
  await notifySpoken(
    "It is raining",
    "It is raining at your location.",
    "It is raining.",
    RAIN_STARTED_CHANNEL_ID
  );
}

export async function notifyRainStopped(): Promise<void> {
  await notifySpoken(
    "It has stopped raining",
    "It has stopped raining at your location.",
    "It has stopped raining.",
    RAIN_STOPPED_CHANNEL_ID
  );
}

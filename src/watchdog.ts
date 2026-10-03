/**
 * Background rain watchdog.
 *
 * A BackgroundFetch task fires about every 15 minutes (OS-enforced minimum
 * on Android), checks Open-Meteo at the device's location, runs the
 * transition engine, and fires a spoken alert on rain start/stop.
 *
 * The spoken alert goes through expo-speech (TTS) plus a banner/vibration
 * notification, so it talks even with the screen off. The launcher icon is
 * also kept in sync with the sky (sun / cloud / rain) via activity aliases.
 *
 * NOTE: background fetch requires a dev build
 * (`npx expo run:android`); Expo Go throttles background tasks.
 */
import * as TaskManager from "expo-task-manager";
import * as BackgroundFetch from "expo-background-fetch";
import * as Location from "expo-location";
import { fetchCurrentWeather, isRaining } from "./weather";
import { updateEngine } from "./engine";
import {
  loadEnabled,
  loadEngine,
  loadHome,
  saveEngine,
} from "./storage";
import { notifyRainStarted, notifyRainStopped } from "./notifications";
import { setAppIcon, iconForWeatherCode } from "./appIcon";

export const RAIN_TASK = "rainalert-weather-check";

async function resolveCoords(): Promise<{ latitude: number; longitude: number }> {
  const last = await Location.getLastKnownPositionAsync().catch(() => null);
  if (last) {
    return {
      latitude: last.coords.latitude,
      longitude: last.coords.longitude,
    };
  }
  const home = await loadHome();
  return { latitude: home.latitude, longitude: home.longitude };
}

/** One weather check; returns the rain event if one fired. */
export async function checkWeatherOnce(): Promise<"rain_started" | "rain_stopped" | null> {
  const enabled = await loadEnabled();
  if (!enabled) return null;
  const coords = await resolveCoords();
  const current = await fetchCurrentWeather(coords.latitude, coords.longitude);
  // Keep the launcher icon matched to the sky (sun / cloud / rain).
  await setAppIcon(
    iconForWeatherCode(current.weatherCode, isRaining(current))
  );
  const prev = await loadEngine();
  const { next, event } = updateEngine(
    prev,
    isRaining(current),
    new Date().toISOString()
  );
  await saveEngine(next);
  if (event === "rain_started") await notifyRainStarted();
  else if (event === "rain_stopped") await notifyRainStopped();
  return event;
}

TaskManager.defineTask(RAIN_TASK, async () => {
  try {
    await checkWeatherOnce();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    // The watchdog must never crash the task.
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerWatchdog(): Promise<void> {
  const registered = await TaskManager.isTaskRegisteredAsync(RAIN_TASK);
  if (!registered) {
    await BackgroundFetch.registerTaskAsync(RAIN_TASK, {
      minimumInterval: 15 * 60, // seconds; Android enforces ~15 min minimum
      stopOnTerminate: false,
      startOnBoot: true,
    });
  }
}

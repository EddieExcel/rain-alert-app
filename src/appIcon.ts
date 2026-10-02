import { NativeModules, Platform } from "react-native";

export type AppIconKind = "sun" | "cloud" | "rain" | "default";

const { AppIcon } = NativeModules;

let lastIcon: AppIconKind | null = null;

/**
 * Switch the Android launcher icon. No-op on iOS and when the native module
 * is unavailable. Icon switching is cosmetic — failures never throw.
 */
export async function setAppIcon(kind: AppIconKind): Promise<void> {
  if (Platform.OS !== "android" || !AppIcon?.setIcon) return;
  if (kind === lastIcon) return;
  lastIcon = kind;
  try {
    await AppIcon.setIcon(kind);
  } catch {
    // ignore — never break the weather check over an icon
  }
}

/**
 * Map an Open-Meteo WMO weather code to a launcher icon.
 * 0/1 clear -> sun; 2/3/45/48 cloudy/fog -> cloud; precipitation -> rain.
 */
export function iconForWeatherCode(
  weatherCode: number,
  raining: boolean
): AppIconKind {
  if (raining) return "rain";
  if (weatherCode === 0 || weatherCode === 1) return "sun";
  return "cloud";
}

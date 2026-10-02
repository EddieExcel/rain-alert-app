import AsyncStorage from "@react-native-async-storage/async-storage";
import { EngineState, INITIAL_ENGINE_STATE } from "./engine";

const K_ENGINE = "rain-alert:engine";
const K_ENABLED = "rain-alert:enabled";
const K_HOME = "rain-alert:home";

export interface HomeCoords {
  latitude: number;
  longitude: number;
  label: string;
}

export const DEFAULT_HOME: HomeCoords = {
  latitude: 29.1055,
  longitude: -80.9716,
  label: "Port Orange, FL",
};

export async function loadEngine(): Promise<EngineState> {
  try {
    const raw = await AsyncStorage.getItem(K_ENGINE);
    if (!raw) return INITIAL_ENGINE_STATE;
    const j = JSON.parse(raw);
    return {
      state: j.state === "raining" || j.state === "dry" ? j.state : "unknown",
      dryStreak: Number(j.dryStreak) || 0,
      lastCheckIso: typeof j.lastCheckIso === "string" ? j.lastCheckIso : null,
    };
  } catch {
    return INITIAL_ENGINE_STATE;
  }
}

export async function saveEngine(s: EngineState): Promise<void> {
  await AsyncStorage.setItem(K_ENGINE, JSON.stringify(s));
}

export async function loadEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(K_ENABLED);
  return raw !== "0"; // on by default
}

export async function saveEnabled(on: boolean): Promise<void> {
  await AsyncStorage.setItem(K_ENABLED, on ? "1" : "0");
}

export async function loadHome(): Promise<HomeCoords> {
  try {
    const raw = await AsyncStorage.getItem(K_HOME);
    if (!raw) return DEFAULT_HOME;
    const j = JSON.parse(raw);
    if (typeof j.latitude === "number" && typeof j.longitude === "number") {
      return {
        latitude: j.latitude,
        longitude: j.longitude,
        label: typeof j.label === "string" ? j.label : "Custom location",
      };
    }
  } catch {
    /* fall through */
  }
  return DEFAULT_HOME;
}

export async function saveHome(h: HomeCoords): Promise<void> {
  await AsyncStorage.setItem(K_HOME, JSON.stringify(h));
}

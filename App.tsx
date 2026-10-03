import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";

/** Android draws edge-to-edge (RN's SafeAreaView is iOS-only), so pad the
 *  root containers by the status-bar height to keep content below the
 *  clock/icons. */
const TOP_PAD = Platform.OS === "android" ? RNStatusBar.currentHeight ?? 0 : 0;
import * as Application from "expo-application";
import * as Location from "expo-location";
import {
  ensureNotificationPermission,
  setupAndroidChannel,
} from "./src/notifications";
import { checkWeatherOnce, registerWatchdog } from "./src/watchdog";
import { EngineState, INITIAL_ENGINE_STATE } from "./src/engine";
import {
  DEFAULT_HOME,
  HomeCoords,
  loadEnabled,
  loadEngine,
  loadHome,
  saveEnabled,
  saveHome,
} from "./src/storage";

async function ensureLocation(): Promise<boolean> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") return false;
  // Background access lets the watchdog use last-known position when the
  // app is closed. If denied, the watchdog falls back to home coords.
  await Location.requestBackgroundPermissionsAsync().catch(() => null);
  return true;
}

function describeState(s: EngineState): string {
  if (s.state === "raining") return "Raining";
  if (s.state === "dry") return "Dry";
  return "Not checked yet";
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [engine, setEngine] = useState<EngineState>(INITIAL_ENGINE_STATE);
  const [enabled, setEnabled] = useState(true);
  const [home, setHome] = useState<HomeCoords>(DEFAULT_HOME);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setEngine(await loadEngine());
    setEnabled(await loadEnabled());
    setHome(await loadHome());
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const ok = await ensureNotificationPermission();
        if (!ok) setError("Notifications are off — alerts can't speak.");
        await setupAndroidChannel();
        await ensureLocation();
        await registerWatchdog();
        await refresh();
      } catch (e: any) {
        setError(String(e?.message ?? e));
      } finally {
        setReady(true);
      }
    })();
  }, [refresh]);

  const onCheckNow = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    try {
      // checkWeatherOnce fires the spoken alert itself via notifyRainStarted/
      // notifyRainStopped when a rain event occurs — no extra Speech.speak
      // here or it would say everything twice.
      const event = await checkWeatherOnce();
      await refresh();
      if (event === "rain_started") {
        setNotice("Rain started — alert spoken.");
      } else if (event === "rain_stopped") {
        setNotice("Rain stopped — alert spoken.");
      } else {
        setNotice("Checked — no change.");
      }
    } catch (e: any) {
      setNotice(`Check failed: ${String(e?.message ?? e)}`);
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const onToggle = useCallback(
    async (v: boolean) => {
      setEnabled(v);
      await saveEnabled(v);
    },
    []
  );

  const onSetHome = useCallback(async () => {
    setBusy(true);
    try {
      const pos = await Location.getCurrentPositionAsync({});
      const h: HomeCoords = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        label: "Saved location",
      };
      await saveHome(h);
      setHome(h);
      setNotice("Home location saved to your current position.");
    } catch (e: any) {
      setNotice(`Couldn't get position: ${String(e?.message ?? e)}`);
    } finally {
      setBusy(false);
    }
  }, []);

  if (!ready) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.sub}>Starting Rain Alert…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>Rain Alert</Text>
        <Text style={styles.version}>
          v{Application.nativeApplicationVersion ?? "?"} (build{" "}
          {Application.nativeBuildVersion ?? "?"})
        </Text>
        <Text style={styles.sub}>
          Speaks when rain starts and stops at your location.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Right now</Text>
          <Text style={styles.big}>{describeState(engine)}</Text>
          <Text style={styles.dim}>
            {engine.lastCheckIso
              ? `Last check: ${new Date(engine.lastCheckIso).toLocaleString()}`
              : "No check yet — tap Check now."}
          </Text>
          <Text style={styles.dim}>Fallback location: {home.label}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Spoken alerts</Text>
          <Switch value={enabled} onValueChange={onToggle} />
        </View>

        <TouchableOpacity
          style={[styles.button, busy && styles.buttonDim]}
          onPress={onCheckNow}
          disabled={busy}
        >
          <Text style={styles.buttonText}>
            {busy ? "Checking…" : "Check now"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkButton} onPress={onSetHome}>
          <Text style={styles.linkText}>Save current position as home</Text>
        </TouchableOpacity>

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <Text style={styles.foot}>
          Checks about every 15 minutes in the background. Rain-stop alerts
          wait for two dry checks in a row so a brief lull doesn't trigger
          them.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0f2233", paddingTop: TOP_PAD },
  center: {
    flex: 1,
    backgroundColor: "#0f2233",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: TOP_PAD,
  },
  body: { padding: 20, gap: 14 },
  title: { color: "#fff", fontSize: 28, fontWeight: "700" },
  version: { color: "#5b7186", fontSize: 13 },
  sub: { color: "#9fb3c8", fontSize: 14 },
  error: { color: "#ff8a80", fontSize: 14 },
  card: {
    backgroundColor: "#16324a",
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  cardLabel: { color: "#9fb3c8", fontSize: 12, textTransform: "uppercase" },
  big: { color: "#fff", fontSize: 34, fontWeight: "700" },
  dim: { color: "#9fb3c8", fontSize: 13 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#16324a",
    borderRadius: 12,
    padding: 14,
  },
  rowLabel: { color: "#fff", fontSize: 16 },
  button: {
    backgroundColor: "#2f81f7",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  buttonDim: { opacity: 0.6 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  linkButton: { padding: 10, alignItems: "center" },
  linkText: { color: "#2f81f7", fontSize: 14 },
  notice: { color: "#ffd479", fontSize: 14, textAlign: "center" },
  foot: { color: "#5b7186", fontSize: 12, marginTop: 8 },
});

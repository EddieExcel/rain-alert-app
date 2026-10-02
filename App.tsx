import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as Application from "expo-application";
import * as Notifications from "expo-notifications";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import {
  ensureNotificationPermission,
  setupAndroidChannel,
  notifyRainStarted,
  notifyRainStopped,
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
  const [channels, setChannels] = useState<string | null>(null);

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
      const event = await checkWeatherOnce();
      await refresh();
      if (event === "rain_started") {
        Speech.speak("It is raining.");
        setNotice("Rain started — alert spoken.");
      } else if (event === "rain_stopped") {
        Speech.speak("It has stopped raining.");
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

  const onVoiceTest = useCallback(() => {
    Speech.speak("It is raining.");
  }, []);

  const onCheckChannels = useCallback(async () => {
    try {
      const list = await Notifications.getNotificationChannelsAsync();
      if (list.length === 0) {
        setChannels("No notification channels found.");
      } else {
        setChannels(
          list.map((c) => `${c.id}: sound=${c.sound}`).join("\n")
        );
      }
    } catch (e: any) {
      setChannels(`error: ${String(e?.message ?? e)}`);
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

        <Text style={styles.section}>Hear what the alerts sound like</Text>
        <View style={styles.testRow}>
          <TouchableOpacity
            style={styles.testButton}
            onPress={() => notifyRainStarted()}
          >
            <Text style={styles.buttonText}>Rain started</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.testButton}
            onPress={() => notifyRainStopped()}
          >
            <Text style={styles.buttonText}>Rain stopped</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.section}>Diagnostics</Text>
        <View style={styles.testRow}>
          <TouchableOpacity style={styles.testButton} onPress={onVoiceTest}>
            <Text style={styles.buttonText}>Voice test</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.testButton}
            onPress={onCheckChannels}
          >
            <Text style={styles.buttonText}>Check channels</Text>
          </TouchableOpacity>
        </View>
        {channels ? <Text style={styles.dim}>{channels}</Text> : null}

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
  root: { flex: 1, backgroundColor: "#0f2233" },
  center: {
    flex: 1,
    backgroundColor: "#0f2233",
    alignItems: "center",
    justifyContent: "center",
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
  section: { color: "#9fb3c8", fontSize: 14, marginTop: 6 },
  testRow: { flexDirection: "row", gap: 10 },
  testButton: {
    flex: 1,
    backgroundColor: "#1c4d2e",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  linkButton: { padding: 10, alignItems: "center" },
  linkText: { color: "#2f81f7", fontSize: 14 },
  notice: { color: "#ffd479", fontSize: 14, textAlign: "center" },
  foot: { color: "#5b7186", fontSize: 12, marginTop: 8 },
});

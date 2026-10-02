# Rain Alert

A phone app that **speaks** when rain starts and stops at your location.

## How it works

- A background task checks [Open-Meteo](https://open-meteo.com) (free, no key)
  about every 15 minutes at your phone's location (falls back to a saved home
  location).
- Rain start alerts fire on the first rainy reading after a dry spell.
- Rain stop alerts wait for two dry readings in a row, so a brief lull in a
  storm doesn't trigger them.
- The spoken alert is a pre-recorded voice line played as the notification's
  **custom sound** (`assets/sounds/rain_started.mp3` /
  `rain_stopped.mp3`, bundled to Android `res/raw` by the
  `plugins/withRainSounds` config plugin) — the phone literally says
  "Rain has started" / "The rain has stopped", even with the screen off.

## Screens

- Dashboard: current status (Raining / Dry), last check time, fallback
  location.
- Spoken alerts on/off toggle.
- "Check now" — manual check; also speaks via the speaker if the app is open.
- "Hear what the alerts sound like" — fires each real notification so you
  hear exactly what the background alert sounds like.
- "Save current position as home" — sets the fallback location.

## Build

Dev build required for the background task (Expo Go throttles background
fetch):

```sh
npm install
npx expo prebuild
cd android && ./gradlew assembleDebug
```

Install `android/app/build/outputs/apk/debug/app-debug.apk` on the phone.
Grant notification + location ("Allow all the time") permissions on first
launch.

## Notes

- Android enforces a ~15 minute minimum on background fetch intervals.
- `expo-speech` is only used in the foreground; background alerts use the
  notification custom sound because speech from a background task is
  unreliable.
- iOS: sounds fall back to the default notification sound (custom iOS
  bundling not wired).

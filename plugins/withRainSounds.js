/**
 * Expo config plugin: bundles the spoken rain alert sounds as Android
 * notification sounds (res/raw) so alerts literally speak the message
 * even when the screen is off.
 */
const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const SOUNDS = ["rain_started", "rain_stopped"];

module.exports = function withRainSounds(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const rawDir = path.join(
        projectRoot,
        "android",
        "app",
        "src",
        "main",
        "res",
        "raw"
      );
      await fs.promises.mkdir(rawDir, { recursive: true });
      for (const name of SOUNDS) {
        const src = path.join(projectRoot, "assets", "sounds", `${name}.mp3`);
        const dest = path.join(rawDir, `${name}.mp3`);
        await fs.promises.copyFile(src, dest);
      }
      return config;
    },
  ]);
};

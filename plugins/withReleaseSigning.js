/**
 * Expo config plugin: signs Android release builds with the HelpExcel
 * upload key instead of the debug key.
 *
 * The keystore itself and the MYAPP_UPLOAD_* credentials stay VPS-only
 * (android/gradle.properties on the build machine, never committed).
 * Without those properties present, `assembleRelease` will fail loudly
 * rather than silently shipping a debug-signed APK.
 *
 * Also pins versionCode / versionName from the Expo config, because
 * prebuild regenerates android/app/build.gradle from scratch.
 */
const { withAppBuildGradle } = require("@expo/config-plugins");

const SIGNING_BLOCK = `        release {
            if (project.hasProperty('MYAPP_UPLOAD_STORE_FILE')) {
                storeFile file(MYAPP_UPLOAD_STORE_FILE)
                storePassword MYAPP_UPLOAD_STORE_PASSWORD
                keyAlias MYAPP_UPLOAD_KEY_ALIAS
                keyPassword MYAPP_UPLOAD_KEY_PASSWORD
            }
        }
`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    let gradle = config.modResults.contents;

    // 1. Add the release signingConfigs block (idempotent).
    if (!gradle.includes("MYAPP_UPLOAD_STORE_FILE")) {
      const anchor = `            keyPassword 'android'
        }
    }`;
      gradle = gradle.replace(
        anchor,
        `            keyPassword 'android'
        }
${SIGNING_BLOCK}    }`
      );
    }

    // 2. Point the release buildType at the release signing config.
    //    The stock template points it at signingConfigs.debug.
    gradle = gradle.replace(
      "            signingConfig signingConfigs.debug\n            def enableShrinkResources",
      "            signingConfig signingConfigs.release\n            def enableShrinkResources"
    );

    // 3. Pin versionCode / versionName from the Expo config.
    const versionCode = config.android?.versionCode ?? 1;
    const versionName = config.version ?? "1.0.0";
    gradle = gradle.replace(/versionCode \d+/, `versionCode ${versionCode}`);
    gradle = gradle.replace(/versionName "[^"]*"/, `versionName "${versionName}"`);

    config.modResults.contents = gradle;
    return config;
  });
};

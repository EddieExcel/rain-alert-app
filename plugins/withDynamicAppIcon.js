/**
 * Expo config plugin: dynamic launcher icons for Rain Alert.
 *
 * Adds three <activity-alias> entries (Sun / Cloud / Rain) to the Android
 * manifest, each with its own launcher icon, plus a tiny native module
 * (AppIcon) that flips which component is enabled via PackageManager.
 * JS calls AppIcon.setIcon("sun" | "cloud" | "rain" | "default") after each
 * weather check; "default" re-enables MainActivity's own launcher entry.
 */
const {
  withAndroidManifest,
  withDangerousMod,
  withMainApplication,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const PACKAGE = "com.eddieexcel.rainalert";
const ICONS = [
  { alias: "SunIcon", mipmap: "ic_sun", file: "ic_sun.png" },
  { alias: "CloudIcon", mipmap: "ic_cloud", file: "ic_cloud.png" },
  { alias: "RainIcon", mipmap: "ic_rain", file: "ic_rain.png" },
];

const APP_ICON_MODULE_JAVA = `package ${PACKAGE};

import android.content.ComponentName;
import android.content.pm.PackageManager;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

/** Switches the launcher icon by enabling one activity-alias at a time. */
public class AppIconModule extends ReactContextBaseJavaModule {
  private static final String[] ALIASES = {"SunIcon", "CloudIcon", "RainIcon"};

  public AppIconModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @Override
  public String getName() {
    return "AppIcon";
  }

  @ReactMethod
  public void setIcon(String kind, Promise promise) {
    try {
      ReactApplicationContext ctx = getReactApplicationContext();
      PackageManager pm = ctx.getPackageManager();
      String pkg = ctx.getPackageName();
      String target = null;
      if ("sun".equals(kind)) target = "SunIcon";
      else if ("cloud".equals(kind)) target = "CloudIcon";
      else if ("rain".equals(kind)) target = "RainIcon";
      // "default" (or anything else) falls back to MainActivity's own icon.

      setComponent(pm, pkg, pkg + ".MainActivity",
          target == null ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                         : PackageManager.COMPONENT_ENABLED_STATE_DISABLED);
      for (String alias : ALIASES) {
        setComponent(pm, pkg, pkg + "." + alias,
            alias.equals(target) ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                                 : PackageManager.COMPONENT_ENABLED_STATE_DISABLED);
      }
      promise.resolve(true);
    } catch (Exception e) {
      promise.reject("APP_ICON_ERROR", e.getMessage());
    }
  }

  private void setComponent(PackageManager pm, String pkg, String cls, int state) {
    pm.setComponentEnabledSetting(
        new ComponentName(pkg, cls), state, PackageManager.DONT_KILL_APP);
  }
}
`;

const APP_ICON_PACKAGE_JAVA = `package ${PACKAGE};

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class AppIconPackage implements ReactPackage {
  @Override
  public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
    List<NativeModule> modules = new ArrayList<>();
    modules.add(new AppIconModule(reactContext));
    return modules;
  }

  @Override
  public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
    return Collections.emptyList();
  }
}
`;

function withAppIconResources(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const destDir = path.join(
        projectRoot, "android", "app", "src", "main", "res", "mipmap-xxxhdpi"
      );
      await fs.promises.mkdir(destDir, { recursive: true });
      for (const icon of ICONS) {
        await fs.promises.copyFile(
          path.join(projectRoot, "assets", "icons", icon.file),
          path.join(destDir, icon.file)
        );
      }

      // Native module sources (plain React Native module, no autolinking).
      const javaDir = path.join(
        projectRoot, "android", "app", "src", "main", "java",
        ...PACKAGE.split(".")
      );
      await fs.promises.mkdir(javaDir, { recursive: true });
      await fs.promises.writeFile(
        path.join(javaDir, "AppIconModule.java"), APP_ICON_MODULE_JAVA
      );
      await fs.promises.writeFile(
        path.join(javaDir, "AppIconPackage.java"), APP_ICON_PACKAGE_JAVA
      );
      return config;
    },
  ]);
}

function withAppIconManifest(config) {
  return withAndroidManifest(config, async (config) => {
    const application = config.modResults.manifest.application[0];
    application["activity-alias"] = application["activity-alias"] || [];
    const existing = new Set(
      (application["activity-alias"] || []).map(
        (a) => a.$["android:name"]
      )
    );
    for (const icon of ICONS) {
      const name = `${PACKAGE}.${icon.alias}`;
      if (existing.has(name)) continue;
      application["activity-alias"].push({
        $: {
          "android:name": name,
          "android:enabled": "false",
          "android:exported": "true",
          "android:icon": `@mipmap/${icon.mipmap}`,
          "android:targetActivity": `${PACKAGE}.MainActivity`,
        },
        "intent-filter": [
          {
            action: [
              { $: { "android:name": "android.intent.action.MAIN" } },
            ],
            category: [
              {
                $: { "android:name": "android.intent.category.LAUNCHER" },
              },
            ],
          },
        ],
      });
    }
    return config;
  });
}

function withAppIconPackage(config) {
  return withMainApplication(config, async (config) => {
    let src = config.modResults.contents;
    if (src.includes("AppIconPackage()")) return config; // already patched
    const anchor = "// packages.add(MyReactNativePackage())";
    if (src.includes(anchor)) {
      src = src.replace(anchor, "packages.add(AppIconPackage())");
    } else {
      // Fallback: append after the autolinked package list is built.
      const alt = "val packages = PackageList(this).packages";
      if (src.includes(alt)) {
        src = src.replace(
          alt,
          `${alt}\n    packages.add(AppIconPackage())`
        );
      }
    }
    config.modResults.contents = src;
    return config;
  });
}

module.exports = function withDynamicAppIcon(config) {
  config = withAppIconResources(config);
  config = withAppIconManifest(config);
  config = withAppIconPackage(config);
  return config;
};

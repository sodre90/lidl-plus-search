// `expo prebuild` regenerates android/app/build.gradle from a template, so
// release-build settings have to be reapplied as a config plugin rather than
// edited in place. This one makes release builds use a real signing key: the
// keystore is passed in through gradle properties instead of the template's
// *debug* keystore, falling back to the debug key when those properties are
// absent so a plain local `expo run:android` still works. The properties come
// from .github/workflows/release.yml; see mobile/README.md for the keystore.
//
// The ABI set is *not* handled here: `ndk.abiFilters` does not filter the
// prebuilt .so files inside React Native's AARs. Release builds pass
// `-PreactNativeArchitectures=armeabi-v7a,arm64-v8a` on the gradle command line
// instead, which drops the emulator-only x86 libs (44 MB of a 100 MB APK)
// without affecting local debug builds.

const { withAppBuildGradle } = require("@expo/config-plugins");

const RELEASE_SIGNING_CONFIG = `        release {
            if (project.hasProperty('LIDL_UPLOAD_STORE_FILE')) {
                storeFile file(LIDL_UPLOAD_STORE_FILE)
                storePassword LIDL_UPLOAD_STORE_PASSWORD
                keyAlias LIDL_UPLOAD_KEY_ALIAS
                keyPassword LIDL_UPLOAD_KEY_PASSWORD
            } else {
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }
`;

const DEBUG_SIGNING_CONFIG = `        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
`;

function addReleaseSigningConfig(gradle) {
  if (gradle.includes("LIDL_UPLOAD_STORE_FILE")) return gradle;
  if (!gradle.includes(DEBUG_SIGNING_CONFIG)) {
    throw new Error(
      "withAndroidRelease: could not find the generated debug signingConfig in " +
        "android/app/build.gradle. The Expo template changed; update this plugin.",
    );
  }
  return gradle.replace(DEBUG_SIGNING_CONFIG, DEBUG_SIGNING_CONFIG + RELEASE_SIGNING_CONFIG);
}

function useReleaseKeyForReleaseBuilds(gradle) {
  const marker = "        release {\n            // Caution! In production, you need to generate your own keystore file.";
  if (!gradle.includes(marker)) {
    throw new Error(
      "withAndroidRelease: could not find the release buildType's debug signingConfig. " +
        "The Expo template changed; update this plugin.",
    );
  }
  const start = gradle.indexOf(marker);
  const head = gradle.slice(0, start);
  const tail = gradle.slice(start).replace("signingConfig signingConfigs.debug", "signingConfig signingConfigs.release");
  return head + tail;
}

module.exports = function withAndroidRelease(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") {
      throw new Error("withAndroidRelease: expected a Groovy build.gradle");
    }
    cfg.modResults.contents = useReleaseKeyForReleaseBuilds(
      addReleaseSigningConfig(cfg.modResults.contents),
    );
    return cfg;
  });
};

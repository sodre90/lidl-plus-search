import { ExpoConfig, ConfigContext } from "expo/config";

// Expo app configuration. This is an UNOFFICIAL Lidl Plus client; it talks
// directly to the Lidl backend from the device and stores everything locally.
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Lidl Receipts",
  slug: "lidl-receipts",
  scheme: "lidlreceipts",
  version: "0.3.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#0050aa",
  },
  ios: {
    bundleIdentifier: "com.sodre90.lidlreceipts",
    supportsTablet: true,
    infoPlist: {
      // We only talk to https endpoints; no arbitrary cleartext needed.
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "com.sodre90.lidlreceipts",
    // Android refuses to install an equal or lower versionCode over an existing
    // install. CI derives it from the release tag; 1 is the local default.
    versionCode: Number(process.env.ANDROID_VERSION_CODE ?? 1),
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0050aa",
    },
    // The app only makes https calls; deny everything the autolinked libraries
    // would otherwise pull into the manifest.
    permissions: ["android.permission.INTERNET"],
    blockedPermissions: [
      "android.permission.RECORD_AUDIO",
      "android.permission.CAMERA",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.SYSTEM_ALERT_WINDOW",
    ],
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-sqlite",
    "expo-font",
    "expo-asset",
    "./plugins/withAndroidRelease",
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    // Defaults; overridable at runtime in Settings.
    defaultCountry: "HU",
    defaultLanguage: "hu-HU",
  },
});

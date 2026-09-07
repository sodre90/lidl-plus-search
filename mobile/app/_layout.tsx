// Root layout: global providers, the navigation stack, and the auth gate that
// redirects between the login screen and the main tabs.

import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../src/auth/AuthContext";
import { SyncProvider } from "../src/sync/SyncContext";
import { ErrorBoundary } from "../src/ui/ErrorBoundary";
import { useTheme } from "../src/ui/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const { colors, dark } = useTheme();
  // Every icon in the app is an Ionicons glyph. Without preloading the font the
  // tab bar renders before it resolves and the glyphs come out invisible —
  // unnoticeable in dev, where Metro serves the font instantly.
  const [fontsLoaded] = useFonts(Ionicons.font);

  const ready = status !== "loading" && fontsLoaded;

  useEffect(() => {
    if (!ready) return;
    SplashScreen.hideAsync().catch(() => {});

    const onLogin = segments[0] === "login";
    if (status === "signedOut" && !onLogin) {
      router.replace("/login");
    } else if (status === "signedIn" && onLogin) {
      router.replace("/");
    }
  }, [ready, status, segments, router]);

  // Hold the splash screen rather than flashing a half-drawn, icon-less UI.
  if (!ready) return null;

  return (
    <>
      <StatusBar style={dark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="receipt/[id]" options={{ title: "Receipt" }} />
        <Stack.Screen name="item/[name]" options={{ title: "Price history" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <AuthProvider>
            <SyncProvider>
              <RootNavigator />
            </SyncProvider>
          </AuthProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

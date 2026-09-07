// Root layout: global providers, the navigation stack, and the auth gate that
// redirects between the login screen and the main tabs.

import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
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
  // The icon font is embedded natively (see the expo-font plugin in
  // app.config.ts), so it is ready before the first render and nothing here has
  // to wait on it. Deliberately no runtime font loading: expo-font's loadAsync
  // hangs in release builds without ever resolving or erroring, and gating the
  // UI on it left the app stuck on the splash screen.
  const ready = status !== "loading";

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

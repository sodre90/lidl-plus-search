// Sign-in screen. Opens the Lidl authorize page in an in-app WebView and
// intercepts the `com.lidlplus.app://callback?code=...` redirect (the official
// app's scheme), then exchanges the code for tokens. This mirrors how the Go
// tool captures the redirect via chromedp, and avoids relying on OS deep-link
// routing (which is ambiguous when the official Lidl app is installed).

import { useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, View } from "react-native";
import { WebView, type WebViewNavigation } from "react-native-webview";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Screen } from "../src/ui/Screen";
import { Txt } from "../src/ui/Text";
import { Button } from "../src/ui/Button";
import { radius, spacing, useTheme } from "../src/ui/theme";
import { authorizeURL, exchangeCode, extractCode, isCallbackURL, newPKCE, randomState, type PKCE } from "../src/lidl/auth";
import { useAuth } from "../src/auth/AuthContext";

export default function LoginScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn, country, language } = useAuth();

  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pkceRef = useRef<PKCE | null>(null);
  const stateRef = useRef<string>("");
  const handledRef = useRef(false);

  const beginLogin = async () => {
    setError(null);
    setBusy(true);
    try {
      const pkce = await newPKCE();
      const state = await randomState();
      pkceRef.current = pkce;
      stateRef.current = state;
      handledRef.current = false;
      setAuthUrl(authorizeURL(pkce, country, language, state));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // Called for every navigation; returns false to block loading the callback.
  const onShouldStart = (req: { url: string }): boolean => {
    if (isCallbackURL(req.url)) {
      void completeLogin(req.url);
      return false;
    }
    return true;
  };

  const onNavChange = (nav: WebViewNavigation) => {
    if (isCallbackURL(nav.url)) void completeLogin(nav.url);
  };

  const completeLogin = async (url: string) => {
    if (handledRef.current) return;
    handledRef.current = true;
    setAuthUrl(null);
    setBusy(true);
    try {
      const code = extractCode(url, stateRef.current);
      const tr = await exchangeCode(code, pkceRef.current!.verifier);
      await signIn(tr); // root layout redirects to the tabs
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: "center", gap: spacing.xl }}>
        <View style={{ alignItems: "center", gap: spacing.lg }}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: radius.lg,
              backgroundColor: colors.primary,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="receipt" size={48} color={colors.accent} />
          </View>
          <View style={{ alignItems: "center", gap: spacing.xs }}>
            <Txt variant="title">Lidl Receipts</Txt>
            <Txt variant="muted" style={{ textAlign: "center" }}>
              Sync, browse and search your Lidl Plus receipts — all on your device.
            </Txt>
          </View>
        </View>

        <Button
          title="Sign in with Lidl Plus"
          icon="log-in-outline"
          onPress={beginLogin}
          loading={busy}
        />

        {error ? (
          <Txt variant="caption" color={colors.danger} style={{ textAlign: "center" }}>
            {error}
          </Txt>
        ) : null}

        <Txt variant="caption" style={{ textAlign: "center" }}>
          Unofficial app. It talks directly to Lidl Plus using your own account and
          stores everything locally. Nothing is sent anywhere else.
        </Txt>
      </View>

      <Modal visible={authUrl != null} animationType="slide" onRequestClose={() => setAuthUrl(null)}>
        <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              padding: spacing.md,
            }}
          >
            <Txt variant="heading">Sign in</Txt>
            <Pressable onPress={() => setAuthUrl(null)} hitSlop={12}>
              <Ionicons name="close" size={26} color={colors.text} />
            </Pressable>
          </View>
          {authUrl ? (
            <WebView
              source={{ uri: authUrl }}
              originWhitelist={["*"]}
              onShouldStartLoadWithRequest={onShouldStart}
              onNavigationStateChange={onNavChange}
              incognito
              startInLoadingState
              renderLoading={() => (
                <View style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" }}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              )}
            />
          ) : null}
        </View>
      </Modal>
    </Screen>
  );
}

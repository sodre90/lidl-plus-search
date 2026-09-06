// Settings: country/language, sync options, stored-data summary, sign out.

import { useEffect, useState } from "react";
import { Alert, TextInput, View } from "react-native";
import Constants from "expo-constants";
import { Screen } from "../../src/ui/Screen";
import { Txt } from "../../src/ui/Text";
import { Card } from "../../src/ui/Card";
import { Button } from "../../src/ui/Button";
import { SyncBar } from "../../src/ui/SyncBar";
import { radius, spacing, useTheme } from "../../src/ui/theme";
import { useAuth } from "../../src/auth/AuthContext";
import { useStats } from "../../src/hooks/queries";
import { useSync } from "../../src/sync/SyncContext";

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { country, language, updateCountry, updateLanguage, signOut } = useAuth();
  const stats = useStats();
  const sync = useSync();

  const [countryInput, setCountryInput] = useState(country);
  const [languageInput, setLanguageInput] = useState(language);
  const [since, setSince] = useState("");

  useEffect(() => setCountryInput(country), [country]);
  useEffect(() => setLanguageInput(language), [language]);

  const field = {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 15,
  } as const;

  const saveRegion = async () => {
    const c = countryInput.trim().toUpperCase();
    const l = languageInput.trim();
    if (!/^[A-Z]{2}$/.test(c)) {
      Alert.alert("Invalid country", "Use the 2-letter Lidl country code, e.g. HU.");
      return;
    }
    if (l === "") {
      Alert.alert("Invalid language", "Enter a language code, e.g. hu-HU.");
      return;
    }
    setCountryInput(c);
    await updateCountry(c);
    await updateLanguage(l);
    Alert.alert("Saved", "Country and language updated.");
  };

  // 5b. A malformed date used to be compared as a plain string, silently making
  //     the cutoff match everything or nothing.
  const syncSince = () => {
    const d = since.trim();
    if (d === "") {
      Alert.alert("No date", "Enter a date as YYYY-MM-DD, or use Sync now.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) {
      Alert.alert("Invalid date", "Use the YYYY-MM-DD format, e.g. 2026-01-31.");
      return;
    }
    void sync.start({ since: d });
  };

  const confirmSignOut = () => {
    Alert.alert("Sign out", "Keep the downloaded receipts on this device?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", onPress: () => signOut() },
      { text: "Sign out & wipe", style: "destructive", onPress: () => signOut({ wipe: true }) },
    ]);
  };

  return (
    <Screen scroll>
      <Txt variant="title">Settings</Txt>

      <SyncBar />

      <Card style={{ gap: spacing.md }}>
        <Txt variant="heading">More sync options</Txt>
        <Txt variant="muted">
          Full re-sync re-downloads and re-parses everything. “Sync since” fetches only
          receipts on/after a date.
        </Txt>
        <Button
          title="Full re-sync"
          variant="outline"
          icon="refresh"
          disabled={sync.running}
          onPress={() =>
            Alert.alert("Full re-sync", "Re-download and re-parse every receipt? This can take a while.", [
              { text: "Cancel", style: "cancel" },
              { text: "Re-sync", onPress: () => void sync.start({ full: true }) },
            ])
          }
        />
        <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "center" }}>
          <TextInput
            style={[field, { flex: 1 }]}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.subtext}
            value={since}
            onChangeText={setSince}
            autoCapitalize="none"
          />
          <View style={{ width: 140 }}>
            <Button
              title="Sync since"
              icon="calendar"
              disabled={sync.running}
              onPress={syncSince}
            />
          </View>
        </View>
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Txt variant="heading">Account region</Txt>
        <Txt variant="muted">Country is the 2-letter Lidl code (e.g. HU). Language e.g. hu-HU.</Txt>
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <TextInput
            style={[field, { flex: 1 }]}
            placeholder="Country"
            placeholderTextColor={colors.subtext}
            value={countryInput}
            onChangeText={setCountryInput}
            autoCapitalize="characters"
            maxLength={2}
          />
          <TextInput
            style={[field, { flex: 2 }]}
            placeholder="Language"
            placeholderTextColor={colors.subtext}
            value={languageInput}
            onChangeText={setLanguageInput}
            autoCapitalize="none"
          />
        </View>
        <Button title="Save region" onPress={saveRegion} />
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <Txt variant="heading">Stored data</Txt>
        <Txt variant="muted">
          {stats.data?.receipts ?? 0} receipts · {stats.data?.items ?? 0} items, stored locally on this device.
        </Txt>
      </Card>

      <Button title="Sign out" variant="danger" icon="log-out-outline" onPress={confirmSignOut} />

      <Txt variant="caption" style={{ textAlign: "center" }}>
        Lidl Receipts v{Constants.expoConfig?.version ?? "?"} · Unofficial. Not affiliated with Lidl.
      </Txt>
    </Screen>
  );
}

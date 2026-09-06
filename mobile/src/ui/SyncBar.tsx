// Sync control + live progress for the app-wide sync. Shows a progress bar while
// running and a "Sync now" button (with last-synced time) when idle. It reads the
// shared controller directly, so every instance reflects the same run.

import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "./Card";
import { Txt } from "./Text";
import { Button } from "./Button";
import { radius, spacing, useTheme } from "./theme";
import { formatSyncTime } from "../format";
import { useSync } from "../sync/SyncContext";

export function SyncBar() {
  const { colors } = useTheme();
  const { running, progress, note, error, lastSynced, start, cancel } = useSync();

  const processed = progress ? progress.fetched + progress.skipped : 0;
  const pct = progress && progress.total > 0 ? Math.min(1, processed / progress.total) : 0;

  return (
    <Card style={{ gap: spacing.md }}>
      {running ? (
        <>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Txt style={{ fontWeight: "700" }}>Syncing…</Txt>
            <Txt variant="caption">
              {processed}
              {progress && progress.total > 0 ? ` / ${progress.total}` : ""}
            </Txt>
          </View>
          <View style={{ height: 8, borderRadius: radius.pill, backgroundColor: colors.chartTrack, overflow: "hidden" }}>
            <View
              style={{
                height: "100%",
                width: `${Math.max(4, pct * 100)}%`,
                backgroundColor: colors.primary,
                borderRadius: radius.pill,
              }}
            />
          </View>
          <Txt variant="caption">
            {progress ? `${progress.fetched} new · ${progress.skipped} known · page ${progress.page}` : "Starting…"}
          </Txt>
          {note ? <Txt variant="caption" color={colors.danger}>{note}</Txt> : null}
          <Button title="Cancel" variant="outline" icon="close" onPress={cancel} />
        </>
      ) : (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Ionicons name="cloud-download-outline" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Txt style={{ fontWeight: "700" }}>Receipts</Txt>
              <Txt variant="caption">Last synced {formatSyncTime(lastSynced)}</Txt>
            </View>
          </View>
          {error ? <Txt variant="caption" color={colors.danger}>{error}</Txt> : null}
          <Button title="Sync now" icon="sync" onPress={() => start()} />
        </>
      )}
    </Card>
  );
}

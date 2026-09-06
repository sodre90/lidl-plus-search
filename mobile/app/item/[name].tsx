// Price history for one product: a unit-price line chart plus every occurrence.

import { useMemo } from "react";
import { FlatList, Pressable, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "../../src/ui/Card";
import { Txt } from "../../src/ui/Text";
import { LineChart } from "../../src/ui/LineChart";
import { EmptyState, Loading } from "../../src/ui/States";
import { radius, spacing, useTheme } from "../../src/ui/theme";
import { formatDate, formatMoney } from "../../src/format";
import { usePriceHistory } from "../../src/hooks/queries";

export default function ItemHistoryScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { data, loading } = usePriceHistory(name);

  const points = data ?? [];
  const currency = points[0]?.currency ?? "";

  const summary = useMemo(() => {
    const prices = points.map((p) => p.unitPrice).filter((p) => p > 0);
    if (prices.length === 0) return null;
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: prices.reduce((s, p) => s + p, 0) / prices.length,
      latest: points[points.length - 1].unitPrice,
    };
  }, [points]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: name }} />
      <FlatList
        data={points}
        keyExtractor={(_p, i) => String(i)}
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.sm,
          paddingBottom: insets.bottom + spacing.xl,
        }}
        ListHeaderComponent={
          points.length > 0 ? (
            <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
              <Card style={{ gap: spacing.sm }}>
                <Txt variant="heading" numberOfLines={2}>
                  {name}
                </Txt>
                <Txt variant="muted">
                  {points.length} purchases
                  {summary ? ` · latest ${formatMoney(summary.latest, currency)}` : ""}
                </Txt>
                <View style={{ marginTop: spacing.sm }}>
                  <LineChart data={points.map((p) => ({ value: p.unitPrice }))} currency={currency} />
                </View>
                {summary ? (
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm }}>
                    <Stat label="Min" value={formatMoney(summary.min, currency)} />
                    <Stat label="Avg" value={formatMoney(summary.avg, currency)} />
                    <Stat label="Max" value={formatMoney(summary.max, currency)} />
                  </View>
                ) : null}
              </Card>
              <Txt variant="heading">Purchases</Txt>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: "/receipt/[id]", params: { id: item.receiptId } })}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: colors.card,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing.md,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Txt variant="muted">{formatDate(item.date)}</Txt>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Txt style={{ fontWeight: "700" }}>{formatMoney(item.unitPrice, currency)}</Txt>
              <Ionicons name="chevron-forward" size={16} color={colors.subtext} />
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          loading ? <Loading /> : <EmptyState icon="trending-up-outline" title="No price history" />
        }
      />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Txt variant="caption">{label}</Txt>
      <Txt style={{ fontWeight: "700" }}>{value}</Txt>
    </View>
  );
}

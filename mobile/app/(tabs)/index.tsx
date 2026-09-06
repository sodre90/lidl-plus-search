// Dashboard: sync control, headline stats, monthly spend chart, recent receipts.

import { useMemo } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../src/ui/Screen";
import { Txt } from "../../src/ui/Text";
import { Card } from "../../src/ui/Card";
import { SummaryCard } from "../../src/ui/SummaryCard";
import { BarChart } from "../../src/ui/BarChart";
import { SyncBar } from "../../src/ui/SyncBar";
import { ReceiptListRow } from "../../src/ui/rows";
import { Loading, EmptyState } from "../../src/ui/States";
import { spacing } from "../../src/ui/theme";
import { currentMonthKey, fillMonthGaps, formatMoney, formatMonth, shortMonth } from "../../src/format";
import { useMonthly, useReceipts, useStats } from "../../src/hooks/queries";

export default function DashboardScreen() {
  const router = useRouter();
  const stats = useStats();
  const monthly = useMonthly();
  const recent = useReceipts(5);

  const months = monthly.data?.months ?? [];
  const currency = monthly.data?.currency ?? "";

  const totalSpent = useMemo(() => months.reduce((s, m) => s + m.total, 0), [months]);
  const thisMonth = useMemo(() => {
    const key = currentMonthKey();
    return months.find((m) => m.month === key)?.total ?? 0;
  }, [months]);

  const barData = useMemo(
    () =>
      fillMonthGaps(months, (month) => ({ month, total: 0, count: 0 })).map((m) => ({
        label: shortMonth(m.month),
        value: m.total,
        caption: formatMonth(m.month),
      })),
    [months],
  );

  const reloadAll = () => {
    stats.reload();
    monthly.reload();
    recent.reload();
  };

  const empty = (stats.data?.receipts ?? 0) === 0 && !stats.loading;

  return (
    <Screen scroll refreshing={stats.loading} onRefresh={reloadAll}>
      <Txt variant="title">Dashboard</Txt>

      <SyncBar />

      {empty ? (
        <Card>
          <EmptyState
            icon="cloud-download-outline"
            title="No receipts yet"
            subtitle="Tap “Sync now” to download your Lidl Plus receipts."
          />
        </Card>
      ) : (
        <>
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <SummaryCard icon="cash-outline" value={formatMoney(totalSpent, currency)} label="Total spent" />
            <SummaryCard icon="calendar-outline" value={formatMoney(thisMonth, currency)} label="This month" />
          </View>
          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <SummaryCard icon="receipt-outline" value={String(stats.data?.receipts ?? 0)} label="Receipts" />
            <SummaryCard icon="pricetags-outline" value={String(stats.data?.items ?? 0)} label="Items" />
          </View>

          {barData.length > 0 ? (
            <Card style={{ gap: spacing.xs }}>
              <Txt variant="muted">Monthly spend</Txt>
              <BarChart data={barData} currency={currency} />
            </Card>
          ) : null}

          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Txt variant="heading">Recent receipts</Txt>
              <Txt variant="muted" onPress={() => router.push("/receipts")}>
                See all
              </Txt>
            </View>
            {recent.loading && !recent.data ? (
              <Loading />
            ) : (
              (recent.data ?? []).map((r) => (
                <ReceiptListRow
                  key={r.id}
                  receipt={r}
                  onPress={() => router.push({ pathname: "/receipt/[id]", params: { id: r.id } })}
                />
              ))
            )}
          </View>
        </>
      )}
    </Screen>
  );
}

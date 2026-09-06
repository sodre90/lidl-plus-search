// All receipts, newest first. Tapping one opens its detail.

import { FlatList, RefreshControl, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Txt } from "../../src/ui/Text";
import { ReceiptListRow } from "../../src/ui/rows";
import { EmptyState, ErrorView, Loading } from "../../src/ui/States";
import { spacing, useTheme } from "../../src/ui/theme";
import { useReceipts } from "../../src/hooks/queries";

export default function ReceiptsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, loading, error, reload } = useReceipts(0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={data ?? []}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingTop: insets.top + spacing.lg,
          gap: spacing.sm,
          paddingBottom: insets.bottom + spacing.xl,
        }}
        ListHeaderComponent={<Txt variant="title" style={{ marginBottom: spacing.md }}>Receipts</Txt>}
        renderItem={({ item }) => (
          <ReceiptListRow
            receipt={item}
            onPress={() => router.push({ pathname: "/receipt/[id]", params: { id: item.id } })}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <Loading />
          ) : error ? (
            <ErrorView message={error} onRetry={reload} />
          ) : (
            <EmptyState
              icon="receipt-outline"
              title="No receipts yet"
              subtitle="Sync from the Dashboard to download them."
            />
          )
        }
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={colors.primary} />}
      />
    </View>
  );
}

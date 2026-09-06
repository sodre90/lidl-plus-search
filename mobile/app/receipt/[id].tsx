// One receipt's line items, with its date and total.

import { FlatList, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "../../src/ui/Card";
import { Txt } from "../../src/ui/Text";
import { ItemRow } from "../../src/ui/rows";
import { EmptyState, ErrorView, Loading } from "../../src/ui/States";
import { spacing, useTheme } from "../../src/ui/theme";
import { formatDate, formatMoney } from "../../src/format";
import { useReceiptItems } from "../../src/hooks/queries";

export default function ReceiptDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { data, loading, error, reload } = useReceiptItems(id);

  const items = data ?? [];
  const total = items.reduce((s, it) => s + it.totalPrice, 0);
  const currency = items[0]?.currency ?? "";
  const date = items[0]?.date ?? "";

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: date ? formatDate(date) : "Receipt" }} />
      <FlatList
        data={items}
        keyExtractor={(_it, i) => String(i)}
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.sm,
          paddingBottom: insets.bottom + spacing.xl,
        }}
        ListHeaderComponent={
          items.length > 0 ? (
            <Card style={{ marginBottom: spacing.md, gap: spacing.xs }}>
              <Txt variant="muted">{formatDate(date)}</Txt>
              <Txt variant="title">{formatMoney(total, currency)}</Txt>
              <Txt variant="muted">{items.length} items</Txt>
            </Card>
          ) : null
        }
        renderItem={({ item }) => (
          <ItemRow
            item={item}
            onPress={() => router.push({ pathname: "/item/[name]", params: { name: item.name } })}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <Loading />
          ) : error ? (
            <ErrorView message={error} onRetry={reload} />
          ) : (
            <EmptyState icon="document-outline" title="No items" subtitle="This receipt has no parsed items." />
          )
        }
      />
    </View>
  );
}

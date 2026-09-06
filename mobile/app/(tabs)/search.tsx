// Search items across all receipts, with date/price filters. Tapping a result
// opens that product's price history.

import { useState } from "react";
import { FlatList, Pressable, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Txt } from "../../src/ui/Text";
import { ItemRow } from "../../src/ui/rows";
import { EmptyState, Loading } from "../../src/ui/States";
import { FilterSheet, activeFilterCount, type Filters } from "../../src/ui/FilterSheet";
import { radius, spacing, useTheme } from "../../src/ui/theme";
import { formatMoney } from "../../src/format";
import { useSearch } from "../../src/hooks/useSearch";

export default function SearchScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [q, setQ] = useState("");
  const [filters, setFilters] = useState<Filters>({});
  const [sheet, setSheet] = useState(false);

  const { items, count, truncated, total, currency, loading } = useSearch({ q, ...filters });
  const nFilters = activeFilterCount(filters);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingTop: insets.top + spacing.lg, paddingHorizontal: spacing.lg, gap: spacing.md }}>
        <Txt variant="title">Search</Txt>

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              paddingHorizontal: spacing.md,
            }}
          >
            <Ionicons name="search" size={18} color={colors.subtext} />
            <TextInput
              style={{ flex: 1, color: colors.text, paddingVertical: spacing.md, fontSize: 15 }}
              placeholder="Search items, e.g. kenyér"
              placeholderTextColor={colors.subtext}
              value={q}
              onChangeText={setQ}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {q ? (
              <Pressable onPress={() => setQ("")} hitSlop={10}>
                <Ionicons name="close-circle" size={18} color={colors.subtext} />
              </Pressable>
            ) : null}
          </View>

          <Pressable
            onPress={() => setSheet(true)}
            style={{
              width: 48,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: nFilters ? colors.primary : colors.card,
              borderWidth: 1,
              borderColor: nFilters ? colors.primary : colors.border,
              borderRadius: radius.md,
            }}
          >
            <Ionicons name="options-outline" size={20} color={nFilters ? colors.primaryText : colors.text} />
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Txt variant="muted">
            {count}
            {truncated ? "+" : ""} items
          </Txt>
          {total > 0 ? <Txt variant="muted">Total {formatMoney(total, currency)}</Txt> : null}
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(it, i) => `${it.receiptId}-${i}`}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingTop: spacing.sm,
          gap: spacing.sm,
          paddingBottom: insets.bottom + spacing.xl,
        }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <ItemRow
            item={item}
            onPress={() => router.push({ pathname: "/item/[name]", params: { name: item.name } })}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <Loading />
          ) : (
            <EmptyState
              icon="search-outline"
              title={q || nFilters ? "No matches" : "Search your receipts"}
              subtitle={q || nFilters ? "Try a different term or clear filters." : "Type a product name to begin."}
            />
          )
        }
      />

      <FilterSheet
        visible={sheet}
        initial={filters}
        onApply={setFilters}
        onClose={() => setSheet(false)}
      />
    </View>
  );
}

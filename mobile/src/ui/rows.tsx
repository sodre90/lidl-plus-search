// List-row components for items and receipts.

import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Txt } from "./Text";
import { radius, spacing, useTheme } from "./theme";
import { formatDate, formatMoney } from "../format";
import type { Item, ReceiptRow as ReceiptRowType } from "../lidl/types";

export function ItemRow({ item, onPress }: { item: Item; onPress?: () => void }) {
  const { colors } = useTheme();
  const qtyLine =
    item.quantity && item.unitPrice
      ? `${trimNum(item.quantity)} × ${formatMoney(item.unitPrice, item.currency)}`
      : formatDate(item.date);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.card,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        gap: spacing.md,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Txt style={{ fontWeight: "600" }} numberOfLines={2}>
          {item.name}
        </Txt>
        <Txt variant="caption">
          {formatDate(item.date)} · {qtyLine}
        </Txt>
      </View>
      <Txt style={{ fontWeight: "700" }}>{formatMoney(item.totalPrice, item.currency)}</Txt>
      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.subtext} /> : null}
    </Pressable>
  );
}

export function ReceiptListRow({ receipt, onPress }: { receipt: ReceiptRowType; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.card,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        gap: spacing.md,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.sm,
          backgroundColor: colors.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="receipt-outline" size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt style={{ fontWeight: "600" }}>{formatDate(receipt.date)}</Txt>
        <Txt variant="caption">{receipt.itemCount} items</Txt>
      </View>
      <Txt style={{ fontWeight: "700" }}>{formatMoney(receipt.totalAmount, receipt.currency)}</Txt>
      <Ionicons name="chevron-forward" size={16} color={colors.subtext} />
    </Pressable>
  );
}

/** Drop trailing ".00" / unnecessary decimals from a quantity. */
function trimNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(3)));
}

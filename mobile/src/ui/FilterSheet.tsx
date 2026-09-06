// A bottom-sheet-style modal for search filters: date range + price range.
// Uses plain text inputs to avoid extra date/number picker dependencies.

import { useEffect, useState } from "react";
import { Modal, Pressable, TextInput, View } from "react-native";
import { Txt } from "./Text";
import { Button } from "./Button";
import { radius, spacing, useTheme } from "./theme";

export interface Filters {
  from?: string;
  to?: string;
  min?: number;
  max?: number;
}

/** Parse a price field, ignoring blanks and anything that is not a number. */
function positiveNumber(input: string): number | undefined {
  const n = Number(input.trim().replace(",", "."));
  return input.trim() && Number.isFinite(n) && n > 0 ? n : undefined;
}

export function activeFilterCount(f: Filters): number {
  return [f.from, f.to, f.min, f.max].filter((v) => v !== undefined && v !== "" && v !== null).length;
}

export function FilterSheet({
  visible,
  initial,
  onApply,
  onClose,
}: {
  visible: boolean;
  initial: Filters;
  onApply: (f: Filters) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [from, setFrom] = useState(initial.from ?? "");
  const [to, setTo] = useState(initial.to ?? "");
  const [min, setMin] = useState(initial.min != null ? String(initial.min) : "");
  const [max, setMax] = useState(initial.max != null ? String(initial.max) : "");

  useEffect(() => {
    if (!visible) return;
    setFrom(initial.from ?? "");
    setTo(initial.to ?? "");
    setMin(initial.min != null ? String(initial.min) : "");
    setMax(initial.max != null ? String(initial.max) : "");
  }, [visible, initial.from, initial.to, initial.min, initial.max]);

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

  const apply = () => {
    onApply({
      from: from.trim() || undefined,
      to: to.trim() || undefined,
      min: positiveNumber(min),
      max: positiveNumber(max),
    });
    onClose();
  };

  const clear = () => {
    setFrom("");
    setTo("");
    setMin("");
    setMax("");
    onApply({});
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} onPress={onClose} />
      <View
        style={{
          backgroundColor: colors.card,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          padding: spacing.lg,
          paddingBottom: spacing.xxl,
          gap: spacing.md,
        }}
      >
        <Txt variant="heading">Filters</Txt>

        <Txt variant="muted">Date range (YYYY-MM-DD)</Txt>
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <TextInput
            style={[field, { flex: 1 }]}
            placeholder="From"
            placeholderTextColor={colors.subtext}
            value={from}
            onChangeText={setFrom}
            autoCapitalize="none"
          />
          <TextInput
            style={[field, { flex: 1 }]}
            placeholder="To"
            placeholderTextColor={colors.subtext}
            value={to}
            onChangeText={setTo}
            autoCapitalize="none"
          />
        </View>

        <Txt variant="muted">Item price range</Txt>
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <TextInput
            style={[field, { flex: 1 }]}
            placeholder="Min"
            placeholderTextColor={colors.subtext}
            value={min}
            onChangeText={setMin}
            keyboardType="numeric"
          />
          <TextInput
            style={[field, { flex: 1 }]}
            placeholder="Max"
            placeholderTextColor={colors.subtext}
            value={max}
            onChangeText={setMax}
            keyboardType="numeric"
          />
        </View>

        <View style={{ flexDirection: "row", gap: spacing.md, marginTop: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button title="Clear" variant="outline" onPress={clear} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Apply" onPress={apply} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

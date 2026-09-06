// A simple, dependency-free bar chart (horizontally scrollable). Tapping a bar
// highlights it and surfaces its value above the chart.

import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Txt } from "./Text";
import { radius, spacing, useTheme } from "./theme";
import { formatMoney } from "../format";

export interface BarDatum {
  label: string; // axis label (e.g. "May")
  value: number;
  caption?: string; // optional secondary line for the selected readout
}

export function BarChart({
  data,
  currency,
  height = 150,
}: {
  data: BarDatum[];
  currency: string;
  height?: number;
}) {
  const { colors } = useTheme();
  const [sel, setSel] = useState<number | null>(null);

  if (data.length === 0) return null;
  const max = Math.max(1, ...data.map((d) => d.value));
  const activeIndex = sel ?? data.length - 1;
  const active = data[activeIndex];

  return (
    <View>
      <Txt variant="title" style={{ fontSize: 24 }}>
        {formatMoney(active.value, currency)}
      </Txt>
      <Txt variant="muted">{active.caption ?? active.label}</Txt>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.sm, paddingTop: spacing.md, alignItems: "flex-end" }}
      >
        {data.map((d, i) => {
          const h = Math.max(4, (d.value / max) * height);
          const isActive = activeIndex === i;
          return (
            <Pressable key={`${d.label}-${i}`} onPress={() => setSel(i)} style={{ alignItems: "center", width: 36 }}>
              <View
                style={{
                  width: 22,
                  height: h,
                  borderRadius: radius.sm,
                  backgroundColor: isActive ? colors.primary : colors.chartTrack,
                }}
              />
              <Txt variant="caption" style={{ marginTop: spacing.xs }} numberOfLines={1}>
                {d.label}
              </Txt>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

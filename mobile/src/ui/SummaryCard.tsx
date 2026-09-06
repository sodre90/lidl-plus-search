import { Ionicons } from "@expo/vector-icons";
import { Card } from "./Card";
import { Txt } from "./Text";
import { spacing, useTheme } from "./theme";

/** A compact stat tile: icon + value + label. */
export function SummaryCard({
  icon,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
}) {
  const { colors } = useTheme();
  return (
    <Card style={{ flex: 1, gap: spacing.sm, minWidth: 140 }}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Txt variant="heading" numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Txt>
      <Txt variant="muted">{label}</Txt>
    </Card>
  );
}

import { View, type ViewProps } from "react-native";
import { radius, spacing, useTheme } from "./theme";

/** A rounded surface used to group content. */
export function Card({ style, ...rest }: ViewProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: radius.lg,
          padding: spacing.lg,
          borderWidth: 1,
          borderColor: colors.border,
        },
        style,
      ]}
      {...rest}
    />
  );
}

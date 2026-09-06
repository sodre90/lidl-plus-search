import { ActivityIndicator, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Txt } from "./Text";
import { radius, spacing, useTheme } from "./theme";

type Variant = "primary" | "accent" | "outline" | "danger";

export function Button({
  title,
  onPress,
  variant = "primary",
  icon,
  loading = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useTheme();

  const bg = {
    primary: colors.primary,
    accent: colors.accent,
    outline: "transparent",
    danger: colors.danger,
  }[variant];
  const fg = {
    primary: colors.primaryText,
    accent: colors.accentText,
    outline: colors.text,
    danger: "#ffffff",
  }[variant];

  const isOff = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isOff}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
        backgroundColor: bg,
        borderColor: variant === "outline" ? colors.border : "transparent",
        borderWidth: variant === "outline" ? 1 : 0,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.md,
        opacity: isOff ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Txt style={{ fontWeight: "700" }} color={fg}>
            {title}
          </Txt>
        </>
      )}
    </Pressable>
  );
}

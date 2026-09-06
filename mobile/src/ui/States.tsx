// Small presentational helpers for loading / error / empty states.

import { ActivityIndicator, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Txt } from "./Text";
import { radius, spacing, useTheme } from "./theme";

export function Loading({ label }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md }}>
      <ActivityIndicator color={colors.primary} />
      {label ? <Txt variant="muted">{label}</Txt> : null}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", padding: spacing.xl, gap: spacing.md }}>
      <Ionicons name="alert-circle-outline" size={36} color={colors.danger} />
      <Txt variant="muted" style={{ textAlign: "center" }}>
        {message}
      </Txt>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          style={{
            backgroundColor: colors.primary,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.lg,
            borderRadius: radius.pill,
          }}
        >
          <Txt color={colors.primaryText}>Retry</Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({
  icon = "file-tray-outline",
  title,
  subtitle,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", padding: spacing.xxl, gap: spacing.sm }}>
      <Ionicons name={icon} size={44} color={colors.subtext} />
      <Txt variant="heading" style={{ textAlign: "center" }}>
        {title}
      </Txt>
      {subtitle ? (
        <Txt variant="muted" style={{ textAlign: "center" }}>
          {subtitle}
        </Txt>
      ) : null}
    </View>
  );
}

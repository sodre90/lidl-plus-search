// Screen container: themed background + safe-area padding, optionally scrollable.

import type { ReactNode } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, useTheme } from "./theme";

export function Screen({
  children,
  scroll = false,
  refreshing,
  onRefresh,
  padded = true,
}: {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const pad = padded ? spacing.lg : 0;

  if (scroll) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{
          padding: pad,
          paddingTop: pad + insets.top,
          paddingBottom: pad + spacing.xl,
          gap: spacing.lg,
        }}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        padding: pad,
        paddingTop: pad + insets.top,
      }}
    >
      {children}
    </View>
  );
}

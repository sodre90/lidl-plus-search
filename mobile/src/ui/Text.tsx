// Themed text with a few preset variants, to keep typography consistent.

import { Text as RNText, type TextProps, StyleSheet } from "react-native";
import { useTheme } from "./theme";

type Variant = "title" | "heading" | "body" | "muted" | "caption" | "mono";

export function Txt({
  variant = "body",
  color,
  style,
  ...rest
}: TextProps & { variant?: Variant; color?: string }) {
  const { colors } = useTheme();
  const isMuted = variant === "muted" || variant === "caption";
  const c = color ?? (isMuted ? colors.subtext : colors.text);
  return <RNText style={[styles[variant], { color: c }, style]} {...rest} />;
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  heading: { fontSize: 18, fontWeight: "700" },
  body: { fontSize: 15 },
  muted: { fontSize: 14 },
  caption: { fontSize: 12 },
  mono: { fontSize: 12, fontFamily: "Courier" },
});

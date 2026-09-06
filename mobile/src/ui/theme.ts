// Lidl-branded design tokens and a light/dark theme hook.

import { useColorScheme } from "react-native";

export interface ThemeColors {
  bg: string;
  card: string;
  text: string;
  subtext: string;
  border: string;
  primary: string;
  primaryText: string;
  accent: string;
  accentText: string;
  danger: string;
  chart: string;
  chartTrack: string;
}

// Lidl brand: blue #0050aa, yellow #ffe500, red #e60a14.
const light: ThemeColors = {
  bg: "#eef1f6",
  card: "#ffffff",
  text: "#0b1f33",
  subtext: "#5b6b7b",
  border: "#e2e8f0",
  primary: "#0050aa",
  primaryText: "#ffffff",
  accent: "#ffe500",
  accentText: "#0b1f33",
  danger: "#e60a14",
  chart: "#0050aa",
  chartTrack: "#dfe6ef",
};

const dark: ThemeColors = {
  bg: "#0b1220",
  card: "#141d2c",
  text: "#e7eef7",
  subtext: "#93a4b7",
  border: "#243349",
  primary: "#4a90d9",
  primaryText: "#06121f",
  accent: "#ffe500",
  accentText: "#0b1f33",
  danger: "#ff5a63",
  chart: "#4a90d9",
  chartTrack: "#22324a",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export interface Theme {
  colors: ThemeColors;
  dark: boolean;
}

export function useTheme(): Theme {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  return { colors: isDark ? dark : light, dark: isDark };
}

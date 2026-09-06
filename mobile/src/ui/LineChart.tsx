// An SVG line chart for a single series (used for item price history). Measures
// its own width via onLayout so it fits whatever container it is placed in.

import { useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Polyline, Text as SvgText } from "react-native-svg";
import { Txt } from "./Text";
import { spacing, useTheme } from "./theme";
import { formatMoney } from "../format";

export interface LinePoint {
  value: number;
}

export function LineChart({
  data,
  currency,
  height = 180,
}: {
  data: LinePoint[];
  currency: string;
  height?: number;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (data.length === 0) {
    return <Txt variant="muted">No price data yet.</Txt>;
  }

  const padX = 10;
  const padTop = 14;
  const padBottom = 14;
  const ys = data.map((d) => d.value);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanY = Math.max(1, maxY - minY);
  const n = data.length;

  const x = (i: number) =>
    n === 1 ? width / 2 : padX + (i / (n - 1)) * (width - 2 * padX);
  const y = (v: number) => padTop + (1 - (v - minY) / spanY) * (height - padTop - padBottom);

  const points = data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");

  return (
    <View onLayout={onLayout}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Line
            x1={padX}
            y1={height - padBottom}
            x2={width - padX}
            y2={height - padBottom}
            stroke={colors.border}
            strokeWidth={1}
          />
          {n > 1 ? <Polyline points={points} fill="none" stroke={colors.chart} strokeWidth={2} /> : null}
          {data.map((d, i) => (
            <Circle key={i} cx={x(i)} cy={y(d.value)} r={3.5} fill={colors.chart} />
          ))}
          <SvgText x={padX} y={11} fontSize={10} fill={colors.subtext}>
            {formatMoney(maxY, currency)}
          </SvgText>
          {maxY !== minY ? (
            <SvgText x={padX} y={height - 3} fontSize={10} fill={colors.subtext}>
              {formatMoney(minY, currency)}
            </SvgText>
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}

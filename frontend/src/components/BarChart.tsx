import { useId, useMemo, useState } from "react";
import { money, type BarDatum } from "../utils";

const W = 720;
const H = 240;
const PAD = { top: 20, right: 16, bottom: 30, left: 62 };

/** A presentational, interactive bar chart over a labelled series. Hover
 * snaps to the nearest bar (works even in the gaps between thin bars). */
export function BarChart({ data, currency }: { data: BarDatum[]; currency: string }) {
  const gradId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const { bars, ticks, slot, yearTicks } = useMemo(() => {
    const max = Math.max(...data.map((d) => d.value), 1);
    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const slot = innerW / data.length;
    const bw = Math.min(slot * 0.66, 46);
    const baseline = H - PAD.bottom;

    const bars = data.map((d, i) => {
      const h = (d.value / max) * innerH;
      return { ...d, x: PAD.left + slot * i + (slot - bw) / 2, w: bw, y: baseline - h, h, cx: PAD.left + slot * (i + 0.5) };
    });

    const ticks = [0, 0.5, 1].map((f) => ({ v: f * max, y: baseline - f * innerH }));

    // Mark January bars with their year for a readable time axis.
    const yearTicks = bars
      .filter((b) => b.label.endsWith("-01"))
      .map((b) => ({ year: b.label.slice(0, 4), cx: b.cx }));

    return { bars, ticks, slot, yearTicks };
  }, [data]);

  const baseline = H - PAD.bottom;
  const active = hover != null ? bars[hover] : null;

  const pick = (clientX: number, target: EventTarget & Element) => {
    const rect = target.getBoundingClientRect();
    const xv = ((clientX - rect.left) / rect.width) * W;
    const idx = Math.floor((xv - PAD.left) / slot);
    setHover(Math.max(0, Math.min(bars.length - 1, idx)));
  };

  return (
    <div
      className="chart-wrap"
      onMouseMove={(e) => pick(e.clientX, e.currentTarget)}
      onMouseLeave={() => setHover(null)}
      onTouchStart={(e) => pick(e.touches[0].clientX, e.currentTarget)}
      onTouchMove={(e) => pick(e.touches[0].clientX, e.currentTarget)}
    >
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Spend per month">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="bar-grad-top" />
            <stop offset="100%" className="bar-grad-bottom" />
          </linearGradient>
        </defs>

        {ticks.map((t, i) => (
          <g key={i}>
            <line className="chart-grid" x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y} />
            <text className="chart-label" x={PAD.left - 8} y={t.y + 3} textAnchor="end">
              {money(Math.round(t.v), currency)}
            </text>
          </g>
        ))}
        <line className="chart-axis" x1={PAD.left} y1={baseline} x2={W - PAD.right} y2={baseline} vectorEffect="non-scaling-stroke" />

        {bars.map((b, i) => (
          <rect
            key={b.label}
            className={`chart-bar${hover === i ? " active" : ""}`}
            x={b.x}
            y={b.y}
            width={b.w}
            height={Math.max(b.h, b.value > 0 ? 1.5 : 0)}
            rx={Math.min(4, b.w / 2)}
            fill={`url(#${gradId})`}
          />
        ))}

        {/* x-axis: year labels if available, else first/last month */}
        {yearTicks.length >= 2 ? (
          yearTicks.map((t) => (
            <text key={t.year} className="chart-label" x={t.cx} y={H - 9} textAnchor="middle">
              {t.year}
            </text>
          ))
        ) : (
          <>
            <text className="chart-label" x={PAD.left} y={H - 9} textAnchor="start">
              {data[0].label}
            </text>
            <text className="chart-label" x={W - PAD.right} y={H - 9} textAnchor="end">
              {data[data.length - 1].label}
            </text>
          </>
        )}
      </svg>

      {active && active.value > 0 && (
        <div className="chart-tip" style={{ left: `${(active.cx / W) * 100}%`, top: `${(active.y / H) * 100}%` }}>
          <span className="chart-tip-val">{money(active.value, currency)}</span>
          <span className="chart-tip-day">{active.label}</span>
        </div>
      )}
    </div>
  );
}

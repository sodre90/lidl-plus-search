import { useId, useMemo, useState } from "react";
import type { Item } from "../api";
import { money } from "../utils";

const W = 720;
const H = 240;
const PAD = { top: 20, right: 20, bottom: 30, left: 62 };

interface Point {
  day: string;
  price: number;
  cx: number;
  cy: number;
}

/** Average unit price per day, drawn as a gradient area + line with an
 * interactive hover tooltip and crosshair. Hand-rolled SVG, no chart library. */
export function PriceChart({ items }: { items: Item[] }) {
  const gradId = useId();
  const [hover, setHover] = useState<number | null>(null);

  const { points, ticks, currency } = useMemo(() => {
    const byDay = new Map<string, { sum: number; n: number }>();
    for (const it of items) {
      const day = it.date.slice(0, 10);
      const cur = byDay.get(day) ?? { sum: 0, n: 0 };
      cur.sum += it.unitPrice;
      cur.n += 1;
      byDay.set(day, cur);
    }
    const days = [...byDay.keys()].sort();
    const series = days.map((d) => {
      const { sum, n } = byDay.get(d)!;
      return { day: d, t: Date.parse(d), price: sum / n };
    });

    const prices = series.map((s) => s.price);
    let lo = Math.min(...prices);
    let hi = Math.max(...prices);
    const pad = (hi - lo) * 0.12 || hi * 0.12 || 1;
    lo = Math.max(0, lo - pad);
    hi = hi + pad;

    const tMin = series[0].t;
    const tSpan = series[series.length - 1].t - tMin || 1;
    const x = (t: number) => PAD.left + ((t - tMin) / tSpan) * (W - PAD.left - PAD.right);
    const y = (p: number) => H - PAD.bottom - ((p - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);

    const pts: Point[] = series.map((s) => ({ day: s.day, price: s.price, cx: x(s.t), cy: y(s.price) }));

    const tickVals = [0, 0.5, 1].map((f) => lo + f * (hi - lo));
    const ticks = tickVals.map((v) => ({ v, y: y(v) }));

    return { points: pts, ticks, currency: items[0]?.currency ?? "" };
  }, [items]);

  const baseline = H - PAD.bottom;
  const line = points.map((p, i) => `${i ? "L" : "M"}${p.cx},${p.cy}`).join(" ");
  const area =
    `M${points[0].cx},${baseline} ` +
    points.map((p) => `L${p.cx},${p.cy}`).join(" ") +
    ` L${points[points.length - 1].cx},${baseline} Z`;

  const pick = (clientX: number, target: EventTarget & Element) => {
    const rect = target.getBoundingClientRect();
    const tx = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bd = Infinity;
    points.forEach((p, i) => {
      const d = Math.abs(p.cx - tx);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    setHover(best);
  };

  const active = hover != null ? points[hover] : null;

  return (
    <div
      className="chart-wrap"
      onMouseMove={(e) => pick(e.clientX, e.currentTarget)}
      onMouseLeave={() => setHover(null)}
      onTouchStart={(e) => pick(e.touches[0].clientX, e.currentTarget)}
      onTouchMove={(e) => pick(e.touches[0].clientX, e.currentTarget)}
    >
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Unit price over time">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className="grad-top" />
            <stop offset="100%" className="grad-bottom" />
          </linearGradient>
        </defs>

        {/* gridlines + y labels */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line className="chart-grid" x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y} />
            <text className="chart-label" x={PAD.left - 8} y={t.y + 3} textAnchor="end">
              {money(Math.round(t.v), currency)}
            </text>
          </g>
        ))}

        {/* x range labels */}
        <text className="chart-label" x={PAD.left} y={H - 9} textAnchor="start">
          {points[0].day}
        </text>
        <text className="chart-label" x={W - PAD.right} y={H - 9} textAnchor="end">
          {points[points.length - 1].day}
        </text>

        <path className="chart-area" d={area} fill={`url(#${gradId})`} />
        <path className="chart-line" d={line} vectorEffect="non-scaling-stroke" />

        {/* hover crosshair + marker */}
        {active && (
          <>
            <line className="chart-crosshair" x1={active.cx} y1={PAD.top} x2={active.cx} y2={baseline} vectorEffect="non-scaling-stroke" />
            <circle className="chart-marker-halo" cx={active.cx} cy={active.cy} r={7} />
            <circle className="chart-marker" cx={active.cx} cy={active.cy} r={3.5} />
          </>
        )}
      </svg>

      {active && (
        <div
          className="chart-tip"
          style={{ left: `${(active.cx / W) * 100}%`, top: `${(active.cy / H) * 100}%` }}
        >
          <span className="chart-tip-val">{money(active.price, currency)}</span>
          <span className="chart-tip-day">{active.day}</span>
        </div>
      )}
    </div>
  );
}

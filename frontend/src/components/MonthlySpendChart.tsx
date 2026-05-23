import { useMemo } from "react";
import type { Item } from "../api";
import { fillMonths } from "../utils";
import { BarChart } from "./BarChart";

/** Total spend per month for the current search results. */
export function MonthlySpendChart({ items }: { items: Item[] }) {
  const data = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const it of items) {
      const m = it.date.slice(0, 7);
      byMonth.set(m, (byMonth.get(m) ?? 0) + it.totalPrice);
    }
    const rows = [...byMonth.keys()]
      .sort()
      .map((month) => ({ month, total: byMonth.get(month)! }));
    return fillMonths(rows);
  }, [items]);

  return <BarChart data={data} currency={items[0]?.currency ?? ""} />;
}

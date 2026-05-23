import type { SearchResponse } from "../api";
import { money } from "../utils";

export function SummaryCards({
  response,
  loading,
}: {
  response: SearchResponse;
  loading: boolean;
}) {
  const { count, total, currency, results } = response;
  const avgUnit =
    results.length > 0
      ? results.reduce((s, r) => s + r.unitPrice, 0) / results.length
      : 0;

  return (
    <section className="summary" aria-busy={loading}>
      <div className="stat-card">
        <div className="value">{count.toLocaleString()}</div>
        <div className="label">matching items</div>
      </div>
      <div className="stat-card">
        <div className="value">{money(total, currency)}</div>
        <div className="label">total spent</div>
      </div>
      <div className="stat-card">
        <div className="value">{money(avgUnit, currency)}</div>
        <div className="label">average unit price</div>
      </div>
    </section>
  );
}

import { useEffect, useMemo, useState } from "react";
import {
  fetchMonthly,
  fetchReceipts,
  fetchStats,
  search,
  type MonthTotal,
  type ReceiptRow,
  type SearchResponse,
  type Stats,
} from "./api";
import { fillMonths } from "./utils";
import { useDebounced } from "./hooks";
import { Header } from "./components/Header";
import { SearchBar } from "./components/SearchBar";
import { Filters, type FilterState, emptyFilters, hasActiveFilters } from "./components/Filters";
import { SummaryCards } from "./components/SummaryCards";
import { PriceChart } from "./components/PriceChart";
import { MonthlySpendChart } from "./components/MonthlySpendChart";
import { BarChart } from "./components/BarChart";
import { ResultsTable } from "./components/ResultsTable";
import { ReceiptsTable } from "./components/ReceiptsTable";
import { ReceiptDrawer } from "./components/ReceiptDrawer";

export function App() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);

  const [stats, setStats] = useState<Stats | null>(null);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [receipts, setReceipts] = useState<ReceiptRow[] | null>(null);
  const [monthly, setMonthly] = useState<{ months: MonthTotal[]; currency: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  // Bumped after a sync so the data-loading effects below re-run.
  const [reloadKey, setReloadKey] = useState(0);

  const debouncedQuery = useDebounced(query, 250);
  const debouncedFilters = useDebounced(filters, 350);

  const isSearching = debouncedQuery.trim() !== "" || hasActiveFilters(debouncedFilters);

  // Load DB stats (and reload after each sync).
  useEffect(() => {
    const ctrl = new AbortController();
    fetchStats(ctrl.signal)
      .then(setStats)
      .catch(() => {});
    return () => ctrl.abort();
  }, [reloadKey]);

  // Load recent receipts, the landing view (and reload after each sync).
  useEffect(() => {
    const ctrl = new AbortController();
    fetchReceipts(50, ctrl.signal)
      .then((r) => setReceipts(r.receipts))
      .catch((e) => setError(String(e.message ?? e)));
    return () => ctrl.abort();
  }, [reloadKey]);

  // Load monthly spending totals for the landing-page chart.
  useEffect(() => {
    const ctrl = new AbortController();
    fetchMonthly(ctrl.signal)
      .then(setMonthly)
      .catch(() => {});
    return () => ctrl.abort();
  }, [reloadKey]);

  // Run search whenever the debounced query/filters change.
  useEffect(() => {
    if (!isSearching) {
      setResults(null);
      setError(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    search(
      {
        q: debouncedQuery.trim(),
        from: debouncedFilters.from || undefined,
        to: debouncedFilters.to || undefined,
        min: debouncedFilters.min ? Number(debouncedFilters.min) : undefined,
        max: debouncedFilters.max ? Number(debouncedFilters.max) : undefined,
        limit: debouncedFilters.limit ? Number(debouncedFilters.limit) : undefined,
      },
      ctrl.signal,
    )
      .then((r) => {
        setResults(r);
        setError(null);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(String(e.message ?? e));
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [isSearching, debouncedQuery, debouncedFilters, reloadKey]);

  const items = results?.results ?? [];
  const { showPrice, showMonthly } = useMemo(() => {
    const searching = isSearching && debouncedQuery.trim() !== "";
    const days = new Set(items.map((i) => i.date.slice(0, 10)));
    const months = new Set(items.map((i) => i.date.slice(0, 7)));
    return { showPrice: searching && days.size >= 2, showMonthly: searching && months.size >= 2 };
  }, [items, isSearching, debouncedQuery]);

  const monthlyBars = useMemo(() => (monthly ? fillMonths(monthly.months) : []), [monthly]);

  return (
    <>
      <Header stats={stats} onSynced={() => setReloadKey((k) => k + 1)} />

      <main className="container">
        <SearchBar
          value={query}
          onChange={setQuery}
          filtersOpen={showFilters}
          onToggleFilters={() => setShowFilters((v) => !v)}
        />
        {showFilters && (
          <Filters
            value={filters}
            onChange={setFilters}
            onReset={() => setFilters(emptyFilters)}
          />
        )}

        {error && <div className="card error">⚠ {error}</div>}

        {isSearching && results && (
          <SummaryCards response={results} loading={loading} />
        )}

        {(showPrice || showMonthly) && (
          <section className="charts">
            {showPrice && (
              <div className="card chart-card">
                <h2 className="card-title">Unit price over time</h2>
                <PriceChart items={items} />
              </div>
            )}
            {showMonthly && (
              <div className="card chart-card">
                <h2 className="card-title">Spend per month</h2>
                <MonthlySpendChart items={items} />
              </div>
            )}
          </section>
        )}

        {!isSearching && monthlyBars.length >= 2 && monthly && (
          <section className="card chart-card">
            <h2 className="card-title">Spending by month</h2>
            <BarChart data={monthlyBars} currency={monthly.currency} />
          </section>
        )}

        <section className="card">
          <h2 className="card-title">
            {isSearching
              ? loading && !results
                ? "Searching…"
                : `Results${results ? ` (${results.count})` : ""}`
              : "Recent receipts"}
          </h2>
          {isSearching ? (
            <ResultsTable
              items={items}
              query={debouncedQuery}
              loading={loading}
              onOpen={setOpenId}
            />
          ) : (
            <ReceiptsTable receipts={receipts} onOpen={setOpenId} />
          )}
        </section>

        <p className="disclaimer">
          Local &amp; offline — data comes only from your own <code>lidl.db</code>. Run{" "}
          <code>lidlsearch sync</code> to refresh it.
        </p>
      </main>

      {openId && <ReceiptDrawer id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}

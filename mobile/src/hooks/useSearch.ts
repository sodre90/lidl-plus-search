// Debounced item search over the local store, with aggregated totals. Re-runs on
// query/filter changes and when the DB changes (e.g. after a sync).

import { useEffect, useMemo, useState } from "react";
import { search, type SearchOpts } from "../db/queries";
import type { Item, SearchParams } from "../lidl/types";
import { useDataVersion } from "./queries";

export interface SearchState {
  items: Item[];
  count: number;
  /** True when the result set hit the row limit, so `count` is a lower bound. */
  truncated: boolean;
  total: number;
  currency: string;
  loading: boolean;
  error: string | null;
}

const DEFAULT_LIMIT = 500;

export function useSearch(params: SearchParams, debounceMs = 250): SearchState {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const version = useDataVersion();

  const key = JSON.stringify(params);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const opts: SearchOpts = {
      from: params.from,
      to: params.to,
      min: params.min,
      max: params.max,
      limit: params.limit ?? DEFAULT_LIMIT,
    };
    const handle = setTimeout(() => {
      search(params.q, opts)
        .then((rows) => {
          if (!cancelled) {
            setItems(rows);
            setError(null);
          }
        })
        .catch((e) => {
          if (!cancelled) setError(e instanceof Error ? e.message : String(e));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, debounceMs);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version, debounceMs]);

  const total = useMemo(() => items.reduce((s, it) => s + it.totalPrice, 0), [items]);
  const currency = items[0]?.currency ?? "";
  const limit = params.limit ?? DEFAULT_LIMIT;

  return { items, count: items.length, truncated: items.length >= limit, total, currency, loading, error };
}

// Generic async-query hook that re-runs when its dependencies change or when the
// local DB signals a data change (so screens refresh after a sync).

import { useCallback, useEffect, useState } from "react";
import { subscribeData } from "../store-events";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[] = [],
  opts: { watchData?: boolean } = { watchData: true },
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    run()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [run]);

  useEffect(load, [load]);

  useEffect(() => {
    if (!opts.watchData) return;
    return subscribeData(() => load());
  }, [load, opts.watchData]);

  return { data, loading, error, reload: load };
}

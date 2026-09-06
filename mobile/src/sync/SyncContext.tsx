// One app-wide sync controller. Sync is a background job against a single local
// database, so every screen must observe and drive the *same* run — otherwise
// the Dashboard and Settings could each start their own concurrent sync.

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { hasReceipt, upsertReceipt } from "../db/queries";
import {
  runSync,
  SyncAborted,
  type SyncOptions,
  type SyncProgress,
  type SyncResult,
} from "../lidl/sync";
import { bumpData } from "../store-events";
import { getLastSynced, setLastSynced } from "../settings";

export interface SyncController {
  running: boolean;
  progress: SyncProgress | null;
  note: string | null;
  error: string | null;
  result: SyncResult | null;
  /** Timestamp of the last successful sync (ISO), kept in sync with the store. */
  lastSynced: string | null;
  start: (opts?: SyncOptions) => Promise<void>;
  cancel: () => void;
}

const SyncContext = createContext<SyncController | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { client } = useAuth();
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [lastSynced, setLastSyncedState] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    getLastSynced()
      .then(setLastSyncedState)
      .catch(() => {});
  }, []);

  const start = useCallback(
    async (opts: SyncOptions = {}) => {
      // runningRef (not the `running` state) guards against a second start
      // arriving before React has re-rendered with running === true.
      if (!client || runningRef.current) return;
      runningRef.current = true;
      setRunning(true);
      setError(null);
      setNote(null);
      setProgress(null);
      setResult(null);

      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await runSync(
          client,
          { hasReceipt, upsertReceipt },
          opts,
          { onProgress: setProgress, onNote: setNote },
          ctrl.signal,
        );
        setResult(res);
        const now = new Date().toISOString();
        await setLastSynced(now);
        setLastSyncedState(now);
        bumpData();
      } catch (e) {
        if (!(e instanceof SyncAborted)) {
          setError(e instanceof Error ? e.message : String(e));
        }
        // Partial progress is already committed to the store, so let the screens
        // re-query rather than showing counts from before the failed run.
        bumpData();
      } finally {
        runningRef.current = false;
        setRunning(false);
        abortRef.current = null;
      }
    },
    [client],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const value: SyncController = {
    running,
    progress,
    note,
    error,
    result,
    lastSynced,
    start,
    cancel,
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncController {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync must be used within a SyncProvider");
  return ctx;
}

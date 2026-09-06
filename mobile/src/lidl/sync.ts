// Receipt sync loop, ported from sync_core.go. Pages the receipt list, skips
// receipts already stored, downloads new ones, and reports progress via cb.

import { LidlClient } from "./client";
import { dateOnly } from "./normalize";

/** The store operations sync needs (implemented by src/db/queries.ts). */
export interface SyncStore {
  hasReceipt(id: string): Promise<boolean>;
  upsertReceipt(id: string, raw: string): Promise<{ itemCount: number }>;
}

export interface SyncOptions {
  /** Re-download all receipts, not just new ones. */
  full?: boolean;
  /** Limit list pages fetched (0/undefined = all). */
  maxPages?: number;
  /** Only receipts on/after this date (YYYY-MM-DD), "" = no limit. */
  since?: string;
}

/** A snapshot emitted after each receipt is processed. */
export interface SyncProgress {
  total: number; // receipts in the account (for a percentage), 0 if unknown
  fetched: number; // downloaded so far this run
  skipped: number; // already stored, skipped so far this run
  page: number; // current list page
}

export interface SyncResult {
  fetched: number;
  skipped: number;
  reachedSince: boolean; // stopped early because of the `since` cutoff
}

export interface SyncCallbacks {
  onPage?: (page: number) => void;
  onProgress?: (p: SyncProgress) => void;
  onNote?: (msg: string) => void;
}

/** Thrown when a sync is cancelled via the AbortSignal. */
export class SyncAborted extends Error {
  constructor() {
    super("sync cancelled");
    this.name = "SyncAborted";
  }
}

/**
 * Download receipts into the store. Progress is reported through cb; the caller
 * decides how to render it. Pass an AbortSignal to allow cancellation.
 */
export async function runSync(
  client: LidlClient,
  store: SyncStore,
  opts: SyncOptions,
  cb: SyncCallbacks = {},
  signal?: AbortSignal,
): Promise<SyncResult> {
  let fetched = 0;
  let skipped = 0;
  let total = 0;
  let reachedCutoff = false;

  const checkAbort = () => {
    if (signal?.aborted) throw new SyncAborted();
  };

  for (let page = 1; !reachedCutoff; page++) {
    if (opts.maxPages && opts.maxPages > 0 && page > opts.maxPages) break;
    checkAbort();

    const { tickets, total: t } = await client.listTicketsPage(page);
    if (t > 0) total = t;
    if (tickets.length === 0) break; // reached the end of history
    cb.onPage?.(page);

    for (const s of tickets) {
      checkAbort();

      // Receipts come newest-first, so once one is older than `since`,
      // everything after it is too — stop.
      if (opts.since && dateOnly(s.date) < opts.since) {
        reachedCutoff = true;
        break;
      }

      // Already stored: skip it (unless full). We keep paging so a partial
      // history is completed; only the cheap list calls repeat, not details.
      if (!opts.full && (await store.hasReceipt(s.id))) {
        skipped++;
        cb.onProgress?.({ total, fetched, skipped, page });
        continue;
      }

      let raw: string;
      try {
        raw = await client.ticketDetail(s.id);
      } catch (e) {
        throw new Error(`downloading receipt ${s.id}: ${String(e)}`);
      }
      const res = await store.upsertReceipt(s.id, raw);
      fetched++;
      cb.onProgress?.({ total, fetched, skipped, page });
      if (res.itemCount === 0) {
        cb.onNote?.(`warning: ${s.id} has 0 items`);
      }
    }
  }

  return { fetched, skipped, reachedSince: reachedCutoff };
}

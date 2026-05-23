// Typed client for the lidlsearch JSON API served by the Go binary.

export interface Item {
  receiptId: string;
  date: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  currency: string;
}

export interface SearchResponse {
  results: Item[];
  count: number;
  total: number;
  currency: string;
}

export interface ReceiptRow {
  id: string;
  date: string;
  totalAmount: number;
  currency: string;
  itemCount: number;
}

export interface ReceiptDetail {
  id: string;
  date: string;
  currency: string;
  items: Item[];
  total: number;
}

export interface Stats {
  receipts: number;
  items: number;
}

export interface MonthTotal {
  month: string; // "YYYY-MM"
  total: number;
  count: number;
}

export interface SearchParams {
  q: string;
  from?: string;
  to?: string;
  min?: number;
  max?: number;
  limit?: number;
}

async function getJSON<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal });
  if (!res.ok) {
    let msg = `request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* keep default message */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export function fetchStats(signal?: AbortSignal) {
  return getJSON<Stats>("/api/stats", signal);
}

export function fetchReceipts(limit = 50, signal?: AbortSignal) {
  return getJSON<{ receipts: ReceiptRow[] }>(`/api/receipts?limit=${limit}`, signal);
}

export function fetchReceipt(id: string, signal?: AbortSignal) {
  return getJSON<ReceiptDetail>(`/api/receipt/${encodeURIComponent(id)}`, signal);
}

export function fetchMonthly(signal?: AbortSignal) {
  return getJSON<{ months: MonthTotal[]; currency: string }>("/api/monthly", signal);
}

export type SyncEvent =
  | { type: "progress"; total: number; fetched: number; skipped: number; page: number }
  | { type: "note"; message: string }
  | { type: "done"; fetched: number; skipped: number; reachedSince: boolean; receipts: number; items: number }
  | { type: "error"; message: string };

/** Trigger a sync and invoke `onEvent` for each streamed NDJSON progress line. */
export async function streamSync(
  onEvent: (e: SyncEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch("/api/sync", { method: "POST", signal });
  if (!res.body) {
    throw new Error(`sync failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) onEvent(JSON.parse(line) as SyncEvent);
    }
  }
  const tail = buf.trim();
  if (tail) onEvent(JSON.parse(tail) as SyncEvent);
}

export function search(p: SearchParams, signal?: AbortSignal) {
  const q = new URLSearchParams();
  if (p.q) q.set("q", p.q);
  if (p.from) q.set("from", p.from);
  if (p.to) q.set("to", p.to);
  if (p.min) q.set("min", String(p.min));
  if (p.max) q.set("max", String(p.max));
  if (p.limit) q.set("limit", String(p.limit));
  return getJSON<SearchResponse>(`/api/search?${q.toString()}`, signal);
}

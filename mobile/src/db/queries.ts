// Query/mutation helpers over the local SQLite store, ported from
// internal/store/{store,search}.go. SQL columns are aliased to the camelCase
// field names used by the app's types.

import { getDB } from "./index";
import { parseHTMLReceipt } from "../lidl/htmlReceipt";
import { normalize } from "../lidl/normalize";
import type { Item, MonthTotal, PricePoint, ReceiptRow, Stats } from "../lidl/types";

/** Shape of the raw receipt JSON we extract fields from. */
interface RawTicket {
  id?: string;
  date?: string;
  totalAmount?: number;
  htmlPrintedReceipt?: string;
}

/**
 * Store (or update) a receipt's raw JSON and re-extract its searchable line
 * items from the printed HTML. Idempotent (re-upsert does not duplicate items).
 */
export async function upsertReceipt(id: string, raw: string): Promise<{ id: string; itemCount: number }> {
  const d = JSON.parse(raw) as RawTicket;
  const rid = d.id || id;
  const { items, currency } = parseHTMLReceipt(d.htmlPrintedReceipt ?? "");

  const db = await getDB();
  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM items WHERE receipt_id = ?", [rid]);
    await db.runAsync(
      `INSERT INTO receipts (id, date, store, total_amount, currency, item_count, raw, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         date=excluded.date, store=excluded.store, total_amount=excluded.total_amount,
         currency=excluded.currency, item_count=excluded.item_count, raw=excluded.raw,
         synced_at=excluded.synced_at`,
      [rid, d.date ?? "", "", d.totalAmount ?? 0, currency, items.length, raw, new Date().toISOString()],
    );
    for (const it of items) {
      await db.runAsync(
        `INSERT INTO items (receipt_id, name, name_norm, quantity, unit_price, total_price, currency)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [rid, it.name, normalize(it.name), it.quantity, it.unitPrice, it.totalPrice, currency],
      );
    }
  });
  return { id: rid, itemCount: items.length };
}

/** Whether a given receipt is already stored. */
export async function hasReceipt(id: string): Promise<boolean> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ x: number }>("SELECT 1 AS x FROM receipts WHERE id = ?", [id]);
  return row != null;
}

const ITEM_SELECT = `
  SELECT r.id AS receiptId, r.date AS date, i.name AS name, i.quantity AS quantity,
         i.unit_price AS unitPrice, i.total_price AS totalPrice,
         COALESCE(NULLIF(i.currency, ''), r.currency, '') AS currency
  FROM items i JOIN receipts r ON r.id = i.receipt_id`;

/** Search filters. Empty/zero fields are ignored. */
export interface SearchOpts {
  from?: string;
  to?: string;
  min?: number;
  max?: number;
  limit?: number;
}

/** Match item names accent-insensitively, applying the given filters. */
export async function search(query: string, opts: SearchOpts = {}): Promise<Item[]> {
  let sql = `${ITEM_SELECT} WHERE 1=1`;
  const args: (string | number)[] = [];

  const q = normalize(query);
  if (q) {
    sql += " AND i.name_norm LIKE ?";
    args.push(`%${q}%`);
  }
  if (opts.from) {
    sql += " AND substr(r.date, 1, 10) >= ?";
    args.push(opts.from);
  }
  if (opts.to) {
    sql += " AND substr(r.date, 1, 10) <= ?";
    args.push(opts.to);
  }
  if (opts.min && opts.min > 0) {
    sql += " AND i.total_price >= ?";
    args.push(opts.min);
  }
  if (opts.max && opts.max > 0) {
    sql += " AND i.total_price <= ?";
    args.push(opts.max);
  }
  sql += " ORDER BY r.date DESC, i.id";
  if (opts.limit && opts.limit > 0) {
    sql += " LIMIT ?";
    args.push(opts.limit);
  }

  const db = await getDB();
  return db.getAllAsync<Item>(sql, args);
}

/** Most recent receipts (newest first). */
export async function receipts(limit = 50): Promise<ReceiptRow[]> {
  const db = await getDB();
  let sql = `SELECT id, date, total_amount AS totalAmount, COALESCE(currency, '') AS currency,
             item_count AS itemCount FROM receipts ORDER BY date DESC`;
  const args: number[] = [];
  if (limit > 0) {
    sql += " LIMIT ?";
    args.push(limit);
  }
  return db.getAllAsync<ReceiptRow>(sql, args);
}

/** All line items of one receipt. */
export async function receiptItems(id: string): Promise<Item[]> {
  const db = await getDB();
  return db.getAllAsync<Item>(`${ITEM_SELECT} WHERE r.id = ? ORDER BY i.id`, [id]);
}

/** Total spend per month across all receipts (oldest month first). */
export async function monthlyTotals(): Promise<{ months: MonthTotal[]; currency: string }> {
  const db = await getDB();
  const months = await db.getAllAsync<MonthTotal>(
    `SELECT substr(date, 1, 7) AS month, COALESCE(SUM(total_amount), 0) AS total, COUNT(*) AS count
     FROM receipts WHERE date <> '' GROUP BY month ORDER BY month`,
  );
  const cur = await db.getFirstAsync<{ currency: string }>(
    "SELECT currency FROM receipts WHERE currency <> '' ORDER BY date DESC LIMIT 1",
  );
  return { months, currency: cur?.currency ?? "" };
}

/** Number of receipts and items stored. */
export async function count(): Promise<Stats> {
  const db = await getDB();
  const r = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM receipts");
  const i = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM items");
  return { receipts: r?.n ?? 0, items: i?.n ?? 0 };
}

/** Price history for one product (exact accent-insensitive name match). */
export async function priceHistory(name: string): Promise<PricePoint[]> {
  const db = await getDB();
  return db.getAllAsync<PricePoint>(
    `SELECT r.date AS date, i.unit_price AS unitPrice, i.total_price AS totalPrice,
            i.quantity AS quantity, COALESCE(NULLIF(i.currency, ''), r.currency, '') AS currency,
            r.id AS receiptId
     FROM items i JOIN receipts r ON r.id = i.receipt_id
     WHERE i.name_norm = ? ORDER BY r.date`,
    [normalize(name)],
  );
}

// --- key/value meta (last sync time, etc.) ---

export async function getMeta(key: string): Promise<string | null> {
  const db = await getDB();
  const row = await db.getFirstAsync<{ value: string }>("SELECT value FROM meta WHERE key = ?", [key]);
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  const db = await getDB();
  await db.runAsync(
    "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    [key, value],
  );
}

/** Wipe all locally stored data (used on logout). */
export async function wipeAll(): Promise<void> {
  const db = await getDB();
  await db.execAsync("DELETE FROM items; DELETE FROM receipts; DELETE FROM meta;");
}

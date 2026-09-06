// Data hooks backed by the local SQLite store. All re-run when the DB changes.

import { useEffect, useState } from "react";
import { useAsync, type AsyncState } from "./useAsync";
import { count, monthlyTotals, priceHistory, receipts, receiptItems } from "../db/queries";
import { dataVersion, subscribeData } from "../store-events";
import type { Item, MonthTotal, PricePoint, ReceiptRow, Stats } from "../lidl/types";

/** A counter that increments whenever stored data changes. */
export function useDataVersion(): number {
  const [v, setV] = useState(dataVersion());
  useEffect(() => subscribeData(() => setV(dataVersion())), []);
  return v;
}

export function useStats(): AsyncState<Stats> {
  return useAsync(() => count(), []);
}

export function useReceipts(limit = 50): AsyncState<ReceiptRow[]> {
  return useAsync(() => receipts(limit), [limit]);
}

export function useReceiptItems(id: string): AsyncState<Item[]> {
  return useAsync(() => receiptItems(id), [id]);
}

export function useMonthly(): AsyncState<{ months: MonthTotal[]; currency: string }> {
  return useAsync(() => monthlyTotals(), []);
}

export function usePriceHistory(name: string): AsyncState<PricePoint[]> {
  return useAsync(() => priceHistory(name), [name]);
}

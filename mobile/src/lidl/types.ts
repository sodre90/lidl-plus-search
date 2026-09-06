// Data shapes shared across the app. These mirror the JSON contracts of the
// original Go web API (see frontend/src/api.ts) so behaviour stays consistent.

/** A single line item on a receipt. */
export interface Item {
  receiptId: string;
  date: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  currency: string;
}

/** A row in the receipts list. */
export interface ReceiptRow {
  id: string;
  date: string;
  totalAmount: number;
  currency: string;
  itemCount: number;
}

/** A receipt with its line items. */
export interface ReceiptDetail {
  id: string;
  date: string;
  currency: string;
  items: Item[];
  total: number;
}

/** Database-wide counts. */
export interface Stats {
  receipts: number;
  items: number;
}

/** Total spend (and receipt count) for one calendar month ("YYYY-MM"). */
export interface MonthTotal {
  month: string;
  total: number;
  count: number;
}

/** Filters for an item search. Empty/zero fields are ignored. */
export interface SearchParams {
  q: string;
  from?: string;
  to?: string;
  min?: number;
  max?: number;
  limit?: number;
}

/** Aggregated search response. */
export interface SearchResult {
  results: Item[];
  count: number;
  total: number;
  currency: string;
}

/** One occurrence of an item over time, for the price-history chart. */
export interface PricePoint {
  date: string;
  unitPrice: number;
  totalPrice: number;
  quantity: number;
  currency: string;
  receiptId: string;
}

// --- Lidl backend payload shapes ---

/** Minimal fields of a receipt-list entry (tickets v2). */
export interface TicketSummary {
  id: string;
  date: string;
  totalAmount: number;
  articlesCount: number;
  isFavorite: boolean;
}

/** OAuth token set persisted on the device. */
export interface Tokens {
  refreshToken: string;
  accessToken?: string;
  /** Access-token expiry as a Unix timestamp (seconds). */
  expiresAt?: number;
}

// Display formatting helpers (money, dates, months). Implemented without Intl so
// behaviour is consistent across Hermes builds.

/** Group an integer part with non-breaking spaces: 1234567 -> "1\u00a0234\u00a0567". */
function groupThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/**
 * Format a monetary amount with thousands grouping and a trailing currency.
 * Whole numbers show no decimals (typical for HUF "Ft"); otherwise 2 decimals.
 * All separators are U+00A0 so an amount never wraps across a line.
 */
export function formatMoney(amount: number, currency = ""): string {
  const neg = amount < 0;
  const abs = Math.abs(amount);
  const isWhole = Math.abs(abs - Math.round(abs)) < 0.005;
  let body: string;
  if (isWhole) {
    body = groupThousands(String(Math.round(abs)));
  } else {
    const fixed = abs.toFixed(2);
    const [int, dec] = fixed.split(".");
    body = `${groupThousands(int)},${dec}`;
  }
  const sign = neg ? "-" : "";
  return currency ? `${sign}${body} ${currency}` : `${sign}${body}`;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2026-05-01T14:23:00" -> "1 May 2026". Falls back to the raw string. */
export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return iso ?? "";
  const [, y, mo, d] = m;
  const mi = parseInt(mo, 10) - 1;
  return `${parseInt(d, 10)} ${MONTHS[mi] ?? mo} ${y}`;
}

/** "2026-05" -> "May 2026". */
export function formatMonth(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month ?? "");
  if (!m) return month ?? "";
  const [, y, mo] = m;
  const mi = parseInt(mo, 10) - 1;
  return `${MONTHS[mi] ?? mo} ${y}`;
}

/** The current month as a "YYYY-MM" key, in local time (matching stored dates). */
export function currentMonthKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Short month label for chart axes: "2026-05" -> "May". */
export function shortMonth(month: string): string {
  const m = /^\d{4}-(\d{2})$/.exec(month ?? "");
  if (!m) return month ?? "";
  return MONTHS[parseInt(m[1], 10) - 1] ?? month;
}

/** Relative-ish "last synced" label from an ISO timestamp. */
export function formatSyncTime(iso: string | null): string {
  if (!iso) return "never";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "never";
  const diffMin = Math.floor((Date.now() - t) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD} d ago`;
  return `on ${formatDate(iso)}`;
}

/** Advance a "YYYY-MM" key by one month. */
function nextMonth(month: string): string {
  const y = parseInt(month.slice(0, 4), 10);
  const m = parseInt(month.slice(5, 7), 10);
  const [ny, nm] = m === 12 ? [y + 1, 1] : [y, m + 1];
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

/**
 * Insert zero-valued entries for months with no receipts, so a chart of the
 * result is evenly spaced in time rather than skipping gaps.
 */
export function fillMonthGaps<T extends { month: string }>(
  rows: T[],
  blank: (month: string) => T,
): T[] {
  if (rows.length === 0) return rows;
  const sorted = [...rows].sort((a, b) => a.month.localeCompare(b.month));
  const out: T[] = [sorted[0]];
  for (const row of sorted.slice(1)) {
    let cursor = nextMonth(out[out.length - 1].month);
    // Guard against a malformed key producing an endless walk.
    for (let i = 0; cursor < row.month && i < 600; i++) {
      out.push(blank(cursor));
      cursor = nextMonth(cursor);
    }
    out.push(row);
  }
  return out;
}


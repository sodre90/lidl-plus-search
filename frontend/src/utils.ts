// Small formatting + text helpers shared across components.

/** Fold a string for accent- and case-insensitive comparison (mirrors the
 * Go-side normalize used for search). */
const COMBINING_MARKS = /[̀-ͯ]/g;

export function fold(s: string): string {
  return s.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase();
}

/** Format an amount. Whole numbers (typical for HUF/Ft) drop the decimals;
 * thousands are grouped for readability. */
export function money(value: number, currency: string): string {
  const whole = Number.isInteger(value);
  const num = value.toLocaleString(undefined, {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${num} ${currency}` : num;
}

/** "2026-05-01T18:42:00..." -> "2026-05-01 18:42" */
export function shortDate(s: string): string {
  if (s.length >= 16) return s.slice(0, 16).replace("T", " ");
  return s;
}

/** "2026-05-01..." -> "2026-05-01" */
export function dayOnly(s: string): string {
  return s.slice(0, 10);
}

export function num(value: number): string {
  if (!value) return "";
  return Number.isInteger(value) ? String(value) : value.toPrecision(3).replace(/\.?0+$/, "");
}

export interface BarDatum {
  label: string; // "YYYY-MM"
  value: number;
}

/** Turn sparse monthly totals into a continuous, gap-filled series (months
 * with no spending become zero-value bars) so the time axis stays even. */
export function fillMonths(rows: { month: string; total: number }[]): BarDatum[] {
  if (rows.length === 0) return [];
  const map = new Map(rows.map((r) => [r.month, r.total]));
  const [fy, fm] = rows[0].month.split("-").map(Number);
  const [ly, lm] = rows[rows.length - 1].month.split("-").map(Number);

  const out: BarDatum[] = [];
  let y = fy;
  let m = fm;
  while (out.length < 1200) {
    const label = `${y}-${String(m).padStart(2, "0")}`;
    out.push({ label, value: map.get(label) ?? 0 });
    if (y === ly && m === lm) break;
    if (++m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

export interface HighlightPart {
  text: string;
  match: boolean;
}

/** Split `name` into highlighted/plain parts for an accent-insensitive query. */
export function highlightParts(name: string, query: string): HighlightPart[] {
  const q = fold(query.trim());
  if (!q) return [{ text: name, match: false }];

  // Build a folded string plus a map from folded index -> original index so we
  // can map a match back onto the original (accented) characters.
  let folded = "";
  const map: number[] = [];
  for (let i = 0; i < name.length; i++) {
    const f = fold(name[i]);
    for (const ch of f) {
      folded += ch;
      map.push(i);
    }
  }
  map.push(name.length);

  const idx = folded.indexOf(q);
  if (idx < 0) return [{ text: name, match: false }];

  const start = map[idx];
  const end = map[idx + q.length];
  const parts: HighlightPart[] = [];
  if (start > 0) parts.push({ text: name.slice(0, start), match: false });
  parts.push({ text: name.slice(start, end), match: true });
  if (end < name.length) parts.push({ text: name.slice(end), match: false });
  return parts;
}

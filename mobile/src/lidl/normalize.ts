// Text/number helpers ported from internal/store/normalize.go. Kept identical so
// search behaviour and amount parsing match the original Go tool exactly.

/**
 * Lowercase and strip accents so searches are accent- and case-insensitive
 * (e.g. "Kenyér" matches "kenyer"). Equivalent to the Go NFD + Mn-removal pass.
 */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .normalize("NFC")
    .toLowerCase()
    .trim();
}

/**
 * Parse a possibly European-formatted amount ("1.234,56", "1234,56", "1 234 Ft")
 * into a number. Returns 0 on invalid input.
 *
 * Whichever of "," / "." appears last is treated as the decimal point; the other
 * groups thousands. This handles both "1.234,56" (EU) and "1,234.56" (US).
 */
export function parseAmount(input: string): number {
  let s = (input ?? "").trim();
  if (s === "") return 0;

  // Keep only digits, decimal/thousand separators and a leading sign.
  s = s.replace(/[^0-9.,-]/g, "");

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      s = s.replace(/\./g, "").replace(/,/g, ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    s = s.replace(/,/g, ".");
  }

  const f = parseFloat(s);
  return Number.isNaN(f) ? 0 : f;
}

/** Return the date portion ("YYYY-MM-DD") of an ISO-ish date string. */
export function dateOnly(date: string): string {
  return (date ?? "").slice(0, 10);
}

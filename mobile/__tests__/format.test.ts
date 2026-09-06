// Tests for the display/formatting helpers. These run without Intl, so the
// expected output is fixed regardless of the device locale.

import {
  currentMonthKey,
  fillMonthGaps,
  formatDate,
  formatMoney,
  formatMonth,
  shortMonth,
} from "../src/format";

// formatMoney joins groups and the currency with U+00A0 so an amount never wraps
// across a line. Spelled out here so the expectations stay readable.
const NB = "\u00a0";

describe("formatMoney", () => {
  it("groups thousands and appends the currency", () => {
    expect(formatMoney(1234567, "Ft")).toBe(`1${NB}234${NB}567${NB}Ft`);
  });

  it("omits decimals for whole amounts and keeps two otherwise", () => {
    expect(formatMoney(499, "Ft")).toBe(`499${NB}Ft`);
    expect(formatMoney(1234.5, "€")).toBe(`1${NB}234,50${NB}€`);
  });

  it("keeps the sign outside the digits and drops an empty currency", () => {
    expect(formatMoney(-50.5)).toBe("-50,50");
  });
});

describe("formatDate / formatMonth", () => {
  it("renders an ISO timestamp and a month key", () => {
    expect(formatDate("2026-05-01T14:23:00")).toBe("1 May 2026");
    expect(formatMonth("2026-05")).toBe("May 2026");
    expect(shortMonth("2026-05")).toBe("May");
  });

  it("falls back to the raw string when unparseable", () => {
    expect(formatDate("nope")).toBe("nope");
    expect(formatMonth("")).toBe("");
  });
});

describe("fillMonthGaps", () => {
  const blank = (month: string) => ({ month, total: 0 });

  it("inserts the months that have no receipts", () => {
    const filled = fillMonthGaps([{ month: "2026-01", total: 10 }, { month: "2026-04", total: 40 }], blank);
    expect(filled.map((m) => m.month)).toEqual(["2026-01", "2026-02", "2026-03", "2026-04"]);
    expect(filled.map((m) => m.total)).toEqual([10, 0, 0, 40]);
  });

  it("crosses a year boundary", () => {
    const filled = fillMonthGaps([{ month: "2025-11", total: 1 }, { month: "2026-02", total: 2 }], blank);
    expect(filled.map((m) => m.month)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });

  it("leaves contiguous and empty input untouched", () => {
    const rows = [{ month: "2026-01", total: 1 }, { month: "2026-02", total: 2 }];
    expect(fillMonthGaps(rows, blank)).toEqual(rows);
    expect(fillMonthGaps([], blank)).toEqual([]);
  });
});

describe("currentMonthKey", () => {
  it("uses local time, not UTC", () => {
    // 00:30 on the 1st in a UTC+1 zone is still the previous day in UTC.
    const local = new Date(2026, 10, 1, 0, 30);
    expect(currentMonthKey(local)).toBe("2026-11");
  });
});

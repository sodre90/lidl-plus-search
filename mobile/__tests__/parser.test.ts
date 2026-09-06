// Parity tests for the ported receipt parser and helpers. The fixture mirrors
// internal/store/store_test.go so the app extracts the same data as the Go tool.

import { parseHTMLReceipt } from "../src/lidl/htmlReceipt";
import { normalize, parseAmount } from "../src/lidl/normalize";

// KENYÉR appears as a single description line; TEJ appears as a "qty * unit
// price" breakdown line plus a description line carrying the line total.
const sampleHTML = `<html><body><pre>
<span class="purchase_list"><span id="purchase_list_line_1" class="article" data-art-id="0001" data-art-quantity="1" data-unit-price="499,00" data-tax-type="A" data-art-description="KENYÉR 1KG">KENYÉR 1KG                  499  A00</span>
<span id="purchase_list_line_2" class="article" data-art-id="0002" data-art-quantity="2" data-unit-price="329,00" data-tax-type="A" data-art-description="TEJ 2,8%">2,000 db  *        329,00 Ft /db</span>
<span id="purchase_list_line_3" class="article" data-art-id="0002" data-art-quantity="2" data-unit-price="329,00" data-tax-type="A" data-art-description="TEJ 2,8%">TEJ 2,8%                  658  A00</span>
</span>
</pre></body></html>`;

describe("parseHTMLReceipt", () => {
  const { items, currency } = parseHTMLReceipt(sampleHTML);

  it("extracts exactly two items (the '*' breakdown line is skipped)", () => {
    expect(items.length).toBe(2);
  });

  it("detects the currency token", () => {
    expect(currency).toBe("Ft");
  });

  it("keeps the KENYÉR description and its line total", () => {
    const k = items.find((i) => normalize(i.name).includes("kenyer"));
    expect(k?.name).toBe("KENYÉR 1KG");
    expect(k?.totalPrice).toBe(499);
  });

  it("parses TEJ's line total from the description line", () => {
    const t = items.find((i) => i.name === "TEJ 2,8%");
    expect(t?.totalPrice).toBe(658);
    expect(t?.quantity).toBe(2);
    expect(t?.unitPrice).toBe(329);
  });
});

describe("parseAmount", () => {
  const cases: [string, number][] = [
    ["", 0],
    ["499", 499],
    ["658,00", 658],
    ["1.157,00", 1157],
    ["1 234 Ft", 1234],
    ["-50,5", -50.5],
    ["1,234.56", 1234.56],
  ];
  it.each(cases)("parseAmount(%p) === %p", (input, want) => {
    expect(parseAmount(input)).toBe(want);
  });
});

describe("normalize", () => {
  it("is accent- and case-insensitive", () => {
    expect(normalize("KENYÉR")).toBe("kenyer");
    expect(normalize("  Tej 2,8%  ")).toBe("tej 2,8%");
  });
});

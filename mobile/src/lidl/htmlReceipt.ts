// Line-item extraction ported from internal/store/htmlreceipt.go.
//
// HU receipts carry their line items inside the htmlPrintedReceipt string. Each
// article is a <span class="article"> carrying data attributes, e.g.:
//
//   <span class="article" data-art-id="0004685" data-art-quantity="2"
//         data-unit-price="445,00" data-tax-type="B"
//         data-art-description="CAMEMBERT SAJT">CAMEMBERT SAJT   890  B00</span>
//
// Each article typically appears twice: once as a "qty * unit price" breakdown
// line (its text contains '*') and once as the description line that ends with
// the line total and a tax code (e.g. "B00"). We keep the description line.

import { parseAmount } from "./normalize";

/** A single article extracted from a receipt's printed HTML. */
export interface HtmlItem {
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

// U+00A0 (non-breaking space). Built from an escape so the source has no literal
// nbsp byte. Amounts use it as a thousands separator; regular spaces only pad the
// name from the amount and must NOT count as part of the number.
const NBSP = String.fromCharCode(0xa0);

const articleSpanRe = /<span\b([^>]*\bclass="article"[^>]*)>([\s\S]*?)<\/span>/g;
const dataAttrRe = /data-([a-z-]+)="([^"]*)"/g;
const tagStripRe = /<[^>]+>/g;
const taxCodeTailRe = /\s+[A-Za-z]\d{2}\s*$/;
const trailingNumRe = new RegExp("([0-9][0-9.,\\u00A0]*)$");
// Captures the currency token from a "... * 445,00 Ft /db" breakdown line.
const currencyRe = new RegExp("\\*\\s+[0-9][0-9.,\\u00A0]*\\s+(\\S+)\\s*/");

/**
 * Minimal HTML-entity decoder (covers what receipt markup uses). Note "&nbsp;"
 * decodes to U+00A0 (not a regular space), matching Go's html.UnescapeString, so
 * the number regexes above can tell thousands separators from padding.
 */
function unescapeHTML(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&nbsp;/g, NBSP)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Extract the article line items and the currency token from a printed
 * receipt's HTML.
 */
export function parseHTMLReceipt(doc: string): { items: HtmlItem[]; currency: string } {
  let currency = "";
  const cur = currencyRe.exec(doc);
  if (cur) currency = unescapeHTML(cur[1]).trim();

  const items: HtmlItem[] = [];
  for (const sm of doc.matchAll(articleSpanRe)) {
    const attrsRaw = sm[1];
    const inner = sm[2];
    const text = unescapeHTML(inner.replace(tagStripRe, "")).trim();
    if (text.includes("*")) continue; // the "qty * unit price" breakdown line

    const attrs: Record<string, string> = {};
    for (const a of attrsRaw.matchAll(dataAttrRe)) {
      attrs[a[1]] = unescapeHTML(a[2]);
    }
    const name = (attrs["art-description"] ?? "").trim();
    if (name === "") continue;

    const item: HtmlItem = {
      name,
      quantity: parseAmount(attrs["art-quantity"] ?? ""),
      unitPrice: parseAmount(attrs["unit-price"] ?? ""),
      totalPrice: 0,
    };
    // Line total: the trailing number once the tax code is stripped.
    const tail = text.replace(taxCodeTailRe, "").trim();
    const m = trailingNumRe.exec(tail);
    if (m) item.totalPrice = parseAmount(m[1]);
    if (item.totalPrice === 0) item.totalPrice = item.quantity * item.unitPrice;

    items.push(item);
  }

  return { items, currency };
}

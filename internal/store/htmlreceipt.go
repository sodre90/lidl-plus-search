package store

import (
	"html"
	"regexp"
	"strings"
)

// htmlItem is a single article extracted from a receipt's printed HTML.
type htmlItem struct {
	Name       string
	Quantity   float64
	UnitPrice  float64
	TotalPrice float64
}

// HU receipts carry their line items inside the htmlPrintedReceipt string. Each
// article is a <span class="article"> carrying data attributes, e.g.:
//
//	<span class="article" data-art-id="0004685" data-art-quantity="2"
//	      data-unit-price="445,00" data-tax-type="B"
//	      data-art-description="CAMEMBERT SAJT">CAMEMBERT SAJT   890  B00</span>
//
// Each article typically appears twice: once as a "qty * unit price" breakdown
// line (its text contains '*') and once as the description line that ends with
// the line total and a tax code (e.g. "B00"). We keep the description line.
var (
	articleSpanRe = regexp.MustCompile(`(?s)<span\b([^>]*\bclass="article"[^>]*)>(.*?)</span>`)
	dataAttrRe    = regexp.MustCompile(`data-([a-z-]+)="([^"]*)"`)
	tagStripRe    = regexp.MustCompile(`<[^>]+>`)
	taxCodeTailRe = regexp.MustCompile(`\s+[A-Za-z]\d{2}\s*$`)
	// The amount may use a non-breaking space (U+00A0) as thousands separator,
	// but regular spaces only pad the name from the amount — so they must NOT be
	// part of the number, otherwise digits in the name get merged in.
	trailingNumRe = regexp.MustCompile(`([0-9][0-9.,\x{00a0}]*)$`)
	// Captures the currency token from a "... * 445,00 Ft /db" breakdown line.
	currencyRe = regexp.MustCompile(`\*\s+[0-9][0-9.,\x{00a0}]*\s+(\S+)\s*/`)
)

// parseHTMLReceipt extracts the article line items and the currency token from a
// printed receipt's HTML.
func parseHTMLReceipt(doc string) (items []htmlItem, currency string) {
	if m := currencyRe.FindStringSubmatch(doc); m != nil {
		currency = strings.TrimSpace(html.UnescapeString(m[1]))
	}

	for _, sm := range articleSpanRe.FindAllStringSubmatch(doc, -1) {
		attrsRaw, inner := sm[1], sm[2]
		text := strings.TrimSpace(html.UnescapeString(tagStripRe.ReplaceAllString(inner, "")))
		if strings.Contains(text, "*") {
			continue // the "qty * unit price" breakdown line, not the item line
		}

		attrs := map[string]string{}
		for _, a := range dataAttrRe.FindAllStringSubmatch(attrsRaw, -1) {
			attrs[a[1]] = html.UnescapeString(a[2])
		}
		name := strings.TrimSpace(attrs["art-description"])
		if name == "" {
			continue
		}

		it := htmlItem{
			Name:      name,
			Quantity:  parseAmount(attrs["art-quantity"]),
			UnitPrice: parseAmount(attrs["unit-price"]),
		}
		// Line total: the trailing number once the tax code is stripped.
		tail := strings.TrimSpace(taxCodeTailRe.ReplaceAllString(text, ""))
		if m := trailingNumRe.FindStringSubmatch(tail); m != nil {
			it.TotalPrice = parseAmount(m[1])
		}
		if it.TotalPrice == 0 {
			it.TotalPrice = it.Quantity * it.UnitPrice
		}
		items = append(items, it)
	}
	return items, currency
}

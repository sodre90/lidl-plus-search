package store

import (
	"context"
	"encoding/json"
	"path/filepath"
	"testing"
)

// sampleHTML mirrors the HU printed-receipt layout: KENYÉR appears as a single
// description line; TEJ appears as a "qty * unit price" line plus a description
// line carrying the line total and a tax code.
const sampleHTML = `<html><body><pre>
<span class="purchase_list"><span id="purchase_list_line_1" class="article" data-art-id="0001" data-art-quantity="1" data-unit-price="499,00" data-tax-type="A" data-art-description="KENYÉR 1KG">KENYÉR 1KG                  499  A00</span>
<span id="purchase_list_line_2" class="article" data-art-id="0002" data-art-quantity="2" data-unit-price="329,00" data-tax-type="A" data-art-description="TEJ 2,8%">2,000 db  *        329,00 Ft /db</span>
<span id="purchase_list_line_3" class="article" data-art-id="0002" data-art-quantity="2" data-unit-price="329,00" data-tax-type="A" data-art-description="TEJ 2,8%">TEJ 2,8%                  658  A00</span>
</span>
</pre></body></html>`

func sampleTicket(t *testing.T) []byte {
	t.Helper()
	raw, err := json.Marshal(map[string]any{
		"id":                 "RX-001",
		"date":               "2026-05-01T14:23:00",
		"totalAmount":        1157.0,
		"htmlPrintedReceipt": sampleHTML,
	})
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func newTestDB(t *testing.T) *DB {
	t.Helper()
	db, err := Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

func TestUpsertAndSearch(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	res, err := db.UpsertReceipt(ctx, "RX-001", sampleTicket(t))
	if err != nil {
		t.Fatalf("UpsertReceipt: %v", err)
	}
	if res.ItemCount != 2 {
		t.Fatalf("ItemCount = %d, want 2", res.ItemCount)
	}

	// Accent- and case-insensitive: "kenyer" must match "KENYÉR 1KG".
	hits, err := db.Search("kenyer", SearchOpts{})
	if err != nil {
		t.Fatalf("Search: %v", err)
	}
	if len(hits) != 1 || hits[0].ItemName != "KENYÉR 1KG" {
		t.Fatalf("search kenyer = %+v, want one 'KENYÉR 1KG'", hits)
	}
	if hits[0].Currency != "Ft" {
		t.Errorf("currency = %q, want Ft", hits[0].Currency)
	}

	// Line total parsed from the description line ("... 658  A00").
	hits, err = db.Search("tej", SearchOpts{})
	if err != nil {
		t.Fatalf("Search tej: %v", err)
	}
	if len(hits) != 1 || hits[0].TotalPrice != 658 {
		t.Fatalf("tej total = %+v, want 658", hits)
	}

	// Price filter excludes the cheaper bread line.
	hits, err = db.Search("", SearchOpts{MinPric: 600})
	if err != nil {
		t.Fatalf("Search min: %v", err)
	}
	if len(hits) != 1 || hits[0].ItemName != "TEJ 2,8%" {
		t.Fatalf("min=600 = %+v, want only 'TEJ 2,8%%'", hits)
	}

	// Idempotency: re-upsert must not duplicate items.
	if _, err := db.UpsertReceipt(ctx, "RX-001", sampleTicket(t)); err != nil {
		t.Fatalf("re-upsert: %v", err)
	}
	receipts, items, err := db.Count()
	if err != nil {
		t.Fatalf("Count: %v", err)
	}
	if receipts != 1 || items != 2 {
		t.Fatalf("Count = %d receipts, %d items; want 1, 2", receipts, items)
	}
}

func TestParseAmount(t *testing.T) {
	cases := map[string]float64{
		"":         0,
		"499":      499,
		"658,00":   658,
		"1.157,00": 1157,
		"1 234 Ft": 1234,
		"-50,5":    -50.5,
		"1,234.56": 1234.56,
	}
	for in, want := range cases {
		if got := parseAmount(in); got != want {
			t.Errorf("parseAmount(%q) = %v, want %v", in, got, want)
		}
	}
}

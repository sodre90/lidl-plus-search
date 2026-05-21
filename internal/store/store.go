// Package store provides local SQLite storage and search for downloaded receipts.
//
// Every receipt's full raw JSON is stored (nothing is lost), and on top of that
// we best-effort extract the searchable/displayable fields (date, amount, line
// items). If the HU API field names differ, the data can be re-parsed from the
// raw JSON at any time (use the `raw` command for debugging).
package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	_ "modernc.org/sqlite"
)

// DB is the application's database connection.
type DB struct {
	sql *sql.DB
}

const schema = `
CREATE TABLE IF NOT EXISTS receipts (
    id           TEXT PRIMARY KEY,
    date         TEXT,
    store        TEXT,
    total_amount REAL,
    currency     TEXT,
    item_count   INTEGER,
    raw          TEXT,
    synced_at    TEXT
);
CREATE TABLE IF NOT EXISTS items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    receipt_id  TEXT NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    name        TEXT,
    name_norm   TEXT,
    quantity    REAL,
    unit_price  REAL,
    total_price REAL,
    currency    TEXT
);
CREATE INDEX IF NOT EXISTS idx_items_receipt ON items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_items_norm    ON items(name_norm);
CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(date);
`

// Open opens (creating if needed) the database at the given path.
func Open(path string) (*DB, error) {
	sqlDB, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	if _, err := sqlDB.Exec("PRAGMA foreign_keys = ON;"); err != nil {
		sqlDB.Close()
		return nil, err
	}
	if _, err := sqlDB.Exec(schema); err != nil {
		sqlDB.Close()
		return nil, fmt.Errorf("failed to create schema: %w", err)
	}
	return &DB{sql: sqlDB}, nil
}

// Close closes the database.
func (db *DB) Close() error { return db.sql.Close() }

// HasReceipt reports whether a given receipt is already stored.
func (db *DB) HasReceipt(id string) (bool, error) {
	var x int
	err := db.sql.QueryRow("SELECT 1 FROM receipts WHERE id = ?", id).Scan(&x)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

// ticketDetail is the minimal shape of a raw receipt JSON used for extraction.
// The line items live inside HTMLReceipt (see htmlreceipt.go).
type ticketDetail struct {
	ID          string  `json:"id"`
	Date        string  `json:"date"`
	TotalAmount float64 `json:"totalAmount"`
	HTMLReceipt string  `json:"htmlPrintedReceipt"`
}

// ParsedReceipt reports extracted info; ItemCount is the number of line items.
type ParsedReceipt struct {
	ID        string
	ItemCount int
}

// UpsertReceipt stores (or updates) a receipt's raw JSON and re-extracts the
// searchable line items from its printed HTML. The operation is idempotent.
func (db *DB) UpsertReceipt(ctx context.Context, id string, raw json.RawMessage) (ParsedReceipt, error) {
	var d ticketDetail
	if err := json.Unmarshal(raw, &d); err != nil {
		return ParsedReceipt{}, fmt.Errorf("failed to parse receipt JSON: %w", err)
	}
	if d.ID == "" {
		d.ID = id
	}
	items, currency := parseHTMLReceipt(d.HTMLReceipt)

	tx, err := db.sql.BeginTx(ctx, nil)
	if err != nil {
		return ParsedReceipt{}, err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, "DELETE FROM items WHERE receipt_id = ?", d.ID); err != nil {
		return ParsedReceipt{}, err
	}
	_, err = tx.ExecContext(ctx, `
        INSERT INTO receipts (id, date, store, total_amount, currency, item_count, raw, synced_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            date=excluded.date, store=excluded.store, total_amount=excluded.total_amount,
            currency=excluded.currency, item_count=excluded.item_count, raw=excluded.raw,
            synced_at=excluded.synced_at`,
		d.ID, d.Date, "", d.TotalAmount, currency, len(items),
		string(raw), time.Now().UTC().Format(time.RFC3339))
	if err != nil {
		return ParsedReceipt{}, err
	}

	for _, it := range items {
		_, err := tx.ExecContext(ctx, `
            INSERT INTO items (receipt_id, name, name_norm, quantity, unit_price, total_price, currency)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
			d.ID, it.Name, normalize(it.Name), it.Quantity, it.UnitPrice, it.TotalPrice, currency)
		if err != nil {
			return ParsedReceipt{}, err
		}
	}

	if err := tx.Commit(); err != nil {
		return ParsedReceipt{}, err
	}
	return ParsedReceipt{ID: d.ID, ItemCount: len(items)}, nil
}

// RawReceipt returns a receipt's raw JSON (for debugging).
func (db *DB) RawReceipt(id string) (string, error) {
	var raw string
	err := db.sql.QueryRow("SELECT raw FROM receipts WHERE id = ?", id).Scan(&raw)
	if err == sql.ErrNoRows {
		return "", fmt.Errorf("no such receipt: %s", id)
	}
	return raw, err
}

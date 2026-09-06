// SQLite schema, kept in sync with internal/store/store.go. The full raw JSON of
// every receipt is stored (nothing is lost); searchable/displayable fields are
// extracted on top of it and can be re-derived from `raw` at any time.

export const SCHEMA = `
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
CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT
);
CREATE INDEX IF NOT EXISTS idx_items_receipt ON items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_items_norm    ON items(name_norm);
CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(date);
`;

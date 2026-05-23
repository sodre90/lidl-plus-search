package store

import (
	"database/sql"
	"strings"
)

// SearchOpts are the search filters. Empty/zero fields are ignored.
type SearchOpts struct {
	From    string // "YYYY-MM-DD" from this date (inclusive)
	To      string // "YYYY-MM-DD" up to this date (inclusive)
	MinPric float64
	MaxPric float64
	Limit   int
}

// SearchResult is a single hit: one line item on one receipt.
type SearchResult struct {
	ReceiptID  string
	Date       string
	ItemName   string
	Quantity   float64
	UnitPrice  float64
	TotalPrice float64
	Currency   string
}

// Search matches item names accent-insensitively, applying the given filters.
func (db *DB) Search(query string, opts SearchOpts) ([]SearchResult, error) {
	var (
		sb   strings.Builder
		args []any
	)
	sb.WriteString(`
        SELECT r.id, r.date, i.name, i.quantity, i.unit_price, i.total_price,
               COALESCE(NULLIF(i.currency, ''), r.currency)
        FROM items i
        JOIN receipts r ON r.id = i.receipt_id
        WHERE 1=1`)

	if q := normalize(query); q != "" {
		sb.WriteString(" AND i.name_norm LIKE ?")
		args = append(args, "%"+q+"%")
	}
	if opts.From != "" {
		sb.WriteString(" AND substr(r.date, 1, 10) >= ?")
		args = append(args, opts.From)
	}
	if opts.To != "" {
		sb.WriteString(" AND substr(r.date, 1, 10) <= ?")
		args = append(args, opts.To)
	}
	if opts.MinPric > 0 {
		sb.WriteString(" AND i.total_price >= ?")
		args = append(args, opts.MinPric)
	}
	if opts.MaxPric > 0 {
		sb.WriteString(" AND i.total_price <= ?")
		args = append(args, opts.MaxPric)
	}
	sb.WriteString(" ORDER BY r.date DESC, i.id")
	if opts.Limit > 0 {
		sb.WriteString(" LIMIT ?")
		args = append(args, opts.Limit)
	}

	return db.queryResults(sb.String(), args...)
}

func (db *DB) queryResults(query string, args ...any) ([]SearchResult, error) {
	rows, err := db.sql.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []SearchResult
	for rows.Next() {
		var r SearchResult
		var cur sql.NullString
		if err := rows.Scan(&r.ReceiptID, &r.Date, &r.ItemName, &r.Quantity,
			&r.UnitPrice, &r.TotalPrice, &cur); err != nil {
			return nil, err
		}
		r.Currency = cur.String
		out = append(out, r)
	}
	return out, rows.Err()
}

// ReceiptRow is one row of the receipt list.
type ReceiptRow struct {
	ID          string
	Date        string
	TotalAmount float64
	Currency    string
	ItemCount   int
}

// Receipts returns the most recent receipts (newest first).
func (db *DB) Receipts(limit int) ([]ReceiptRow, error) {
	q := "SELECT id, date, total_amount, currency, item_count FROM receipts ORDER BY date DESC"
	var args []any
	if limit > 0 {
		q += " LIMIT ?"
		args = append(args, limit)
	}
	rows, err := db.sql.Query(q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []ReceiptRow
	for rows.Next() {
		var r ReceiptRow
		var cur sql.NullString
		if err := rows.Scan(&r.ID, &r.Date, &r.TotalAmount, &cur, &r.ItemCount); err != nil {
			return nil, err
		}
		r.Currency = cur.String
		out = append(out, r)
	}
	return out, rows.Err()
}

// ReceiptItems returns all line items of a receipt.
func (db *DB) ReceiptItems(id string) ([]SearchResult, error) {
	q := `
        SELECT r.id, r.date, i.name, i.quantity, i.unit_price, i.total_price,
               COALESCE(NULLIF(i.currency, ''), r.currency)
        FROM items i JOIN receipts r ON r.id = i.receipt_id
        WHERE r.id = ? ORDER BY i.id`
	return db.queryResults(q, id)
}

// MonthTotal is the total spend (and receipt count) for one calendar month.
type MonthTotal struct {
	Month string // "YYYY-MM"
	Total float64
	Count int
}

// MonthlyTotals returns total spend per month across all receipts (oldest
// month first), plus the currency to display.
func (db *DB) MonthlyTotals() ([]MonthTotal, string, error) {
	rows, err := db.sql.Query(`
        SELECT substr(date, 1, 7) AS month, COALESCE(SUM(total_amount), 0), COUNT(*)
        FROM receipts WHERE date <> ''
        GROUP BY month ORDER BY month`)
	if err != nil {
		return nil, "", err
	}
	defer rows.Close()

	var out []MonthTotal
	for rows.Next() {
		var m MonthTotal
		if err := rows.Scan(&m.Month, &m.Total, &m.Count); err != nil {
			return nil, "", err
		}
		out = append(out, m)
	}
	if err := rows.Err(); err != nil {
		return nil, "", err
	}

	var cur sql.NullString
	err = db.sql.QueryRow(`SELECT currency FROM receipts WHERE currency <> '' ORDER BY date DESC LIMIT 1`).Scan(&cur)
	if err != nil && err != sql.ErrNoRows {
		return nil, "", err
	}
	return out, cur.String, nil
}

// Count returns the number of receipts and items stored.
func (db *DB) Count() (receipts, items int, err error) {
	if err = db.sql.QueryRow("SELECT COUNT(*) FROM receipts").Scan(&receipts); err != nil {
		return
	}
	err = db.sql.QueryRow("SELECT COUNT(*) FROM items").Scan(&items)
	return
}

package main

import (
	"flag"
	"fmt"
	"os"
	"strings"
	"text/tabwriter"

	"lidlsearch/internal/store"
)

func cmdSearch(args []string) error {
	fs := flag.NewFlagSet("search", flag.ContinueOnError)
	from := fs.String("from", "", "from date (YYYY-MM-DD)")
	to := fs.String("to", "", "up to date (YYYY-MM-DD)")
	min := fs.Float64("min", 0, "minimum item total price")
	max := fs.Float64("max", 0, "maximum item total price")
	limit := fs.Int("limit", 100, "max number of results")
	// Go's flag package stops at the first non-flag argument, so parse
	// repeatedly to allow flags before, after, or between the query words.
	var words []string
	rest := args
	for {
		if err := fs.Parse(rest); err != nil {
			if err == flag.ErrHelp {
				return nil
			}
			return err
		}
		rest = fs.Args()
		if len(rest) == 0 {
			break
		}
		words = append(words, rest[0])
		rest = rest[1:]
	}
	query := strings.TrimSpace(strings.Join(words, " "))

	db, err := openDB()
	if err != nil {
		return err
	}
	defer db.Close()

	results, err := db.Search(query, store.SearchOpts{
		From: *from, To: *to, MinPric: *min, MaxPric: *max, Limit: *limit,
	})
	if err != nil {
		return err
	}
	if len(results) == 0 {
		fmt.Println("No results.")
		return nil
	}

	w := tabwriter.NewWriter(os.Stdout, 0, 2, 2, ' ', 0)
	fmt.Fprintln(w, "DATE\tITEM\tQTY\tUNIT\tTOTAL\tRECEIPT")
	var sum float64
	for _, r := range results {
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\t%s\n",
			shortDate(r.Date), trunc(r.ItemName, 40), num(r.Quantity),
			money(r.UnitPrice, r.Currency), money(r.TotalPrice, r.Currency), r.ReceiptID)
		sum += r.TotalPrice
	}
	w.Flush()
	cur := ""
	if len(results) > 0 {
		cur = results[0].Currency
	}
	fmt.Printf("\n%d result(s), total: %s\n", len(results), money(sum, cur))
	return nil
}

func cmdList(args []string) error {
	fs := flag.NewFlagSet("list", flag.ContinueOnError)
	limit := fs.Int("limit", 50, "max number of receipts")
	if err := fs.Parse(args); err != nil {
		if err == flag.ErrHelp {
			return nil
		}
		return err
	}

	db, err := openDB()
	if err != nil {
		return err
	}
	defer db.Close()

	rows, err := db.Receipts(*limit)
	if err != nil {
		return err
	}
	if len(rows) == 0 {
		fmt.Println("No receipts yet. Run: lidlsearch sync")
		return nil
	}

	w := tabwriter.NewWriter(os.Stdout, 0, 2, 2, ' ', 0)
	fmt.Fprintln(w, "DATE\tTOTAL\tITEMS\tRECEIPT")
	for _, r := range rows {
		fmt.Fprintf(w, "%s\t%s\t%d\t%s\n",
			shortDate(r.Date), money(r.TotalAmount, r.Currency), r.ItemCount, r.ID)
	}
	w.Flush()
	return nil
}

func cmdShow(args []string) error {
	if len(args) < 1 {
		return fmt.Errorf("usage: lidlsearch show <receipt-id>")
	}
	id := args[0]

	db, err := openDB()
	if err != nil {
		return err
	}
	defer db.Close()

	items, err := db.ReceiptItems(id)
	if err != nil {
		return err
	}
	if len(items) == 0 {
		return fmt.Errorf("no such receipt (or it has no items): %s", id)
	}

	fmt.Printf("Receipt %s  (%s)\n\n", id, shortDate(items[0].Date))
	w := tabwriter.NewWriter(os.Stdout, 0, 2, 2, ' ', 0)
	fmt.Fprintln(w, "ITEM\tQTY\tUNIT\tTOTAL")
	var sum float64
	for _, it := range items {
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\n",
			trunc(it.ItemName, 50), num(it.Quantity),
			money(it.UnitPrice, it.Currency), money(it.TotalPrice, it.Currency))
		sum += it.TotalPrice
	}
	w.Flush()
	fmt.Printf("\nTotal: %s\n", money(sum, items[0].Currency))
	return nil
}

func cmdRaw(args []string) error {
	if len(args) < 1 {
		return fmt.Errorf("usage: lidlsearch raw <receipt-id>")
	}
	db, err := openDB()
	if err != nil {
		return err
	}
	defer db.Close()

	raw, err := db.RawReceipt(args[0])
	if err != nil {
		return err
	}
	fmt.Println(raw)
	return nil
}

// --- small formatting helpers ---

func shortDate(s string) string {
	if len(s) >= 16 {
		return strings.Replace(s[:16], "T", " ", 1)
	}
	return s
}

func trunc(s string, n int) string {
	s = strings.TrimSpace(s)
	if len([]rune(s)) <= n {
		return s
	}
	return string([]rune(s)[:n-1]) + "…"
}

func num(f float64) string {
	if f == 0 {
		return ""
	}
	if f == float64(int64(f)) {
		return fmt.Sprintf("%d", int64(f))
	}
	return fmt.Sprintf("%.3g", f)
}

func money(f float64, currency string) string {
	if currency == "" {
		return fmt.Sprintf("%.2f", f)
	}
	return fmt.Sprintf("%.2f %s", f, currency)
}

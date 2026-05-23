package main

import (
	"context"
	"flag"
	"fmt"
	"time"

	"github.com/sodre90/lidl-plus-search/internal/config"
	"github.com/sodre90/lidl-plus-search/internal/lidl"
)

func cmdSync(ctx context.Context, args []string) error {
	fs := flag.NewFlagSet("sync", flag.ContinueOnError)
	full := fs.Bool("full", false, "re-download all receipts (not just new ones)")
	maxPages := fs.Int("pages", 0, "limit number of list pages to fetch (0 = all)")
	since := fs.String("since", "", "only sync receipts on/after this date (YYYY-MM-DD)")
	if err := fs.Parse(args); err != nil {
		if err == flag.ErrHelp {
			return nil
		}
		return err
	}
	if *since != "" {
		if _, err := time.Parse("2006-01-02", *since); err != nil {
			return fmt.Errorf("--since must be YYYY-MM-DD: %w", err)
		}
	}

	tokens, err := config.LoadTokens()
	if err != nil {
		return err
	}
	db, err := openDB()
	if err != nil {
		return err
	}
	defer db.Close()

	client := lidl.New(tokens, config.Country())

	prog := newProgress(0)
	cb := syncCallbacks{
		OnPage: func(page int) {
			if !prog.enabled() {
				fmt.Printf("Page %d…\n", page)
			}
		},
		OnFetched: func(s lidl.TicketSummary, items int) {
			if !prog.enabled() {
				fmt.Printf("  + %s  (%s)  %d items\n", s.ID, s.Date, items)
			}
		},
		OnProgress: func(p syncProgress) {
			prog.total = p.Total
			prog.update(p.Fetched+p.Skipped, p.Fetched, p.Skipped, p.Page)
		},
		OnNote: func(msg string) {
			prog.note("%s", msg)
		},
	}

	res, err := runSync(ctx, db, client, syncOptions{Full: *full, MaxPages: *maxPages, Since: *since}, cb)
	prog.done()
	if err != nil {
		return err
	}

	if res.ReachedSince {
		fmt.Printf("Reached --since cutoff (%s).\n", *since)
	}
	receipts, items, _ := db.Count()
	fmt.Printf("Done. Downloaded now: %d, skipped (already stored): %d.\n", res.Fetched, res.Skipped)
	fmt.Printf("Total in database: %d receipts, %d items.\n", receipts, items)
	return nil
}

// dateOnly returns the leading YYYY-MM-DD of an ISO timestamp.
func dateOnly(s string) string {
	if len(s) >= 10 {
		return s[:10]
	}
	return s
}

package main

import (
	"context"
	"flag"
	"fmt"
	"time"

	"lidlsearch/internal/config"
	"lidlsearch/internal/lidl"
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

	var fetched, skipped int
	var prog *progress
	reachedCutoff := false
	for page := 1; !reachedCutoff; page++ {
		if *maxPages > 0 && page > *maxPages {
			break
		}
		summaries, total, err := client.ListTicketsPage(ctx, page)
		if err != nil {
			return err
		}
		if prog == nil {
			prog = newProgress(total)
		}
		if len(summaries) == 0 {
			break // reached the end of the history
		}
		if !prog.enabled() {
			fmt.Printf("Page %d…\n", page)
		}

		for _, s := range summaries {
			if ctx.Err() != nil {
				prog.done()
				return ctx.Err()
			}
			// Receipts come newest-first, so once one is older than --since,
			// everything after it is too — stop.
			if *since != "" && dateOnly(s.Date) < *since {
				reachedCutoff = true
				break
			}
			// Already stored: skip it, never re-download (unless --full). We keep
			// paging so a partial history is completed and older receipts are
			// picked up — only the cheap list calls are repeated, not details.
			if !*full {
				known, err := db.HasReceipt(s.ID)
				if err != nil {
					return err
				}
				if known {
					skipped++
					prog.update(fetched+skipped, fetched, skipped, page)
					continue
				}
			}

			raw, err := client.TicketDetail(ctx, s.ID)
			if err != nil {
				prog.done()
				return fmt.Errorf("downloading receipt %s: %w", s.ID, err)
			}
			res, err := db.UpsertReceipt(ctx, s.ID, raw)
			if err != nil {
				return err
			}
			fetched++
			if prog.enabled() {
				prog.update(fetched+skipped, fetched, skipped, page)
			} else {
				fmt.Printf("  + %s  (%s)  %d items\n", s.ID, s.Date, res.ItemCount)
			}
			if res.ItemCount == 0 {
				prog.note("warning: %s has 0 items – inspect with: lidlsearch raw %s", s.ID, s.ID)
			}
		}
	}

	if prog != nil {
		prog.done()
	}
	if reachedCutoff {
		fmt.Printf("Reached --since cutoff (%s).\n", *since)
	}
	receipts, items, _ := db.Count()
	fmt.Printf("Done. Downloaded now: %d, skipped (already stored): %d.\n", fetched, skipped)
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

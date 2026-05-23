package main

import (
	"context"
	"fmt"

	"github.com/sodre90/lidl-plus-search/internal/lidl"
	"github.com/sodre90/lidl-plus-search/internal/store"
)

// syncOptions mirror the `sync` command's flags.
type syncOptions struct {
	Full     bool   // re-download all receipts, not just new ones
	MaxPages int    // limit list pages fetched (0 = all)
	Since    string // only receipts on/after this date (YYYY-MM-DD), "" = no limit
}

// syncProgress is a snapshot emitted after each receipt is processed.
type syncProgress struct {
	Total   int // receipts in the account (for a percentage), 0 if unknown
	Fetched int // downloaded so far this run
	Skipped int // already stored, skipped so far this run
	Page    int // current list page
}

// syncResult summarizes a finished sync.
type syncResult struct {
	Fetched      int
	Skipped      int
	ReachedSince bool // stopped early because of the --since cutoff
}

// syncCallbacks are optional hooks invoked during a sync. Any field may be nil.
type syncCallbacks struct {
	OnPage     func(page int)                        // a new list page is being processed
	OnFetched  func(s lidl.TicketSummary, items int) // a receipt was just downloaded
	OnProgress func(p syncProgress)                  // after each receipt (fetched or skipped)
	OnNote     func(msg string)                      // a non-fatal warning
}

// runSync downloads receipts into db, sharing one implementation between the
// CLI (`sync`) and the web UI's sync button. Progress is reported through cb;
// the caller decides how to render it.
func runSync(ctx context.Context, db *store.DB, client *lidl.Client, opts syncOptions, cb syncCallbacks) (syncResult, error) {
	var fetched, skipped, total int
	reachedCutoff := false

	for page := 1; !reachedCutoff; page++ {
		if opts.MaxPages > 0 && page > opts.MaxPages {
			break
		}
		summaries, t, err := client.ListTicketsPage(ctx, page)
		if err != nil {
			return syncResult{}, err
		}
		if t > 0 {
			total = t
		}
		if len(summaries) == 0 {
			break // reached the end of the history
		}
		if cb.OnPage != nil {
			cb.OnPage(page)
		}

		for _, s := range summaries {
			if ctx.Err() != nil {
				return syncResult{}, ctx.Err()
			}
			// Receipts come newest-first, so once one is older than --since,
			// everything after it is too — stop.
			if opts.Since != "" && dateOnly(s.Date) < opts.Since {
				reachedCutoff = true
				break
			}
			// Already stored: skip it, never re-download (unless Full). We keep
			// paging so a partial history is completed and older receipts are
			// picked up — only the cheap list calls are repeated, not details.
			if !opts.Full {
				known, err := db.HasReceipt(s.ID)
				if err != nil {
					return syncResult{}, err
				}
				if known {
					skipped++
					if cb.OnProgress != nil {
						cb.OnProgress(syncProgress{total, fetched, skipped, page})
					}
					continue
				}
			}

			raw, err := client.TicketDetail(ctx, s.ID)
			if err != nil {
				return syncResult{}, fmt.Errorf("downloading receipt %s: %w", s.ID, err)
			}
			res, err := db.UpsertReceipt(ctx, s.ID, raw)
			if err != nil {
				return syncResult{}, err
			}
			fetched++
			if cb.OnFetched != nil {
				cb.OnFetched(s, res.ItemCount)
			}
			if cb.OnProgress != nil {
				cb.OnProgress(syncProgress{total, fetched, skipped, page})
			}
			if res.ItemCount == 0 && cb.OnNote != nil {
				cb.OnNote(fmt.Sprintf("warning: %s has 0 items – inspect with: lidlsearch raw %s", s.ID, s.ID))
			}
		}
	}

	return syncResult{Fetched: fetched, Skipped: skipped, ReachedSince: reachedCutoff}, nil
}

package main

import (
	"fmt"
	"os"
	"strings"
)

// progress renders a sync progress bar. In a real terminal it updates a single
// line in place; when stdout is piped/redirected it stays silent so the plain
// per-receipt log lines (printed elsewhere) remain readable.
type progress struct {
	tty   bool
	total int
	width int
}

func newProgress(total int) *progress {
	fi, _ := os.Stdout.Stat()
	tty := fi != nil && fi.Mode()&os.ModeCharDevice != 0
	return &progress{tty: tty, total: total, width: 28}
}

// enabled reports whether the in-place bar is being drawn (i.e. a terminal).
func (p *progress) enabled() bool { return p.tty }

// update redraws the bar. processed is fetched+skipped so far.
func (p *progress) update(processed, fetched, skipped, page int) {
	if !p.tty {
		return
	}
	var pct float64
	if p.total > 0 {
		pct = float64(processed) / float64(p.total)
		if pct > 1 {
			pct = 1
		}
	}
	filled := int(pct * float64(p.width))
	bar := strings.Repeat("█", filled) + strings.Repeat("░", p.width-filled)
	if p.total > 0 {
		fmt.Printf("\r\033[K[%s] %3.0f%%  %d/%d  +%d new  %d skipped  (page %d)",
			bar, pct*100, processed, p.total, fetched, skipped, page)
	} else {
		fmt.Printf("\r\033[K%d processed  +%d new  %d skipped  (page %d)",
			processed, fetched, skipped, page)
	}
}

// note prints a one-off message on its own line without disturbing the bar.
func (p *progress) note(format string, a ...any) {
	if p.tty {
		fmt.Print("\r\033[K")
	}
	fmt.Printf(format+"\n", a...)
}

// done clears the bar line so following output starts clean.
func (p *progress) done() {
	if p.tty {
		fmt.Print("\r\033[K")
	}
}

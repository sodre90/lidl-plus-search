// Command lidlsearch downloads your Lidl Plus receipts and searches them.
//
// Commands:
//
//	login              sign in (once; stores a refresh token)
//	sync               download/update receipts
//	search <word>      search across item names (filters: --from --to --min --max)
//	list               list recent receipts
//	show <id>          show one receipt's items
//	raw <id>           print one receipt's raw JSON (debug)
package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"

	"github.com/sodre90/lidl-plus-search/internal/config"
	"github.com/sodre90/lidl-plus-search/internal/store"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	args := os.Args[2:]
	var err error
	switch os.Args[1] {
	case "login":
		err = cmdLogin(ctx, args)
	case "sync":
		err = cmdSync(ctx, args)
	case "search":
		err = cmdSearch(args)
	case "list":
		err = cmdList(args)
	case "show":
		err = cmdShow(args)
	case "raw":
		err = cmdRaw(args)
	case "help", "-h", "--help":
		usage()
	default:
		fmt.Fprintf(os.Stderr, "unknown command: %s\n\n", os.Args[1])
		usage()
		os.Exit(2)
	}

	if err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func usage() {
	fmt.Print(`lidlsearch – download Lidl Plus receipts and search them

Usage:
  lidlsearch login              sign in via browser (only needed once)
  lidlsearch sync               download receipts (new ones by default)
       --since YYYY-MM-DD        only receipts on/after this date
       --full                   re-download/re-parse everything
       --pages N                limit number of list pages fetched
  lidlsearch search <word> [...]search across item names
       --from YYYY-MM-DD        from this date
       --to   YYYY-MM-DD        up to this date
       --min  N                 minimum item price
       --max  N                 maximum item price
       --limit N                max number of results
  lidlsearch list [--limit N]   recent receipts
  lidlsearch show <id>          one receipt's items
  lidlsearch raw <id>           one receipt's raw JSON

Override country/language with the LIDL_COUNTRY and LIDL_LANGUAGE env vars.
`)
}

// openDB opens the database at the configured path.
func openDB() (*store.DB, error) {
	path, err := config.DBPath()
	if err != nil {
		return nil, err
	}
	return store.Open(path)
}

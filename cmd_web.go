package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"net"
	"net/http"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/sodre90/lidl-plus-search/internal/config"
	"github.com/sodre90/lidl-plus-search/internal/lidl"
	"github.com/sodre90/lidl-plus-search/internal/store"
	"github.com/sodre90/lidl-plus-search/internal/web"
)

// cmdWeb starts a local web server that serves a small JSON API (backed by the
// existing store) and an embedded single-page frontend, then opens a browser.
func cmdWeb(ctx context.Context, args []string) error {
	fs := flag.NewFlagSet("web", flag.ContinueOnError)
	addr := fs.String("addr", "127.0.0.1:8787", "address to listen on (host:port)")
	noOpen := fs.Bool("no-open", false, "do not open a browser automatically")
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

	srv := &http.Server{
		Addr:              *addr,
		Handler:           newRouter(db),
		ReadHeaderTimeout: 10 * time.Second,
	}

	// Bind the listener up front so we can report the real URL (and surface a
	// port-in-use error before pretending to serve).
	ln, err := net.Listen("tcp", *addr)
	if err != nil {
		return fmt.Errorf("listen on %s: %w", *addr, err)
	}

	url := "http://" + browserHost(ln.Addr().String())
	fmt.Printf("lidlsearch web — serving on %s\n", url)
	fmt.Println("Press Ctrl+C to stop.")

	errc := make(chan error, 1)
	go func() {
		err := srv.Serve(ln)
		if errors.Is(err, http.ErrServerClosed) {
			err = nil
		}
		errc <- err
	}()

	if !*noOpen {
		if err := openBrowser(url); err != nil {
			fmt.Printf("(could not open browser automatically: %v)\n", err)
		}
	}

	select {
	case <-ctx.Done():
		fmt.Println("\nshutting down…")
		shutCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		return srv.Shutdown(shutCtx)
	case err := <-errc:
		return err
	}
}

// newRouter wires the HTTP handlers: the embedded frontend at / and the JSON
// API under /api/.
func newRouter(db *store.DB) http.Handler {
	mux := http.NewServeMux()
	mux.Handle("GET /", http.FileServerFS(web.Assets()))
	mux.HandleFunc("GET /api/stats", apiStats(db))
	mux.HandleFunc("GET /api/receipts", apiReceipts(db))
	mux.HandleFunc("GET /api/monthly", apiMonthly(db))
	mux.HandleFunc("GET /api/search", apiSearch(db))
	mux.HandleFunc("GET /api/receipt/{id}", apiReceipt(db))
	mux.HandleFunc("POST /api/sync", apiSync(db))
	return mux
}

// syncRunning guards against starting more than one sync at a time (the Lidl
// backend and the local DB are shared, and the UI only needs one).
var syncRunning atomic.Bool

// apiSync downloads receipts and streams progress back as newline-delimited
// JSON ("application/x-ndjson"): one {"type":...} object per line. Event types
// are "progress", "note", "done", and "error".
func apiSync(db *store.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/x-ndjson")
		w.Header().Set("Cache-Control", "no-cache")

		flusher, _ := w.(http.Flusher)
		enc := json.NewEncoder(w)
		emit := func(v any) {
			_ = enc.Encode(v)
			if flusher != nil {
				flusher.Flush()
			}
		}
		emitErr := func(status int, msg string) {
			w.WriteHeader(status)
			emit(map[string]any{"type": "error", "message": msg})
		}

		if !syncRunning.CompareAndSwap(false, true) {
			emitErr(http.StatusConflict, "a sync is already running")
			return
		}
		defer syncRunning.Store(false)

		tokens, err := config.LoadTokens()
		if err != nil {
			emitErr(http.StatusBadRequest, err.Error())
			return
		}
		client := lidl.New(tokens, config.Country())

		opts := syncOptions{
			Full:     r.URL.Query().Get("full") == "1",
			MaxPages: intParam(r, "pages", 0),
			Since:    r.URL.Query().Get("since"),
		}

		// Throttle progress lines so a fast run of skips doesn't flood the
		// stream; the trailing "done" event always carries the final totals.
		var last time.Time
		cb := syncCallbacks{
			OnProgress: func(p syncProgress) {
				now := time.Now()
				if now.Sub(last) < 80*time.Millisecond {
					return
				}
				last = now
				emit(map[string]any{
					"type": "progress", "total": p.Total,
					"fetched": p.Fetched, "skipped": p.Skipped, "page": p.Page,
				})
			},
			OnNote: func(msg string) {
				emit(map[string]any{"type": "note", "message": msg})
			},
		}

		res, err := runSync(r.Context(), db, client, opts, cb)
		if err != nil {
			emit(map[string]any{"type": "error", "message": err.Error()})
			return
		}
		receipts, items, _ := db.Count()
		emit(map[string]any{
			"type": "done", "fetched": res.Fetched, "skipped": res.Skipped,
			"reachedSince": res.ReachedSince, "receipts": receipts, "items": items,
		})
	}
}

// --- API handlers ---

// item is the JSON shape of a single line item shared by search and receipt
// responses.
type item struct {
	ReceiptID  string  `json:"receiptId"`
	Date       string  `json:"date"`
	Name       string  `json:"name"`
	Quantity   float64 `json:"quantity"`
	UnitPrice  float64 `json:"unitPrice"`
	TotalPrice float64 `json:"totalPrice"`
	Currency   string  `json:"currency"`
}

func toItem(r store.SearchResult) item {
	return item{
		ReceiptID:  r.ReceiptID,
		Date:       r.Date,
		Name:       r.ItemName,
		Quantity:   r.Quantity,
		UnitPrice:  r.UnitPrice,
		TotalPrice: r.TotalPrice,
		Currency:   r.Currency,
	}
}

func apiStats(db *store.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		receipts, items, err := db.Count()
		if err != nil {
			writeErr(w, err)
			return
		}
		writeJSON(w, map[string]int{"receipts": receipts, "items": items})
	}
}

func apiReceipts(db *store.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		limit := intParam(r, "limit", 50)
		rows, err := db.Receipts(limit)
		if err != nil {
			writeErr(w, err)
			return
		}
		type receipt struct {
			ID          string  `json:"id"`
			Date        string  `json:"date"`
			TotalAmount float64 `json:"totalAmount"`
			Currency    string  `json:"currency"`
			ItemCount   int     `json:"itemCount"`
		}
		out := make([]receipt, 0, len(rows))
		for _, r := range rows {
			out = append(out, receipt{r.ID, r.Date, r.TotalAmount, r.Currency, r.ItemCount})
		}
		writeJSON(w, map[string]any{"receipts": out})
	}
}

func apiMonthly(db *store.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		rows, currency, err := db.MonthlyTotals()
		if err != nil {
			writeErr(w, err)
			return
		}
		type month struct {
			Month string  `json:"month"`
			Total float64 `json:"total"`
			Count int     `json:"count"`
		}
		out := make([]month, 0, len(rows))
		for _, m := range rows {
			out = append(out, month{m.Month, m.Total, m.Count})
		}
		writeJSON(w, map[string]any{"months": out, "currency": currency})
	}
}

func apiSearch(db *store.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		q := strings.TrimSpace(r.URL.Query().Get("q"))
		opts := store.SearchOpts{
			From:    r.URL.Query().Get("from"),
			To:      r.URL.Query().Get("to"),
			MinPric: floatParam(r, "min"),
			MaxPric: floatParam(r, "max"),
			Limit:   intParam(r, "limit", 500),
		}
		results, err := db.Search(q, opts)
		if err != nil {
			writeErr(w, err)
			return
		}
		out := make([]item, 0, len(results))
		var total float64
		currency := ""
		for _, res := range results {
			out = append(out, toItem(res))
			total += res.TotalPrice
			if currency == "" {
				currency = res.Currency
			}
		}
		writeJSON(w, map[string]any{
			"results":  out,
			"count":    len(out),
			"total":    total,
			"currency": currency,
		})
	}
}

func apiReceipt(db *store.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		items, err := db.ReceiptItems(id)
		if err != nil {
			writeErr(w, err)
			return
		}
		if len(items) == 0 {
			http.Error(w, `{"error":"no such receipt (or it has no items)"}`, http.StatusNotFound)
			return
		}
		out := make([]item, 0, len(items))
		var total float64
		for _, it := range items {
			out = append(out, toItem(it))
			total += it.TotalPrice
		}
		writeJSON(w, map[string]any{
			"id":       id,
			"date":     items[0].Date,
			"currency": items[0].Currency,
			"items":    out,
			"total":    total,
		})
	}
}

// --- helpers ---

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if err := json.NewEncoder(w).Encode(v); err != nil {
		writeErr(w, err)
	}
}

func writeErr(w http.ResponseWriter, err error) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusInternalServerError)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
}

func intParam(r *http.Request, name string, def int) int {
	if v := r.URL.Query().Get(name); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

func floatParam(r *http.Request, name string) float64 {
	if v := r.URL.Query().Get(name); v != "" {
		if f, err := strconv.ParseFloat(v, 64); err == nil {
			return f
		}
	}
	return 0
}

// browserHost turns a listen address into something a browser can open,
// rewriting a wildcard/empty host to localhost.
func browserHost(addr string) string {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return addr
	}
	if host == "" || host == "0.0.0.0" || host == "::" {
		host = "localhost"
	}
	return net.JoinHostPort(host, port)
}

// openBrowser opens url in the user's default browser.
func openBrowser(url string) error {
	switch runtime.GOOS {
	case "darwin":
		return exec.Command("open", url).Start()
	case "windows":
		return exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	default:
		return exec.Command("xdg-open", url).Start()
	}
}

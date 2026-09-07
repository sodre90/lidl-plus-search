# lidlsearch

*English · [Magyar](README.hu.md)*

A small command-line tool that downloads your **Lidl Plus** receipts and lets you
search the items on them — for example "how often and at what price did I buy
bread?".

It's especially handy for **warranty claims**: when a product breaks months
later it's hard to dig up the right receipt, so just search the item name to find
which receipt it's on, then `show` that receipt as proof of purchase.

It stores everything **locally** (a SQLite database in your config directory) and
talks directly to the Lidl Plus backend; nothing is sent anywhere else.

> ⚠️ **Unofficial.** Lidl Plus has no public API. This tool mimics the official
> mobile app's login and endpoints, reverse-engineered by the community. It can
> break at any time if Lidl changes things, and is intended for accessing **your
> own** account data only.

## How it works

1. **`login`** opens a real Chrome window where you sign in (password + 2FA). The
   app uses the OAuth2 *authorization code + PKCE* flow, captures the
   `com.lidlplus.app://callback?code=...` redirect, and exchanges it for a
   **refresh token** stored on disk. You only do this once.
2. **`sync`** uses the refresh token to fetch your receipts and stores them in
   SQLite. It lists receipts via `tickets.lidlplus.com/api/v2/{country}/tickets`
   and fetches each one's detail via `.../api/v3/{country}/tickets/{id}`. For HU
   the line items are embedded in the receipt's printed HTML, which is parsed
   into searchable rows. The full raw JSON of every receipt is also kept. A live
   progress bar is shown in a terminal (and plain log lines when piped).
3. **`search` / `list` / `show`** query the local database — fast and offline.
4. **`web`** starts a small local server and opens a browser with a point-and-click
   UI (live search, filters, a price-over-time chart, and clickable receipts).

## Mobile app

There is also a standalone app (Expo / React Native) in [`mobile/`](mobile/)
that does everything on the device — login, sync, browse, search, and spending
charts — with no server. It ports the same login, parser, and search logic used
here.

**Android only, in practice.** The codebase is cross-platform, but it has only
ever been built and tested on Android; **iOS has never been run even once**, so
whether it works there is unknown.

**Android:** download the `.apk` from the
[latest release](https://github.com/sodre90/lidl-plus-search/releases/latest)
and open it on your phone (Android will ask you to allow installs from your
browser). It is signed but not distributed through Play, so you will see the
usual "unknown app" warning.

Build instructions and the iOS story are in [mobile/README.md](mobile/README.md).

## Requirements

- **Go** 1.22+ (to build) — `go build` will auto-fetch a newer toolchain if a
  dependency asks for one.
- **Google Chrome** installed (used only for the one-time `login`).

## Build

```sh
go build -o lidlsearch .
```

Or install the latest straight from GitHub:

```sh
go install github.com/sodre90/lidl-plus-search@latest
```

> `go install` names the binary `lidl-plus-search` (after the repo). The examples
> below use the shorter `lidlsearch`; either alias it, or build locally with
> `go build -o lidlsearch .`.

## Usage

```sh
# 1. Sign in (opens a browser; only needed once)
./lidlsearch login

# 2. Download your receipts (incremental — only new ones after the first run)
./lidlsearch sync
./lidlsearch sync --since 2025-01-01   # don't go further back than this date
./lidlsearch sync --full               # re-download/re-parse everything
./lidlsearch sync --pages 1            # only the most recent page (~25 receipts; mainly for testing)

# 3. Search the items
./lidlsearch search bread
./lidlsearch search milk --from 2026-01-01 --to 2026-03-31
./lidlsearch search coffee --min 1000 --limit 20

# Browse
./lidlsearch list                  # recent receipts
./lidlsearch show <receipt-id>     # items on one receipt
./lidlsearch raw <receipt-id>      # raw JSON (for debugging)

# Or use the web UI
./lidlsearch web                   # opens http://127.0.0.1:8787 in your browser
./lidlsearch web --addr :9000      # listen on a different port
./lidlsearch web --no-open         # don't auto-open a browser
```

Search is **accent- and case-insensitive** (e.g. `kenyer` matches `Kenyér`).

## Web UI

`lidlsearch web` serves a small single-page app from the binary itself (nothing
is fetched from the internet) and opens it in your browser. On load it shows a
**spending-by-month** chart and your recent receipts; type in the search box for
live, accent-insensitive results
with date/price filters, interactive charts (unit price over time and spend per
month, with hover tooltips), and a summary of how much you spent. Click any row
to see the full receipt. The **Sync** button in the header
downloads new receipts (the same incremental sync as the CLI) with live progress,
then refreshes the view. Press Ctrl+C in the terminal to stop the server.

The UI is a React + TypeScript app (built with Vite) whose compiled output is
committed under `internal/web/assets` and embedded via `go:embed`, so plain
`go build` / `go install` produce a self-contained binary — **Node is only needed
to change the UI**, not to run it. To rebuild it after editing the frontend:

```sh
cd frontend
npm install      # first time only
npm run build    # writes the compiled UI into ../internal/web/assets
```

For frontend development with hot reload, run the Go server (`./lidlsearch web`)
and, in another terminal, `npm run dev` inside `frontend/` — Vite proxies `/api`
calls to the Go server on port 8787.

## Configuration

| What | Where |
| --- | --- |
| Tokens | `<config-dir>/lidl-plus-item-search/token.json` (mode `0600`) |
| Database | `<config-dir>/lidl-plus-item-search/lidl.db` |

`<config-dir>` is `os.UserConfigDir()` — on macOS that is
`~/Library/Application Support`.

The account country/language default to **Hungary** (`HU` / `hu-HU`). Override
with environment variables if needed:

```sh
LIDL_COUNTRY=DE LIDL_LANGUAGE=de-DE ./lidlsearch sync
```

## Notes & troubleshooting

- **Login doesn't auto-capture the code.** Some setups don't surface the
  custom-scheme redirect to the app. In that case copy the URL that starts with
  `com.lidlplus.app://callback?...` from the browser's address bar, paste it into
  the terminal, and press Enter.
- **The first `sync` is slow.** It makes one request per receipt, so a long
  history takes a while. Use `--since YYYY-MM-DD` to skip older receipts (e.g.
  only the last year), or `--pages N` to bound it. Later syncs are incremental:
  receipts already in the database are skipped and never re-downloaded — only the
  fast list pages are re-fetched to find new or still-missing receipts, so a
  partial history (e.g. after `--pages`) is completed on the next full run.
- **A receipt shows `0 items`.** Items are parsed from the receipt's printed HTML
  (HU format). The raw JSON is always stored, so run
  `./lidlsearch raw <receipt-id>` to inspect the real structure; the parser lives
  in `internal/store/htmlreceipt.go` and can be adjusted.
- **Refresh token expired / 401 errors.** Run `./lidlsearch login` again.
- **`App-Version` header.** The tickets backend crashes (HTTP/2 `INTERNAL_ERROR`)
  on the value `999.99.9`; the client sends a normal version instead. The detail
  endpoint also requires a 2-character `Accept-Language` (the country code).

## Project layout

```
main.go            CLI entry + command dispatch
cmd_*.go           command implementations (login, sync, search/list/show/raw, web)
cmd_web.go         local web server + JSON API (reuses internal/store)
internal/config    config dir, token + database paths, country/language
internal/auth      OAuth2 PKCE flow + chromedp browser login
internal/lidl      authenticated receipts API client
internal/store     SQLite storage, parsing, accent-insensitive search
internal/web       embedded web UI assets (built from frontend/)
frontend/          React + TypeScript UI source (Vite); builds into internal/web/assets
```

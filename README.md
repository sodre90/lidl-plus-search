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

## Requirements

- **Go** 1.22+ (to build) — `go build` will auto-fetch a newer toolchain if a
  dependency asks for one.
- **Google Chrome** installed (used only for the one-time `login`).

## Build

```sh
go build -o lidlsearch .
```

Optionally install it on your `PATH`:

```sh
go install .   # puts `lidlsearch` in $(go env GOPATH)/bin
```

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
```

Search is **accent- and case-insensitive** (e.g. `kenyer` matches `Kenyér`).

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
cmd_*.go           command implementations (login, sync, search/list/show/raw)
internal/config    config dir, token + database paths, country/language
internal/auth      OAuth2 PKCE flow + chromedp browser login
internal/lidl      authenticated receipts API client
internal/store     SQLite storage, parsing, accent-insensitive search
```

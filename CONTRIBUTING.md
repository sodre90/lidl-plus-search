# Contributing

Thanks for your interest in improving **lidlsearch**!

## Development

```sh
go build ./...    # build
go vet ./...      # static checks
go test ./...     # tests
gofmt -l .        # must print nothing (run `gofmt -w .` to fix)
```

CI runs all of the above on every push and pull request.

## Guidelines

- Keep code and documentation in **English**.
- Run `gofmt` before committing; CI fails on unformatted files.
- Add or update tests for behavior changes (see `internal/store/*_test.go`).
- Never commit personal data: tokens and the SQLite database live in your config
  directory (`os.UserConfigDir()/lidl-plus-item-search/`), not in the repo, and
  `.gitignore` already excludes the built binary and `*.db` files.

## Notes on the Lidl Plus API

This project talks to an **unofficial**, reverse-engineered API that can change
without notice. If `sync` breaks, the most likely culprits are the endpoints and
header quirks documented inline:

- `internal/lidl/client.go` — endpoints, required headers, token refresh.
- `internal/store/htmlreceipt.go` — parsing line items out of the receipt HTML.

The full raw JSON of every receipt is stored, so `lidlsearch raw <id>` is the
fastest way to inspect the real structure when adapting the parser.

## Bug reports

Please include the failing command, the error output, and (with personal details
redacted) the relevant part of `lidlsearch raw <id>` when a receipt parses
incorrectly.

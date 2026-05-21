package auth

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/chromedp/cdproto/network"
	"github.com/chromedp/cdproto/page"
	"github.com/chromedp/chromedp"
)

// Login opens a visible Chrome window for the Lidl Plus sign-in. The user types
// everything (password + 2FA) in the browser; the authorization code from the
// redirect is captured automatically and exchanged for tokens.
//
// As a fallback, the callback URL can also be pasted into the terminal.
func Login(ctx context.Context, country, language string) (*TokenResponse, error) {
	pkce, err := NewPKCE()
	if err != nil {
		return nil, err
	}
	state, err := randomState()
	if err != nil {
		return nil, err
	}
	authURL := AuthorizeURL(pkce, country, language, state)

	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", false),
		chromedp.Flag("disable-blink-features", "AutomationControlled"),
		chromedp.WindowSize(1200, 900),
	)
	allocCtx, cancelAlloc := chromedp.NewExecAllocator(ctx, opts...)
	defer cancelAlloc()
	browserCtx, cancelBrowser := chromedp.NewContext(allocCtx)
	defer cancelBrowser()

	codeCh := make(chan string, 1)
	errCh := make(chan error, 1)

	// The browser cannot load the custom-scheme redirect, but the full URL
	// (with the code) shows up in the navigation/network events.
	handle := func(rawURL string) {
		if !strings.HasPrefix(rawURL, redirectURI) {
			return
		}
		code, err := extractCode(rawURL, state)
		if err != nil {
			select {
			case errCh <- err:
			default:
			}
			return
		}
		select {
		case codeCh <- code:
		default:
		}
	}
	chromedp.ListenTarget(browserCtx, func(ev interface{}) {
		switch e := ev.(type) {
		case *page.EventFrameRequestedNavigation:
			handle(e.URL)
		case *network.EventRequestWillBeSent:
			if e.Request != nil {
				handle(e.Request.URL)
			}
		}
	})

	if err := chromedp.Run(browserCtx,
		page.Enable(),
		network.Enable(),
		chromedp.Navigate(authURL),
	); err != nil && !isIgnorableNavErr(err) {
		return nil, fmt.Errorf("failed to start the browser: %w", err)
	}

	fmt.Println("A browser window opened – sign in to your Lidl Plus account (password + 2FA).")
	fmt.Println("The code is captured automatically. If it isn't, paste the URL that")
	fmt.Println("starts with \"" + redirectURI + "?...\" here and press Enter.")

	// Fallback: paste the callback URL into the terminal.
	go func() {
		sc := bufio.NewScanner(os.Stdin)
		for sc.Scan() {
			line := strings.TrimSpace(sc.Text())
			if strings.HasPrefix(line, redirectURI) {
				handle(line)
				return
			}
		}
	}()

	select {
	case code := <-codeCh:
		fmt.Println("Code received, exchanging for tokens…")
		return ExchangeCode(ctx, code, pkce.Verifier)
	case err := <-errCh:
		return nil, err
	case <-time.After(5 * time.Minute):
		return nil, fmt.Errorf("timed out – login did not complete within 5 minutes")
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// isIgnorableNavErr reports navigation errors caused by the custom-scheme
// redirect, which are expected rather than real failures.
func isIgnorableNavErr(err error) bool {
	s := err.Error()
	return strings.Contains(s, "net::ERR_ABORTED") ||
		strings.Contains(s, "net::ERR_UNKNOWN_URL_SCHEME")
}

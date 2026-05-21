// Package lidl is the authenticated client for the Lidl Plus receipts API.
package lidl

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/sodre90/lidl-plus-search/internal/auth"
	"github.com/sodre90/lidl-plus-search/internal/config"
)

const ticketsHost = "https://tickets.lidlplus.com/api"

// Client makes authenticated Lidl Plus API calls. It refreshes the access token
// automatically using the refresh token and persists any change.
type Client struct {
	http    *http.Client
	country string

	mu     sync.Mutex
	tokens *config.Tokens
}

// New creates a client from the stored tokens.
func New(tokens *config.Tokens, country string) *Client {
	return &Client{
		http:    &http.Client{Timeout: 30 * time.Second},
		country: country,
		tokens:  tokens,
	}
}

// accessToken returns a valid access token, refreshing it if necessary.
func (c *Client) accessToken(ctx context.Context) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.tokens.AccessToken != "" && time.Now().Unix() < c.tokens.ExpiresAt-30 {
		return c.tokens.AccessToken, nil
	}
	return c.refreshLocked(ctx)
}

func (c *Client) refreshLocked(ctx context.Context) (string, error) {
	tr, err := auth.Refresh(ctx, c.tokens.RefreshToken)
	if err != nil {
		return "", fmt.Errorf("failed to refresh token (run `login` again): %w", err)
	}
	c.tokens.AccessToken = tr.AccessToken
	if tr.RefreshToken != "" {
		c.tokens.RefreshToken = tr.RefreshToken
	}
	c.tokens.ExpiresAt = time.Now().Unix() + int64(tr.ExpiresIn)
	if err := config.SaveTokens(c.tokens); err != nil {
		return "", err
	}
	return c.tokens.AccessToken, nil
}

// get performs an authenticated GET. On 401 it refreshes once and retries.
func (c *Client) get(ctx context.Context, url string) ([]byte, error) {
	body, status, err := c.doGet(ctx, url, false)
	if err != nil {
		return nil, err
	}
	if status == http.StatusUnauthorized {
		body, status, err = c.doGet(ctx, url, true)
		if err != nil {
			return nil, err
		}
	}
	if status != http.StatusOK {
		return nil, fmt.Errorf("API error (%d): %s", status, strings.TrimSpace(string(body)))
	}
	return body, nil
}

func (c *Client) doGet(ctx context.Context, url string, forceRefresh bool) ([]byte, int, error) {
	if forceRefresh {
		c.mu.Lock()
		c.tokens.ExpiresAt = 0 // force the next accessToken() call to refresh
		c.mu.Unlock()
	}
	token, err := c.accessToken(ctx)
	if err != nil {
		return nil, 0, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	// Note: App-Version "999.99.9" crashes the tickets backend (HTTP/2
	// INTERNAL_ERROR); use a normal version. Accept-Language must be a
	// 2-char code (the country code), or the v3 detail endpoint returns 400.
	req.Header.Set("App-Version", "14.21.2")
	req.Header.Set("Operating-System", "iOS")
	req.Header.Set("App", "com.lidl.eci.lidl.plus")
	req.Header.Set("Accept-Language", c.country)
	req.Header.Set("Accept", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	return body, resp.StatusCode, nil
}

// TicketSummary holds the minimal fields of a receipt-list entry.
type TicketSummary struct {
	ID            string  `json:"id"`
	Date          string  `json:"date"`
	TotalAmount   float64 `json:"totalAmount"`
	ArticlesCount int     `json:"articlesCount"`
	IsFavorite    bool    `json:"isFavorite"`
}

type ticketListResponse struct {
	Tickets    []TicketSummary `json:"tickets"`
	Size       int             `json:"size"`
	Page       int             `json:"page"`
	TotalCount int             `json:"totalCount"`
}

// ListTicketsPage fetches one page of receipt summaries (1-indexed). It also
// returns the total number of receipts in the account (for progress display).
func (c *Client) ListTicketsPage(ctx context.Context, page int) (summaries []TicketSummary, total int, err error) {
	url := fmt.Sprintf("%s/v2/%s/tickets?pageNumber=%d&onlyFavorite=false", ticketsHost, c.country, page)
	body, err := c.get(ctx, url)
	if err != nil {
		return nil, 0, err
	}
	var resp ticketListResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, 0, fmt.Errorf("failed to parse receipt list: %w", err)
	}
	return resp.Tickets, resp.TotalCount, nil
}

// TicketDetail fetches a receipt's full (raw JSON) detail. For HU the line
// items live inside the htmlPrintedReceipt field (see internal/store).
func (c *Client) TicketDetail(ctx context.Context, id string) (json.RawMessage, error) {
	url := fmt.Sprintf("%s/v3/%s/tickets/%s", ticketsHost, c.country, id)
	body, err := c.get(ctx, url)
	if err != nil {
		return nil, err
	}
	return json.RawMessage(body), nil
}

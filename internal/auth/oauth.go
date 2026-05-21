// Package auth performs the Lidl Plus OAuth2 (PKCE) login and token handling.
//
// Login mimics the official mobile app: the user signs in via a real browser
// window (password + 2FA), then the authorization code extracted from the
// `com.lidlplus.app://callback?code=...` redirect is exchanged for tokens with a
// plain HTTP POST. Every subsequent call is token-based.
package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	authBase     = "https://accounts.lidl.com"
	clientID     = "LidlPlusNativeClient"
	clientSecret = "secret"
	redirectURI  = "com.lidlplus.app://callback"
	scope        = "openid profile offline_access lpprofile lpapis"
)

// PKCE holds a Proof Key for Code Exchange verifier/challenge pair.
type PKCE struct {
	Verifier  string
	Challenge string
}

// NewPKCE generates a fresh PKCE pair (S256).
func NewPKCE() (PKCE, error) {
	b := make([]byte, 64)
	if _, err := rand.Read(b); err != nil {
		return PKCE{}, err
	}
	verifier := base64.RawURLEncoding.EncodeToString(b)
	sum := sha256.Sum256([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(sum[:])
	return PKCE{Verifier: verifier, Challenge: challenge}, nil
}

// randomState returns a URL-safe random state string (CSRF protection).
func randomState() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// AuthorizeURL builds the authorize endpoint URL for the browser-based login.
func AuthorizeURL(p PKCE, country, language, state string) string {
	v := url.Values{}
	v.Set("client_id", clientID)
	v.Set("response_type", "code")
	v.Set("scope", scope)
	v.Set("redirect_uri", redirectURI)
	v.Set("code_challenge", p.Challenge)
	v.Set("code_challenge_method", "S256")
	v.Set("state", state)
	v.Set("Country", country)
	v.Set("language", language)
	return authBase + "/connect/authorize?" + v.Encode()
}

// TokenResponse is the /connect/token endpoint response.
type TokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	TokenType    string `json:"token_type"`
	Scope        string `json:"scope"`
}

// ExchangeCode exchanges the authorization code for access/refresh tokens.
func ExchangeCode(ctx context.Context, code, verifier string) (*TokenResponse, error) {
	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("redirect_uri", redirectURI)
	form.Set("code_verifier", verifier)
	return postToken(ctx, form)
}

// Refresh requests a new access token using the refresh token. Lidl may rotate
// the refresh token, so the caller should persist the one in the response when
// it is non-empty.
func Refresh(ctx context.Context, refreshToken string) (*TokenResponse, error) {
	form := url.Values{}
	form.Set("grant_type", "refresh_token")
	form.Set("refresh_token", refreshToken)
	return postToken(ctx, form)
}

func postToken(ctx context.Context, form url.Values) (*TokenResponse, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		authBase+"/connect/token", strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(clientID, clientSecret)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("token endpoint error (%d): %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	var tr TokenResponse
	if err := json.Unmarshal(body, &tr); err != nil {
		return nil, fmt.Errorf("failed to parse token response: %w", err)
	}
	return &tr, nil
}

// extractCode pulls the authorization code from the callback URL and verifies
// the state. If Lidl returned an error, it is surfaced as an error.
func extractCode(callbackURL, wantState string) (string, error) {
	u, err := url.Parse(callbackURL)
	if err != nil {
		return "", fmt.Errorf("failed to parse callback URL: %w", err)
	}
	q := u.Query()
	if e := q.Get("error"); e != "" {
		desc := q.Get("error_description")
		return "", fmt.Errorf("login error: %s %s", e, desc)
	}
	code := q.Get("code")
	if code == "" {
		return "", fmt.Errorf("callback did not contain a code")
	}
	if st := q.Get("state"); st != "" && wantState != "" && st != wantState {
		return "", fmt.Errorf("state mismatch – possible CSRF, please try again")
	}
	return code, nil
}

// Package config manages the app's local data: stored tokens, the database
// path, and the country/language settings.
package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

const appDir = "lidl-plus-item-search"

// Tokens holds the Lidl Plus OAuth tokens persisted on disk.
type Tokens struct {
	RefreshToken string `json:"refresh_token"`
	AccessToken  string `json:"access_token,omitempty"`
	// ExpiresAt is the access token expiry as a Unix timestamp (seconds).
	ExpiresAt int64 `json:"expires_at,omitempty"`
}

// Country is the Lidl Plus account country code (override with LIDL_COUNTRY).
func Country() string {
	if v := os.Getenv("LIDL_COUNTRY"); v != "" {
		return v
	}
	return "HU"
}

// Language is the language code sent to the API (override with LIDL_LANGUAGE).
func Language() string {
	if v := os.Getenv("LIDL_LANGUAGE"); v != "" {
		return v
	}
	return "hu-HU"
}

// Dir returns (and creates) the app's configuration directory.
func Dir() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(base, appDir)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", err
	}
	return dir, nil
}

func tokenPath() (string, error) {
	dir, err := Dir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "token.json"), nil
}

// DBPath returns the path to the SQLite database file.
func DBPath() (string, error) {
	dir, err := Dir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "lidl.db"), nil
}

// LoadTokens reads the stored tokens. Returns an error if none are saved yet.
func LoadTokens() (*Tokens, error) {
	p, err := tokenPath()
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(p)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("not logged in yet – run the `login` command first")
		}
		return nil, err
	}
	var t Tokens
	if err := json.Unmarshal(data, &t); err != nil {
		return nil, fmt.Errorf("corrupt token file: %w", err)
	}
	return &t, nil
}

// SaveTokens writes the tokens to disk with 0600 permissions.
func SaveTokens(t *Tokens) error {
	p, err := tokenPath()
	if err != nil {
		return err
	}
	data, err := json.MarshalIndent(t, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(p, data, 0o600)
}

package main

import (
	"context"
	"fmt"
	"time"

	"github.com/sodre90/lidl-plus-search/internal/auth"
	"github.com/sodre90/lidl-plus-search/internal/config"
)

func cmdLogin(ctx context.Context, _ []string) error {
	tr, err := auth.Login(ctx, config.Country(), config.Language())
	if err != nil {
		return err
	}
	if tr.RefreshToken == "" {
		return fmt.Errorf("Lidl did not return a refresh token – please try again")
	}
	tokens := &config.Tokens{
		RefreshToken: tr.RefreshToken,
		AccessToken:  tr.AccessToken,
		ExpiresAt:    time.Now().Unix() + int64(tr.ExpiresIn),
	}
	if err := config.SaveTokens(tokens); err != nil {
		return err
	}
	fmt.Println("Logged in successfully. Now run: lidlsearch sync")
	return nil
}

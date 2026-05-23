// Package web holds the embedded assets for the `lidlsearch web` UI.
package web

import (
	"embed"
	"io/fs"
)

//go:embed assets
var assets embed.FS

// Assets returns the static frontend files (index.html, style.css, app.js)
// rooted at the assets directory.
func Assets() fs.FS {
	sub, err := fs.Sub(assets, "assets")
	if err != nil {
		// The embed path is a compile-time constant, so this can't fail.
		panic(err)
	}
	return sub
}

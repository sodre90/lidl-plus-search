package store

import (
	"strconv"
	"strings"
	"unicode"

	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
)

// normalize lowercases and strips accents so searches are accent- and
// case-insensitive (e.g. "Kenyér" matches "kenyer").
func normalize(s string) string {
	t := transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC)
	out, _, err := transform.String(t, s)
	if err != nil {
		out = s
	}
	return strings.ToLower(strings.TrimSpace(out))
}

// parseAmount parses a possibly European-formatted amount ("1.234,56",
// "1234,56", "1 234 Ft") into a float. Returns 0 on invalid input.
func parseAmount(s string) float64 {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0
	}
	// Keep only digits, decimal/thousand separators and a sign.
	s = strings.Map(func(r rune) rune {
		if unicode.IsDigit(r) || r == ',' || r == '.' || r == '-' {
			return r
		}
		return -1
	}, s)
	// Whichever separator appears last is the decimal point; the other groups
	// thousands. This handles both "1.234,56" (EU) and "1,234.56" (US).
	lastComma := strings.LastIndex(s, ",")
	lastDot := strings.LastIndex(s, ".")
	switch {
	case lastComma >= 0 && lastDot >= 0:
		if lastComma > lastDot {
			s = strings.ReplaceAll(s, ".", "")
			s = strings.ReplaceAll(s, ",", ".")
		} else {
			s = strings.ReplaceAll(s, ",", "")
		}
	case lastComma >= 0:
		s = strings.ReplaceAll(s, ",", ".")
	}
	f, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0
	}
	return f
}

package util

import "strings"

const (
	RedactDirectionStart = "start"
	RedactDirectionEnd   = "end"
)

func Redact(text string, revealChars int, direction string) string {
	if text == "" {
		return ""
	}

	visible := max(0, revealChars)
	if len(text) <= visible {
		return text
	}

	redacted := strings.Repeat("*", len(text)-visible)
	if direction == RedactDirectionStart {
		return text[:visible] + redacted
	}

	return redacted + text[len(text)-visible:]
}

package observability

import (
	"log/slog"
	"os"

	"github.com/lmittmann/tint"
)

func NewLogger(environment string) *slog.Logger {
	level := slog.LevelInfo
	if environment != "production" {
		level = slog.LevelDebug
	}

	return slog.New(tint.NewHandler(os.Stdout, &tint.Options{Level: level}))
}

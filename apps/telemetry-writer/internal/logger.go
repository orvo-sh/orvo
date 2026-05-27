package writer

import (
	"log/slog"
	"os"

	"github.com/lmittmann/tint"
)

func NewLogger(config AppConfig) *slog.Logger {
	level := slog.LevelInfo
	if config.Environment != "production" {
		level = slog.LevelDebug
	}

	return slog.New(tint.NewHandler(os.Stdout, &tint.Options{Level: level}))
}

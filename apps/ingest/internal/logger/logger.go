package logger

import (
	"log/slog"
	"os"

	"github.com/lmittmann/tint"
	"go.opentelemetry.io/contrib/bridges/otelslog"
)

type Config struct {
	ServiceName string
	Environment string
}

func New(config Config) *slog.Logger {
	otelHandler := &jsonWrapperHandler{Handler: otelslog.NewHandler(config.ServiceName)}

	var handler slog.Handler
	if config.Environment == "production" {
		handler = otelHandler
	} else {
		handler = &teeHandler{
			handlers: []slog.Handler{
				tint.NewHandler(os.Stdout, &tint.Options{Level: slog.LevelDebug}),
				otelHandler,
			},
		}
	}

	return slog.New(&contextHandler{handler})
}

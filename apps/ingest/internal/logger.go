package ingest

import (
	"context"
	"encoding/json"
	"log/slog"
	"os"

	"github.com/lmittmann/tint"
	"go.opentelemetry.io/contrib/bridges/otelslog"
)

type LoggerConfig struct {
	ServiceName string
	Environment string
}

func NewLogger(config LoggerConfig) *slog.Logger {
	otelHandler := &jsonWrapperHandler{Handler: otelslog.NewHandler(config.ServiceName)}

	var handler slog.Handler
	if config.Environment == "production" {
		handler = otelHandler
	} else {
		tintHandler := tint.NewHandler(os.Stdout, &tint.Options{Level: slog.LevelDebug})
		handler = &teeHandler{
			handlers: []slog.Handler{tintHandler, otelHandler},
		}
	}

	return slog.New(handler)
}

type jsonWrapperHandler struct {
	slog.Handler
}

func (handler *jsonWrapperHandler) Handle(ctx context.Context, record slog.Record) error {
	newRecord := slog.NewRecord(record.Time, record.Level, record.Message, record.PC)

	record.Attrs(func(attr slog.Attr) bool {
		if attr.Value.Kind() == slog.KindAny {
			if bytes, err := json.Marshal(attr.Value.Any()); err == nil {
				newRecord.AddAttrs(slog.String(attr.Key, string(bytes)))
				return true
			}
		}

		newRecord.AddAttrs(attr)
		return true
	})

	return handler.Handler.Handle(ctx, newRecord)
}

type teeHandler struct {
	handlers []slog.Handler
}

func (handler *teeHandler) Enabled(ctx context.Context, level slog.Level) bool {
	for _, child := range handler.handlers {
		if child.Enabled(ctx, level) {
			return true
		}
	}

	return false
}

func (handler *teeHandler) Handle(ctx context.Context, record slog.Record) error {
	for _, child := range handler.handlers {
		if err := child.Handle(ctx, record); err != nil {
			return err
		}
	}

	return nil
}

func (handler *teeHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	children := make([]slog.Handler, len(handler.handlers))
	for index, child := range handler.handlers {
		children[index] = child.WithAttrs(attrs)
	}

	return &teeHandler{handlers: children}
}

func (handler *teeHandler) WithGroup(name string) slog.Handler {
	children := make([]slog.Handler, len(handler.handlers))
	for index, child := range handler.handlers {
		children[index] = child.WithGroup(name)
	}

	return &teeHandler{handlers: children}
}

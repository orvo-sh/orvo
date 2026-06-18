package logger

import (
	"context"
	"log/slog"
)

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

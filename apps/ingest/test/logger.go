package test

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"testing"
)

func NewLogger(t *testing.T) *slog.Logger {
	return slog.New(&testingHandler{t: t})
}

type testingHandler struct {
	t      *testing.T
	level  slog.Level
	attrs  []slog.Attr
	groups []string
}

func (handler *testingHandler) Enabled(_ context.Context, level slog.Level) bool {
	if handler.level == 0 {
		return level >= slog.LevelInfo
	}

	return level >= handler.level
}

func (handler *testingHandler) Handle(_ context.Context, record slog.Record) error {
	parts := []string{
		"level=" + record.Level.String(),
		"msg=" + record.Message,
	}

	attrs := make([]slog.Attr, 0, len(handler.attrs)+record.NumAttrs())
	attrs = append(attrs, handler.attrs...)
	record.Attrs(func(attr slog.Attr) bool {
		attrs = append(attrs, slog.Attr{
			Key:   handler.groupPrefix() + attr.Key,
			Value: attr.Value,
		})
		return true
	})

	for _, attr := range attrs {
		parts = append(parts, fmt.Sprintf("%s=%s", attr.Key, attr.Value.String()))
	}

	handler.t.Log(strings.Join(parts, " "))
	return nil
}

func (handler *testingHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	next := &testingHandler{
		t:      handler.t,
		level:  handler.level,
		attrs:  append([]slog.Attr{}, handler.attrs...),
		groups: append([]string{}, handler.groups...),
	}

	for _, attr := range attrs {
		next.attrs = append(next.attrs, slog.Attr{
			Key:   handler.groupPrefix() + attr.Key,
			Value: attr.Value,
		})
	}

	return next
}

func (handler *testingHandler) WithGroup(name string) slog.Handler {
	return &testingHandler{
		t:      handler.t,
		level:  handler.level,
		attrs:  append([]slog.Attr{}, handler.attrs...),
		groups: append(append([]string{}, handler.groups...), name),
	}
}

func (handler *testingHandler) groupPrefix() string {
	if len(handler.groups) == 0 {
		return ""
	}

	return strings.Join(handler.groups, ".") + "."
}

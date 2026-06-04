package observability

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"strings"

	"github.com/lmittmann/tint"
	"go.opentelemetry.io/contrib/bridges/otelslog"
)

type LoggerConfig struct {
	ServiceName string
	Environment string
}

func NewLogger(config LoggerConfig) *slog.Logger {
	otelHandler := &jsonWrapperHandler{Handler: otelslog.NewHandler(config.ServiceName)}
	level := slog.LevelInfo
	if config.Environment != "production" {
		level = slog.LevelDebug
	}

	if config.Environment == "production" {
		return slog.New(otelHandler)
	}

	return slog.New(&teeHandler{
		handlers: []slog.Handler{
			tint.NewHandler(os.Stdout, &tint.Options{Level: level}),
			otelHandler,
		},
	})
}

type jsonWrapperHandler struct {
	slog.Handler
	attrs []slog.Attr
}

func (handler *jsonWrapperHandler) Handle(ctx context.Context, record slog.Record) error {
	recordAttrs := make([]slog.Attr, 0, record.NumAttrs())
	record.Attrs(func(attr slog.Attr) bool {
		recordAttrs = append(recordAttrs, normalizeAttr(attr))
		return true
	})

	message := record.Message
	if formattedAttrs := formatAttrs(append(append([]slog.Attr(nil), handler.attrs...), recordAttrs...)); formattedAttrs != "" {
		message += " " + formattedAttrs
	}

	newRecord := slog.NewRecord(record.Time, record.Level, message, record.PC)

	for _, attr := range recordAttrs {
		newRecord.AddAttrs(attr)
	}

	return handler.Handler.Handle(ctx, newRecord)
}

func (handler *jsonWrapperHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	normalized := normalizeAttrs(attrs)
	return &jsonWrapperHandler{
		Handler: handler.Handler.WithAttrs(normalized),
		attrs:   append(append([]slog.Attr(nil), handler.attrs...), normalized...),
	}
}

func (handler *jsonWrapperHandler) WithGroup(name string) slog.Handler {
	return &jsonWrapperHandler{
		Handler: handler.Handler.WithGroup(name),
		attrs:   append([]slog.Attr(nil), handler.attrs...),
	}
}

func normalizeAttrs(attrs []slog.Attr) []slog.Attr {
	normalized := make([]slog.Attr, len(attrs))
	for index, attr := range attrs {
		normalized[index] = normalizeAttr(attr)
	}
	return normalized
}

func normalizeAttr(attr slog.Attr) slog.Attr {
	attr.Value = attr.Value.Resolve()

	if attr.Value.Kind() == slog.KindAny {
		return slog.String(attr.Key, formatAnyValue(attr.Value.Any()))
	}

	return attr
}

func formatAttrs(attrs []slog.Attr) string {
	parts := make([]string, 0, len(attrs))
	for _, attr := range attrs {
		if attr.Equal(slog.Attr{}) || attr.Key == "" {
			continue
		}

		attr = normalizeAttr(attr)
		parts = append(parts, fmt.Sprintf("%s=%s", attr.Key, formatValue(attr.Value)))
	}

	return strings.Join(parts, " ")
}

func formatValue(value slog.Value) string {
	value = value.Resolve()

	switch value.Kind() {
	case slog.KindString:
		return value.String()
	case slog.KindBool:
		return fmt.Sprintf("%t", value.Bool())
	case slog.KindInt64:
		return fmt.Sprintf("%d", value.Int64())
	case slog.KindUint64:
		return fmt.Sprintf("%d", value.Uint64())
	case slog.KindFloat64:
		return fmt.Sprintf("%g", value.Float64())
	case slog.KindDuration:
		return value.Duration().String()
	case slog.KindTime:
		return value.Time().Format("2006-01-02T15:04:05.000Z07:00")
	case slog.KindAny:
		return formatAnyValue(value.Any())
	default:
		return value.String()
	}
}

func formatAnyValue(value any) string {
	switch typed := value.(type) {
	case error:
		return typed.Error()
	case fmt.Stringer:
		return typed.String()
	}

	if bytes, err := json.Marshal(value); err == nil {
		return string(bytes)
	}

	return fmt.Sprint(value)
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

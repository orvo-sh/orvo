package observability

import (
	"context"
	"log/slog"
	"testing"
)

type capturedRecord struct {
	message string
	attrs   map[string]string
}

type captureSink struct {
	records []capturedRecord
}

type captureHandler struct {
	sink  *captureSink
	attrs []slog.Attr
}

func (handler *captureHandler) Enabled(context.Context, slog.Level) bool {
	return true
}

func (handler *captureHandler) Handle(_ context.Context, record slog.Record) error {
	attrs := make(map[string]string, len(handler.attrs)+record.NumAttrs())
	for _, attr := range handler.attrs {
		attrs[attr.Key] = formatValue(attr.Value)
	}

	record.Attrs(func(attr slog.Attr) bool {
		attrs[attr.Key] = formatValue(attr.Value)
		return true
	})

	handler.sink.records = append(handler.sink.records, capturedRecord{
		message: record.Message,
		attrs:   attrs,
	})

	return nil
}

func (handler *captureHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return &captureHandler{
		sink:  handler.sink,
		attrs: append(append([]slog.Attr(nil), handler.attrs...), attrs...),
	}
}

func (handler *captureHandler) WithGroup(name string) slog.Handler {
	return &captureHandler{
		sink:  handler.sink,
		attrs: append([]slog.Attr(nil), handler.attrs...),
	}
}

func TestJSONWrapperHandlerFormatsInheritedAndRecordAttrsIntoMessage(t *testing.T) {
	sink := &captureSink{}
	logger := slog.New(&jsonWrapperHandler{
		Handler: &captureHandler{sink: sink},
	}).With(slog.String("signal", "traces"))

	logger.Info(
		"FlushBatch: wrote telemetry rows",
		slog.String("signal", "traces"),
		slog.Int("row_count", 4),
		slog.Int("message_count", 1),
	)

	if len(sink.records) != 1 {
		t.Fatalf("expected 1 record, got %d", len(sink.records))
	}

	record := sink.records[0]
	expectedMessage := "FlushBatch: wrote telemetry rows signal=traces signal=traces row_count=4 message_count=1"
	if record.message != expectedMessage {
		t.Fatalf("expected message %q, got %q", expectedMessage, record.message)
	}

	if record.attrs["signal"] != "traces" {
		t.Fatalf("expected signal attr to be preserved, got %q", record.attrs["signal"])
	}
	if record.attrs["row_count"] != "4" {
		t.Fatalf("expected row_count attr to be preserved, got %q", record.attrs["row_count"])
	}
	if record.attrs["message_count"] != "1" {
		t.Fatalf("expected message_count attr to be preserved, got %q", record.attrs["message_count"])
	}
}

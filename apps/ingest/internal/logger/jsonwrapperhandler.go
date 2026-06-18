package logger

import (
	"context"
	"encoding/json"
	"log/slog"
)

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

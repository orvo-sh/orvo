package logger

import (
	"context"
	"log/slog"
)

type contextHandler struct {
	slog.Handler
}

func (handler contextHandler) Handle(ctx context.Context, record slog.Record) error {
	record.AddAttrs(handler.addRequestID(ctx)...)
	return handler.Handler.Handle(ctx, record)
}

func (handler contextHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return contextHandler{handler.Handler.WithAttrs(attrs)}
}

func (handler contextHandler) WithGroup(name string) slog.Handler {
	return contextHandler{handler.Handler.WithGroup(name)}
}

func (handler contextHandler) addRequestID(ctx context.Context) (attrs []slog.Attr) {
	requestID, ok := ctx.Value("requestid.ContextKey").(string)
	if ok {
		attrs = append(attrs, slog.Attr{Key: "request_id", Value: slog.StringValue(requestID)})
	}
	return
}

package httpapi

import (
	"context"
	"net/http"

	"github.com/orvo-sh/orvo/apps/ingest/internal/telemetry"
)

const (
	requestIDContextKey = "requestid.ContextKey"
	requestIDHeaderName = "X-Request-Id"
)

func requestIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		requestID := request.Header.Get(requestIDHeaderName)
		if requestID == "" {
			requestID = telemetry.GenerateID("req")
		}

		writer.Header().Set(requestIDHeaderName, requestID)
		ctx := context.WithValue(request.Context(), requestIDContextKey, requestID)
		next.ServeHTTP(writer, request.WithContext(ctx))
	})
}

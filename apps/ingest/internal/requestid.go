package ingest

import (
	"context"
	"net/http"
)

const (
	requestIDContextKey = "requestid.ContextKey"
	requestIDHeaderName = "X-Request-Id"
)

func requestIDMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		requestID := request.Header.Get(requestIDHeaderName)
		if requestID == "" {
			requestID = GenerateID("req")
		}

		writer.Header().Set(requestIDHeaderName, requestID)
		ctx := context.WithValue(request.Context(), requestIDContextKey, requestID)
		next.ServeHTTP(writer, request.WithContext(ctx))
	})
}

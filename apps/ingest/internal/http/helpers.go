package ingesthttp

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/models"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/apperr"
)

const (
	contentTypeJSON     = "application/json"
	contentTypeProtobuf = "application/x-protobuf"
	requestIDHeaderName = "X-Request-Id"
)

func writeJSON(writer http.ResponseWriter, status int, value any) {
	writer.Header().Set("Content-Type", contentTypeJSON)
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(value)
}

func writeAppError(writer http.ResponseWriter, err apperr.Error) {
	writeJSON(writer, err.Status(), map[string]string{
		"error": err.Code(),
	})
}

func requestMeta() models.MessageMeta {
	return models.MessageMeta{
		ReceivedAt: time.Now().UTC(),
	}
}

func trimOptional(value string) string {
	return strings.TrimSpace(value)
}

func stringPtr(value string, maxLen int) *string {
	value = trimOptional(value)
	if value == "" || len(value) > maxLen {
		return nil
	}

	return &value
}

func urlPtr(value string, maxLen int) *string {
	value = trimOptional(value)
	if value == "" || len(value) > maxLen {
		return nil
	}
	if _, err := url.ParseRequestURI(value); err != nil {
		return nil
	}

	return &value
}

func marshalMetadata(value map[string]any) ([]byte, error) {
	if value == nil {
		return nil, nil
	}

	bytes, err := json.Marshal(value)
	if err != nil {
		return nil, fmt.Errorf("marshal metadata: %w", err)
	}

	return bytes, nil
}

func pathValue(path string, prefix string) (string, error) {
	value := strings.TrimPrefix(path, prefix)
	value = strings.Trim(value, "/")
	if value == "" || strings.Contains(value, "/") {
		return "", fmt.Errorf("invalid path")
	}

	return value, nil
}

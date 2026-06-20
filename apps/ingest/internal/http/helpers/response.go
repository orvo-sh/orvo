package helpers

import (
	"encoding/json"
	"net/http"

	"github.com/orvo-sh/orvo/apps/ingest/pkg/apperr"
)

func WriteJSON(writer http.ResponseWriter, status int, value any) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(value)
}

func WriteAppErr(writer http.ResponseWriter, err apperr.Error) {
	WriteJSON(writer, err.Status(), map[string]string{
		"error": err.Code(),
	})
}

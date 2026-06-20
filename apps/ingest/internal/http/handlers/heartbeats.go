package handlers

import (
	"net/http"
	"time"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/errs"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/services/ingestservice"
	httphelpers "github.com/orvo-sh/orvo/apps/ingest/internal/http/helpers"
)

func NewHeartbeatHandler(ingestService ingestservice.Service) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodGet && request.Method != http.MethodPost {
			writer.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		token := request.PathValue("token")
		if token == "" {
			httphelpers.WriteAppErr(writer, errs.ErrHeartbeatMonitorNotFound)
			return
		}

		receivedAt, appErr := ingestService.IngestHeartbeatCheckIn(request.Context(), token)
		if appErr != nil {
			httphelpers.WriteAppErr(writer, appErr)
			return
		}

		httphelpers.WriteJSON(writer, http.StatusAccepted, map[string]any{
			"ok":         true,
			"receivedAt": receivedAt.Format(time.RFC3339),
		})
	}
}

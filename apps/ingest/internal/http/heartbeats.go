package ingesthttp

import (
	"net/http"
	"time"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/errs"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/services/heartbeatservice"
)

type heartbeatHandler struct {
	heartbeatService heartbeatservice.Service
}

func (handler *heartbeatHandler) handleCheckIn(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodGet && request.Method != http.MethodPost {
		writer.WriteHeader(http.StatusMethodNotAllowed)
		return
	}

	token, err := pathValue(request.URL.Path, "/v1/heartbeats/")
	if err != nil {
		writeAppError(writer, errs.ErrHeartbeatMonitorNotFound)
		return
	}

	receivedAt, appErr := handler.heartbeatService.RecordCheckIn(request.Context(), token)
	if appErr != nil {
		writeAppError(writer, appErr)
		return
	}

	writeJSON(writer, http.StatusAccepted, map[string]any{
		"ok":         true,
		"receivedAt": receivedAt.Format(time.RFC3339),
	})
}

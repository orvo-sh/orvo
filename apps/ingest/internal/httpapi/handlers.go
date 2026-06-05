package httpapi

import (
	"net/http"

	collectorlogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	collectormetricspb "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
	collectortracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"

	"github.com/orvo-sh/orvo/apps/ingest/internal/apperrors"
	"github.com/orvo-sh/orvo/apps/ingest/internal/auth"
	"github.com/orvo-sh/orvo/apps/ingest/internal/telemetry"
)

type signalHandler struct {
	authService   *auth.Service
	ingestService *telemetry.Service
	maxBodyBytes  int64
	signal        string
}

func (handler *signalHandler) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		http.Error(writer, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	resolved, err := handler.authService.ResolveRequest(request)
	if err != nil {
		writeAppError(writer, apperrors.ErrInvalidIngestionKey)
		return
	}

	contentType, appErr := decodeContentType(request)
	if appErr != nil {
		writeAppError(writer, appErr)
		return
	}

	body, appErr := readOTLPBody(writer, request, handler.maxBodyBytes)
	if appErr != nil {
		writeAppError(writer, appErr)
		return
	}

	switch handler.signal {
	case "logs":
		var payload collectorlogspb.ExportLogsServiceRequest
		if appErr := unmarshalOTLP(contentType, body, &payload); appErr != nil {
			writeAppError(writer, appErr)
			return
		}
		if ingestErr := handler.ingestService.IngestLogs(request.Context(), telemetry.LogsInput{
			ResolvedIngestionKey: *resolved,
			Meta:                 requestMeta(),
			AcceptedBytes:        len(body),
			ResourceLogs:         payload.GetResourceLogs(),
		}); ingestErr != nil {
			writeAppError(writer, ingestErr)
			return
		}
		writeOTLPResponse(writer, contentType, emptyLogsResponse())
	case "traces":
		var payload collectortracepb.ExportTraceServiceRequest
		if appErr := unmarshalOTLP(contentType, body, &payload); appErr != nil {
			writeAppError(writer, appErr)
			return
		}
		if ingestErr := handler.ingestService.IngestTraces(request.Context(), telemetry.TracesInput{
			ResolvedIngestionKey: *resolved,
			Meta:                 requestMeta(),
			AcceptedBytes:        len(body),
			ResourceSpans:        payload.GetResourceSpans(),
		}); ingestErr != nil {
			writeAppError(writer, ingestErr)
			return
		}
		writeOTLPResponse(writer, contentType, emptyTracesResponse())
	case "metrics":
		var payload collectormetricspb.ExportMetricsServiceRequest
		if appErr := unmarshalOTLP(contentType, body, &payload); appErr != nil {
			writeAppError(writer, appErr)
			return
		}
		if ingestErr := handler.ingestService.IngestMetrics(request.Context(), telemetry.MetricsInput{
			ResolvedIngestionKey: *resolved,
			Meta:                 requestMeta(),
			AcceptedBytes:        len(body),
			ResourceMetrics:      payload.GetResourceMetrics(),
		}); ingestErr != nil {
			writeAppError(writer, ingestErr)
			return
		}
		writeOTLPResponse(writer, contentType, emptyMetricsResponse())
	}
}

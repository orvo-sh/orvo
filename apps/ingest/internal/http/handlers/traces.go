package handlers

import (
	"net/http"
	"time"

	collectortracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/errs"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/models"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/services/ingestservice"
	httphelpers "github.com/orvo-sh/orvo/apps/ingest/internal/http/helpers"
	httpmiddleware "github.com/orvo-sh/orvo/apps/ingest/internal/http/middleware"
)

func NewTracesHandler(
	ingestService ingestservice.Service,
) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodPost {
			writer.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		resolved, ok := httpmiddleware.GetResolvedIngestionKey(request.Context())
		if !ok {
			httphelpers.WriteAppErr(writer, errs.ErrInternal)
			return
		}

		contentType, appErr := httphelpers.DecodeContentType(request)
		if appErr != nil {
			httphelpers.WriteAppErr(writer, appErr)
			return
		}

		body, appErr := httphelpers.ReadOTLPBody(writer, request)
		if appErr != nil {
			httphelpers.WriteAppErr(writer, appErr)
			return
		}

		var payload collectortracepb.ExportTraceServiceRequest
		if appErr := httphelpers.UnmarshalOTLP(contentType, body, &payload); appErr != nil {
			httphelpers.WriteAppErr(writer, appErr)
			return
		}

		if appErr := ingestService.IngestTraces(request.Context(), ingestservice.IngestTracesInput{
			ResolvedIngestionKey: resolved,
			Meta: models.MessageMeta{
				ReceivedAt: time.Now().UTC(),
			},
			AcceptedBytes: len(body),
			ResourceSpans: payload.GetResourceSpans(),
		}); appErr != nil {
			httphelpers.WriteAppErr(writer, appErr)
			return
		}

		httphelpers.WriteOTLPResponse(writer, contentType, &collectortracepb.ExportTraceServiceResponse{})
	}
}

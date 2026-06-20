package handlers

import (
	"net/http"
	"time"

	collectormetricspb "go.opentelemetry.io/proto/otlp/collector/metrics/v1"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/errs"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/models"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/services/ingestservice"
	httphelpers "github.com/orvo-sh/orvo/apps/ingest/internal/http/helpers"
	httpmiddleware "github.com/orvo-sh/orvo/apps/ingest/internal/http/middleware"
)

func NewMetricsHandler(
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

		var payload collectormetricspb.ExportMetricsServiceRequest
		if appErr := httphelpers.UnmarshalOTLP(contentType, body, &payload); appErr != nil {
			httphelpers.WriteAppErr(writer, appErr)
			return
		}

		if appErr := ingestService.IngestMetrics(request.Context(), ingestservice.IngestMetricsInput{
			ResolvedIngestionKey: resolved,
			Meta: models.MessageMeta{
				ReceivedAt: time.Now().UTC(),
			},
			AcceptedBytes:   len(body),
			ResourceMetrics: payload.GetResourceMetrics(),
		}); appErr != nil {
			httphelpers.WriteAppErr(writer, appErr)
			return
		}

		httphelpers.WriteOTLPResponse(writer, contentType, &collectormetricspb.ExportMetricsServiceResponse{})
	}
}

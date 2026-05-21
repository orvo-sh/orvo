package ingest

import (
	"context"
	"log/slog"
	"net/http"

	collectormetricspb "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
)

func (service *IngestService) IngestMetrics(ctx context.Context, input IngestMetricsInput) AppError {
	service.logger.InfoContext(ctx, "IngestMetrics: ingesting metrics",
		slog.String("organization_id", input.ResolvedAPIKey.OrganizationID),
		slog.String("api_key_id", input.ResolvedAPIKey.APIKeyID),
		slog.Int("resource_metrics_count", len(input.ResourceMetrics)),
	)

	points := service.transformMetrics(input.ResourceMetrics)
	if len(points) == 0 {
		return nil
	}

	message := MetricsMessage{
		MessageMeta: withSignalMeta(input.Meta, "metrics", input.ResolvedAPIKey.OrganizationID, input.ResolvedAPIKey.APIKeyID),
		Points:      points,
	}

	if err := service.publisher.PublishMetrics(ctx, message); err != nil {
		service.logger.ErrorContext(ctx, "IngestMetrics: failed to publish metrics", slog.Any("error", err))
		return ErrQueueUnavailable
	}

	return nil
}

type httpMetricHandler struct {
	authService   *AuthService
	ingestService *IngestService
	logger        *slog.Logger
	maxBodyBytes  int64
}

func (handler *httpMetricHandler) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	if request.Method != http.MethodPost {
		http.Error(writer, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}

	resolved, err := handler.authService.ResolveRequest(request)
	if err != nil {
		writeAppError(writer, ErrInvalidAPIKey)
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

	var payload collectormetricspb.ExportMetricsServiceRequest
	if appErr := unmarshalOTLP(contentType, body, &payload); appErr != nil {
		writeAppError(writer, appErr)
		return
	}

	if ingestErr := handler.ingestService.IngestMetrics(request.Context(), IngestMetricsInput{
		ResolvedAPIKey:  *resolved,
		Meta:            requestMeta(request, contentType),
		ResourceMetrics: payload.GetResourceMetrics(),
	}); ingestErr != nil {
		handler.logger.ErrorContext(request.Context(), "HTTPMetrics: failed to ingest metrics", slog.Any("error", ingestErr))
		writeAppError(writer, ingestErr)
		return
	}

	writeOTLPResponse(writer, contentType, emptyMetricsResponse())
}

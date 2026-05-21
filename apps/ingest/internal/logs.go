package ingest

import (
	"context"
	"log/slog"
	"net/http"

	collectorlogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	logspb "go.opentelemetry.io/proto/otlp/logs/v1"
	metricspb "go.opentelemetry.io/proto/otlp/metrics/v1"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"
)

type publisher interface {
	PublishLogs(ctx context.Context, message LogsMessage) error
	PublishTraces(ctx context.Context, message TracesMessage) error
	PublishMetrics(ctx context.Context, message MetricsMessage) error
}

type IngestService struct {
	publisher publisher
	logger    *slog.Logger
}

type IngestLogsInput struct {
	ResolvedAPIKey ResolvedAPIKey
	Meta           MessageMeta
	ResourceLogs   []*logspb.ResourceLogs
}

type IngestTracesInput struct {
	ResolvedAPIKey ResolvedAPIKey
	Meta           MessageMeta
	ResourceSpans  []*tracepb.ResourceSpans
}

type IngestMetricsInput struct {
	ResolvedAPIKey  ResolvedAPIKey
	Meta            MessageMeta
	ResourceMetrics []*metricspb.ResourceMetrics
}

func NewIngestService(publisher publisher, logger *slog.Logger) *IngestService {
	return &IngestService{
		publisher: publisher,
		logger:    logger,
	}
}

func (service *IngestService) IngestLogs(ctx context.Context, input IngestLogsInput) AppError {
	service.logger.InfoContext(ctx, "IngestLogs: ingesting logs",
		slog.String("organization_id", input.ResolvedAPIKey.OrganizationID),
		slog.String("api_key_id", input.ResolvedAPIKey.APIKeyID),
		slog.Int("resource_logs_count", len(input.ResourceLogs)),
	)

	records := service.transformLogs(input.ResourceLogs)
	if len(records) == 0 {
		return nil
	}

	message := LogsMessage{
		MessageMeta: withSignalMeta(input.Meta, "logs", input.ResolvedAPIKey.OrganizationID, input.ResolvedAPIKey.APIKeyID),
		Records:     records,
	}

	if err := service.publisher.PublishLogs(ctx, message); err != nil {
		service.logger.ErrorContext(ctx, "IngestLogs: failed to publish logs", slog.Any("error", err))
		return ErrQueueUnavailable
	}

	return nil
}

type httpLogHandler struct {
	authService   *AuthService
	ingestService *IngestService
	logger        *slog.Logger
	maxBodyBytes  int64
}

func (handler *httpLogHandler) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
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

	var payload collectorlogspb.ExportLogsServiceRequest
	if appErr := unmarshalOTLP(contentType, body, &payload); appErr != nil {
		writeAppError(writer, appErr)
		return
	}

	if ingestErr := handler.ingestService.IngestLogs(request.Context(), IngestLogsInput{
		ResolvedAPIKey: *resolved,
		Meta:           requestMeta(request, contentType),
		ResourceLogs:   payload.GetResourceLogs(),
	}); ingestErr != nil {
		handler.logger.ErrorContext(request.Context(), "HTTPLogs: failed to ingest logs", slog.Any("error", ingestErr))
		writeAppError(writer, ingestErr)
		return
	}

	writeOTLPResponse(writer, contentType, emptyLogsResponse())
}

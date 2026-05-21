package ingest

import (
	"context"
	"log/slog"
	"net/http"

	collectortracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
)

func (service *IngestService) IngestTraces(ctx context.Context, input IngestTracesInput) AppError {
	service.logger.InfoContext(ctx, "IngestTraces: ingesting traces",
		slog.String("organization_id", input.ResolvedAPIKey.OrganizationID),
		slog.String("api_key_id", input.ResolvedAPIKey.APIKeyID),
		slog.Int("resource_spans_count", len(input.ResourceSpans)),
	)

	spans := service.transformTraces(input.ResourceSpans)
	if len(spans) == 0 {
		return nil
	}

	message := TracesMessage{
		MessageMeta: withSignalMeta(input.Meta, "traces", input.ResolvedAPIKey.OrganizationID, input.ResolvedAPIKey.APIKeyID),
		Spans:       spans,
	}

	if err := service.publisher.PublishTraces(ctx, message); err != nil {
		service.logger.ErrorContext(ctx, "IngestTraces: failed to publish traces", slog.Any("error", err))
		return ErrQueueUnavailable
	}

	return nil
}

type httpTraceHandler struct {
	authService   *AuthService
	ingestService *IngestService
	logger        *slog.Logger
	maxBodyBytes  int64
}

func (handler *httpTraceHandler) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
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

	var payload collectortracepb.ExportTraceServiceRequest
	if appErr := unmarshalOTLP(contentType, body, &payload); appErr != nil {
		writeAppError(writer, appErr)
		return
	}

	if ingestErr := handler.ingestService.IngestTraces(request.Context(), IngestTracesInput{
		ResolvedAPIKey: *resolved,
		Meta:           requestMeta(request, contentType),
		ResourceSpans:  payload.GetResourceSpans(),
	}); ingestErr != nil {
		handler.logger.ErrorContext(request.Context(), "HTTPTraces: failed to ingest traces", slog.Any("error", ingestErr))
		writeAppError(writer, ingestErr)
		return
	}

	writeOTLPResponse(writer, contentType, emptyTracesResponse())
}

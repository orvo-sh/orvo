package telemetry

import (
	"context"
	"log/slog"
	"time"

	"github.com/orvo-sh/orvo/apps/ingest/internal/apperrors"
)

type Publisher interface {
	PublishLogs(ctx context.Context, message LogsMessage) error
	PublishTraces(ctx context.Context, message TracesMessage) error
	PublishMetrics(ctx context.Context, message MetricsMessage) error
}

type Service struct {
	publisher Publisher
	logger    *slog.Logger
}

func NewService(publisher Publisher, logger *slog.Logger) *Service {
	return &Service{
		publisher: publisher,
		logger:    logger,
	}
}

func (service *Service) IngestLogs(ctx context.Context, input LogsInput) apperrors.AppError {
	service.logger.InfoContext(ctx, "IngestLogs: ingesting logs",
		slog.String("organization_id", input.ResolvedIngestionKey.OrganizationID),
		slog.String("ingestion_key_id", input.ResolvedIngestionKey.IngestionKeyID),
		slog.Int("resource_logs_count", len(input.ResourceLogs)),
	)

	records := service.transformLogs(input.ResourceLogs)
	if len(records) == 0 {
		return nil
	}

	message := LogsMessage{
		MessageMeta: withSignalMeta(input.Meta, "logs", input.ResolvedIngestionKey.OrganizationID, input.ResolvedIngestionKey.IngestionKeyID),
		Records:     records,
	}

	if err := service.publisher.PublishLogs(ctx, message); err != nil {
		service.logger.ErrorContext(ctx, "IngestLogs: failed to publish logs", slog.Any("error", err))
		return apperrors.ErrQueueUnavailable
	}

	return nil
}

func (service *Service) IngestTraces(ctx context.Context, input TracesInput) apperrors.AppError {
	service.logger.InfoContext(ctx, "IngestTraces: ingesting traces",
		slog.String("organization_id", input.ResolvedIngestionKey.OrganizationID),
		slog.String("ingestion_key_id", input.ResolvedIngestionKey.IngestionKeyID),
		slog.Int("resource_spans_count", len(input.ResourceSpans)),
	)

	spans := service.transformTraces(input.ResourceSpans)
	if len(spans) == 0 {
		return nil
	}

	message := TracesMessage{
		MessageMeta: withSignalMeta(input.Meta, "traces", input.ResolvedIngestionKey.OrganizationID, input.ResolvedIngestionKey.IngestionKeyID),
		Spans:       spans,
	}

	if err := service.publisher.PublishTraces(ctx, message); err != nil {
		service.logger.ErrorContext(ctx, "IngestTraces: failed to publish traces", slog.Any("error", err))
		return apperrors.ErrQueueUnavailable
	}

	return nil
}

func (service *Service) IngestMetrics(ctx context.Context, input MetricsInput) apperrors.AppError {
	service.logger.InfoContext(ctx, "IngestMetrics: ingesting metrics",
		slog.String("organization_id", input.ResolvedIngestionKey.OrganizationID),
		slog.String("ingestion_key_id", input.ResolvedIngestionKey.IngestionKeyID),
		slog.Int("resource_metrics_count", len(input.ResourceMetrics)),
	)

	points := service.transformMetrics(input.ResourceMetrics)
	if len(points) == 0 {
		return nil
	}

	message := MetricsMessage{
		MessageMeta: withSignalMeta(input.Meta, "metrics", input.ResolvedIngestionKey.OrganizationID, input.ResolvedIngestionKey.IngestionKeyID),
		Points:      points,
	}

	if err := service.publisher.PublishMetrics(ctx, message); err != nil {
		service.logger.ErrorContext(ctx, "IngestMetrics: failed to publish metrics", slog.Any("error", err))
		return apperrors.ErrQueueUnavailable
	}

	return nil
}

func withSignalMeta(meta MessageMeta, signal string, organizationID string, ingestionKeyID string) MessageMeta {
	meta.Version = "v1"
	meta.Signal = signal
	meta.OrganizationID = organizationID
	meta.IngestionKeyID = ingestionKeyID
	if meta.ReceivedAt.IsZero() {
		meta.ReceivedAt = time.Now().UTC()
	}
	return meta
}

package ingest

import (
	"context"
	"fmt"
	"log/slog"
	"time"
)

type Publisher interface {
	PublishLogs(ctx context.Context, message LogsMessage) error
	PublishTraces(ctx context.Context, message TracesMessage) error
	PublishMetrics(ctx context.Context, message MetricsMessage) error
}

type TelemetryService struct {
	publisher Publisher
	billing   *BillingService
	store     *PostgresClient
	logger    *slog.Logger
}

func NewTelemetryService(publisher Publisher, billingService *BillingService, store *PostgresClient, logger *slog.Logger) *TelemetryService {
	return &TelemetryService{
		publisher: publisher,
		billing:   billingService,
		store:     store,
		logger:    logger,
	}
}

func (service *TelemetryService) IngestLogs(ctx context.Context, input LogsInput) AppError {
	service.logger.InfoContext(ctx, "IngestLogs: ingesting logs",
		slog.String("app_id", input.ResolvedIngestionKey.AppID),
		slog.String("ingestion_key_id", input.ResolvedIngestionKey.IngestionKeyID),
		slog.Int("resource_logs_count", len(input.ResourceLogs)),
	)

	reservation, billingErr := service.billing.ReserveSignalUsage(
		ctx,
		input.ResolvedIngestionKey.OrganizationID,
		"logs",
		input.AcceptedBytes,
	)
	if billingErr != nil {
		return billingErr
	}

	records := service.transformLogs(input.ResourceLogs)
	if len(records) == 0 {
		return nil
	}

	service.recordSignalReception(ctx, input.ResolvedIngestionKey.AppID, "logs")

	message := LogsMessage{
		MessageMeta: withSignalMeta(input.Meta, "logs", input.ResolvedIngestionKey.AppID, input.ResolvedIngestionKey.IngestionKeyID),
		Records:     records,
	}

	if err := service.publisher.PublishLogs(ctx, message); err != nil {
		if releaseErr := service.billing.ReleaseSignalUsage(ctx, reservation); releaseErr != nil {
			service.logger.ErrorContext(ctx, "IngestLogs: failed to release reserved usage", slog.Any("error", releaseErr))
		}
		service.logger.ErrorContext(ctx, "IngestLogs: failed to publish logs", slog.Any("error", err))
		return ErrQueueUnavailable
	}

	return nil
}

func (service *TelemetryService) IngestTraces(ctx context.Context, input TracesInput) AppError {
	service.logger.InfoContext(ctx, "IngestTraces: ingesting traces",
		slog.String("app_id", input.ResolvedIngestionKey.AppID),
		slog.String("ingestion_key_id", input.ResolvedIngestionKey.IngestionKeyID),
		slog.Int("resource_spans_count", len(input.ResourceSpans)),
	)

	reservation, billingErr := service.billing.ReserveSignalUsage(
		ctx,
		input.ResolvedIngestionKey.OrganizationID,
		"traces",
		input.AcceptedBytes,
	)
	if billingErr != nil {
		return billingErr
	}

	spans := service.transformTraces(input.ResourceSpans)
	if len(spans) == 0 {
		return nil
	}

	service.recordSignalReception(ctx, input.ResolvedIngestionKey.AppID, "traces")

	message := TracesMessage{
		MessageMeta: withSignalMeta(input.Meta, "traces", input.ResolvedIngestionKey.AppID, input.ResolvedIngestionKey.IngestionKeyID),
		Spans:       spans,
	}

	if err := service.publisher.PublishTraces(ctx, message); err != nil {
		if releaseErr := service.billing.ReleaseSignalUsage(ctx, reservation); releaseErr != nil {
			service.logger.ErrorContext(ctx, "IngestTraces: failed to release reserved usage", slog.Any("error", releaseErr))
		}
		service.logger.ErrorContext(ctx, "IngestTraces: failed to publish traces", slog.Any("error", err))
		return ErrQueueUnavailable
	}

	return nil
}

func (service *TelemetryService) IngestMetrics(ctx context.Context, input MetricsInput) AppError {
	service.logger.InfoContext(ctx, "IngestMetrics: ingesting metrics",
		slog.String("app_id", input.ResolvedIngestionKey.AppID),
		slog.String("ingestion_key_id", input.ResolvedIngestionKey.IngestionKeyID),
		slog.Int("resource_metrics_count", len(input.ResourceMetrics)),
	)

	reservation, billingErr := service.billing.ReserveSignalUsage(
		ctx,
		input.ResolvedIngestionKey.OrganizationID,
		"metrics",
		input.AcceptedBytes,
	)
	if billingErr != nil {
		return billingErr
	}

	points := service.transformMetrics(input.ResourceMetrics)
	if len(points) == 0 {
		return nil
	}

	service.recordSignalReception(ctx, input.ResolvedIngestionKey.AppID, "metrics")

	message := MetricsMessage{
		MessageMeta: withSignalMeta(input.Meta, "metrics", input.ResolvedIngestionKey.AppID, input.ResolvedIngestionKey.IngestionKeyID),
		Points:      points,
	}

	if err := service.publisher.PublishMetrics(ctx, message); err != nil {
		if releaseErr := service.billing.ReleaseSignalUsage(ctx, reservation); releaseErr != nil {
			service.logger.ErrorContext(ctx, "IngestMetrics: failed to release reserved usage", slog.Any("error", releaseErr))
		}
		service.logger.ErrorContext(ctx, "IngestMetrics: failed to publish metrics", slog.Any("error", err))
		return ErrQueueUnavailable
	}

	return nil
}

func (service *TelemetryService) recordSignalReception(ctx context.Context, appID string, signal string) {
	var column string
	switch signal {
	case "logs":
		column = "logs_first_received_at"
	case "traces":
		column = "traces_first_received_at"
	case "metrics":
		column = "metrics_first_received_at"
	default:
		return
	}

	query := fmt.Sprintf(`
		UPDATE app
		SET %s = NOW()
		WHERE id = $1 AND %s IS NULL
	`, column, column)

	if _, err := service.store.Pool().Exec(ctx, query, appID); err != nil {
		service.logger.ErrorContext(ctx, "recordSignalReception: failed to update first received at",
			slog.String("app_id", appID),
			slog.String("signal", signal),
			slog.Any("error", err),
		)
	}
}

func withSignalMeta(meta MessageMeta, signal string, appID string, ingestionKeyID string) MessageMeta {
	meta.Version = "v1"
	meta.Signal = signal
	meta.AppID = appID
	meta.IngestionKeyID = ingestionKeyID
	if meta.ReceivedAt.IsZero() {
		meta.ReceivedAt = time.Now().UTC()
	}
	return meta
}

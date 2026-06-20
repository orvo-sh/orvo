package ingestservice

import (
	"context"
	"log/slog"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/errs"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/models"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/services/billingservice"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/apperr"
)

func (service *service) IngestMetrics(ctx context.Context, input IngestMetricsInput) apperr.Error {
	service.logger.InfoContext(ctx, "IngestMetrics: ingesting metrics",
		slog.String("app_id", input.ResolvedIngestionKey.AppID),
		slog.String("ingestion_key_id", input.ResolvedIngestionKey.IngestionKeyID),
		slog.Int("resource_metrics_count", len(input.ResourceMetrics)),
	)

	points := service.transformMetrics(input.ResourceMetrics)
	if len(points) == 0 {
		return nil
	}

	retentionDays, err := service.getSignalRetentionDays(ctx, billingservice.ReservationSignal_Metrics, input.ResolvedIngestionKey.AppID)
	if err != nil {
		service.logger.ErrorContext(ctx, "IngestMetrics: failed to get app retention policy", "error", err)
		return errs.ErrInternal
	}

	appErr := service.billingService.ReserveSignalUsage(
		ctx,
		billingservice.ReserveSignalUsageInput{
			OrganizationID: input.ResolvedIngestionKey.OrganizationID,
			Signal:         billingservice.ReservationSignal_Metrics,
			Bytes:          int64(input.AcceptedBytes),
		},
	)
	if appErr != nil {
		return appErr
	}

	if err := service.postgres.Queries().MarkAppMetricsFirstReceived(ctx, input.ResolvedIngestionKey.AppID); err != nil {
		service.logger.ErrorContext(ctx, "IngestMetrics: failed to update first received timestamp", "error", err)
	}

	message := withSignalMeta(input.Meta, "metrics", input.ResolvedIngestionKey.AppID, input.ResolvedIngestionKey.IngestionKeyID, retentionDays)
	if err := service.metricsBatcher.Push(ctx, models.MetricsMessage{
		MessageMeta: message,
		Points:      points,
	}); err != nil {
		if releaseErr := service.billingService.ReleaseSignalUsage(ctx, billingservice.ReleaseSignalUsageInput{
			OrganizationID: input.ResolvedIngestionKey.OrganizationID,
			Signal:         billingservice.ReservationSignal_Metrics,
			Bytes:          int64(input.AcceptedBytes),
		}); releaseErr != nil {
			service.logger.ErrorContext(ctx, "IngestMetrics: failed to release reserved usage", "error", releaseErr)
		}
		service.logger.ErrorContext(ctx, "IngestMetrics: failed to enqueue metrics", "error", err)
		return errs.ErrQueueUnavailable
	}

	return nil
}

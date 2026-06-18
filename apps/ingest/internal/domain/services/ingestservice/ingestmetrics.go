package ingestservice

import (
	"context"
	"log/slog"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/errs"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/models"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/apperr"
)

func (service *service) IngestMetrics(ctx context.Context, input IngestMetricsInput) apperr.Error {
	service.logger.InfoContext(ctx, "IngestMetrics: ingesting metrics",
		slog.String("app_id", input.ResolvedIngestionKey.AppID),
		slog.String("ingestion_key_id", input.ResolvedIngestionKey.IngestionKeyID),
		slog.Int("resource_metrics_count", len(input.ResourceMetrics)),
	)

	reservation, appErr := service.billing.ReserveSignalUsage(
		ctx,
		input.ResolvedIngestionKey.OrganizationID,
		"metrics",
		input.AcceptedBytes,
	)
	if appErr != nil {
		return appErr
	}

	points := service.transformMetrics(input.ResourceMetrics)
	if len(points) == 0 {
		return nil
	}

	if err := service.postgres.Queries().MarkAppMetricsFirstReceived(ctx, input.ResolvedIngestionKey.AppID); err != nil {
		service.logger.ErrorContext(ctx, "IngestMetrics: failed to update first received timestamp", "error", err)
	}

	message := withSignalMeta(input.Meta, "metrics", input.ResolvedIngestionKey.AppID, input.ResolvedIngestionKey.IngestionKeyID)
	if err := service.workers.EnqueueMetrics(ctx, models.MetricsMessage{
		MessageMeta: message,
		Points:      points,
	}); err != nil {
		if releaseErr := service.billing.ReleaseSignalUsage(ctx, reservation); releaseErr != nil {
			service.logger.ErrorContext(ctx, "IngestMetrics: failed to release reserved usage", "error", releaseErr)
		}
		service.logger.ErrorContext(ctx, "IngestMetrics: failed to enqueue metrics", "error", err)
		return errs.ErrQueueUnavailable
	}

	return nil
}

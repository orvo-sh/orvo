package ingestservice

import (
	"context"
	"log/slog"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/errs"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/models"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/apperr"
)

func (service *service) IngestTraces(ctx context.Context, input IngestTracesInput) apperr.Error {
	service.logger.InfoContext(ctx, "IngestTraces: ingesting traces",
		slog.String("app_id", input.ResolvedIngestionKey.AppID),
		slog.String("ingestion_key_id", input.ResolvedIngestionKey.IngestionKeyID),
		slog.Int("resource_spans_count", len(input.ResourceSpans)),
	)

	reservation, appErr := service.billing.ReserveSignalUsage(
		ctx,
		input.ResolvedIngestionKey.OrganizationID,
		"traces",
		input.AcceptedBytes,
	)
	if appErr != nil {
		return appErr
	}

	spans := service.transformTraces(input.ResourceSpans)
	if len(spans) == 0 {
		return nil
	}

	if err := service.postgres.Queries().MarkAppTracesFirstReceived(ctx, input.ResolvedIngestionKey.AppID); err != nil {
		service.logger.ErrorContext(ctx, "IngestTraces: failed to update first received timestamp", "error", err)
	}

	message := withSignalMeta(input.Meta, "traces", input.ResolvedIngestionKey.AppID, input.ResolvedIngestionKey.IngestionKeyID)
	if err := service.workers.EnqueueTraces(ctx, models.TracesMessage{
		MessageMeta: message,
		Spans:       spans,
	}); err != nil {
		if releaseErr := service.billing.ReleaseSignalUsage(ctx, reservation); releaseErr != nil {
			service.logger.ErrorContext(ctx, "IngestTraces: failed to release reserved usage", "error", releaseErr)
		}
		service.logger.ErrorContext(ctx, "IngestTraces: failed to enqueue traces", "error", err)
		return errs.ErrQueueUnavailable
	}

	return nil
}

package ingestservice

import (
	"context"
	"log/slog"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/errs"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/models"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/services/billingservice"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/apperr"
)

func (service *service) IngestTraces(ctx context.Context, input IngestTracesInput) apperr.Error {
	service.logger.InfoContext(ctx, "IngestTraces: ingesting traces",
		slog.String("app_id", input.ResolvedIngestionKey.AppID),
		slog.String("ingestion_key_id", input.ResolvedIngestionKey.IngestionKeyID),
		slog.Int("resource_spans_count", len(input.ResourceSpans)),
	)

	spans := service.transformTraces(input.ResourceSpans)
	if len(spans) == 0 {
		return nil
	}

	retentionDays, err := service.getSignalRetentionDays(ctx, billingservice.ReservationSignal_Traces, input.ResolvedIngestionKey.AppID)
	if err != nil {
		service.logger.ErrorContext(ctx, "IngestTraces: failed to get app retention policy", "error", err)
		return errs.ErrInternal
	}

	appErr := service.billingService.ReserveSignalUsage(
		ctx,
		billingservice.ReserveSignalUsageInput{
			OrganizationID: input.ResolvedIngestionKey.OrganizationID,
			Signal:         billingservice.ReservationSignal_Traces,
			Bytes:          int64(input.AcceptedBytes),
		},
	)
	if appErr != nil {
		return appErr
	}

	if err := service.postgres.Queries().MarkAppTracesFirstReceived(ctx, input.ResolvedIngestionKey.AppID); err != nil {
		service.logger.ErrorContext(ctx, "IngestTraces: failed to update first received timestamp", "error", err)
	}

	message := withSignalMeta(input.Meta, "traces", input.ResolvedIngestionKey.AppID, input.ResolvedIngestionKey.IngestionKeyID, retentionDays)
	if err := service.tracesBatcher.Push(ctx, models.TracesMessage{
		MessageMeta: message,
		Spans:       spans,
	}); err != nil {
		if releaseErr := service.billingService.ReleaseSignalUsage(ctx, billingservice.ReleaseSignalUsageInput{
			OrganizationID: input.ResolvedIngestionKey.OrganizationID,
			Signal:         billingservice.ReservationSignal_Traces,
			Bytes:          int64(input.AcceptedBytes),
		}); releaseErr != nil {
			service.logger.ErrorContext(ctx, "IngestTraces: failed to release reserved usage", "error", releaseErr)
		}
		service.logger.ErrorContext(ctx, "IngestTraces: failed to enqueue traces", "error", err)
		return errs.ErrQueueUnavailable
	}

	return nil
}

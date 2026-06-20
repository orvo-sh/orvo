package ingestservice

import (
	"context"
	"log/slog"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/errs"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/models"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/services/billingservice"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/apperr"
)

func (service *service) IngestLogs(ctx context.Context, input IngestLogsInput) apperr.Error {
	service.logger.InfoContext(ctx, "IngestLogs: ingesting logs",
		slog.String("app_id", input.ResolvedIngestionKey.AppID),
		slog.String("ingestion_key_id", input.ResolvedIngestionKey.IngestionKeyID),
		slog.Int("resource_logs_count", len(input.ResourceLogs)),
	)

	records := service.transformLogs(input.ResourceLogs)
	if len(records) == 0 {
		return nil
	}

	retentionDays, err := service.getSignalRetentionDays(ctx, billingservice.ReservationSignal_Logs, input.ResolvedIngestionKey.AppID)
	if err != nil {
		service.logger.ErrorContext(ctx, "IngestLogs: failed to get app retention policy", "error", err)
		return errs.ErrInternal
	}

	appErr := service.billingService.ReserveSignalUsage(
		ctx,
		billingservice.ReserveSignalUsageInput{
			OrganizationID: input.ResolvedIngestionKey.OrganizationID,
			Signal:         billingservice.ReservationSignal_Logs,
			Bytes:          int64(input.AcceptedBytes),
		},
	)
	if appErr != nil {
		return appErr
	}

	if err := service.postgres.Queries().MarkAppLogsFirstReceived(ctx, input.ResolvedIngestionKey.AppID); err != nil {
		service.logger.ErrorContext(ctx, "IngestLogs: failed to update first received timestamp", "error", err)
	}

	message := withSignalMeta(input.Meta, "logs", input.ResolvedIngestionKey.AppID, input.ResolvedIngestionKey.IngestionKeyID, retentionDays)
	if err := service.logsBatcher.Push(ctx, models.LogsMessage{
		MessageMeta: message,
		Records:     records,
	}); err != nil {
		if releaseErr := service.billingService.ReleaseSignalUsage(ctx, billingservice.ReleaseSignalUsageInput{
			OrganizationID: input.ResolvedIngestionKey.OrganizationID,
			Signal:         billingservice.ReservationSignal_Logs,
			Bytes:          int64(input.AcceptedBytes),
		}); releaseErr != nil {
			service.logger.ErrorContext(ctx, "IngestLogs: failed to release reserved usage", "error", releaseErr)
		}
		service.logger.ErrorContext(ctx, "IngestLogs: failed to enqueue logs", "error", err)
		return errs.ErrQueueUnavailable
	}

	return nil
}

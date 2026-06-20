package billingservice

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/errs"
	pgdb "github.com/orvo-sh/orvo/apps/ingest/internal/infra/postgres/db"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/apperr"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/pgutil"
)

const usageThresholdNotificationsQueue = "billing-usage-threshold-notifications"

type triggerUsageThresholdNotificationInput struct {
	OrganizationID string
	Threshold      int
}

func (service *service) triggerUsageThresholdNotification(ctx context.Context, input triggerUsageThresholdNotificationInput, txq *pgdb.Queries) apperr.Error {
	service.logger.InfoContext(ctx, "triggerUsageThresholdNotification: triggering usage threshold notification", slog.Any("input", input))

	payload, err := json.Marshal(map[string]any{
		"organizationId": input.OrganizationID,
		"threshold":      input.Threshold,
	})
	if err != nil {
		service.logger.ErrorContext(ctx, "triggerUsageThresholdNotification: failed to marshal pg-boss payload", slog.Any("error", err))
		return errs.ErrInternal
	}

	jobID, err := txq.InsertPgBossJob(ctx, pgdb.InsertPgBossJobParams{
		Name: usageThresholdNotificationsQueue,
		Data: payload,
	})
	if err != nil {
		if pgutil.IsNoRows(err) {
			service.logger.ErrorContext(ctx, "triggerUsageThresholdNotification: pg-boss queue does not exist",
				slog.String("queue", usageThresholdNotificationsQueue),
			)
			return errs.ErrInternal
		}

		service.logger.ErrorContext(ctx, "triggerUsageThresholdNotification: failed to insert pg-boss job", slog.Any("error", err))
		return errs.ErrInternal
	}

	service.logger.InfoContext(ctx, "triggerUsageThresholdNotification: enqueued pg-boss job",
		slog.String("queue", usageThresholdNotificationsQueue),
		slog.String("job_id", jobID),
	)

	return nil
}

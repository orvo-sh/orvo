package billingservice

import (
	"context"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/errs"
	pgdb "github.com/orvo-sh/orvo/apps/ingest/internal/infra/postgres/db"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/apperr"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/pgutil"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/util"
)

type ReserveSignalUsageInput struct {
	OrganizationID string
	Signal         ReservationSignal
	Bytes          int64
}

func (service *service) ReserveSignalUsage(ctx context.Context, input ReserveSignalUsageInput) apperr.Error {
	service.logger.InfoContext(ctx, "ReserveSignalUsage: reserving usage", slog.Any("input", input))

	tx, err := service.postgres.Pool().BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		service.logger.ErrorContext(ctx, "ReserveSignalUsage: failed to begin transaction", slog.Any("error", err))
		return errs.ErrInternal
	}
	defer func() { _ = tx.Rollback(ctx) }()

	queries := service.postgres.WithTx(tx)
	billingState, err := queries.GetBillingState(ctx, input.OrganizationID)
	if err != nil {
		service.logger.ErrorContext(ctx, "ReserveSignalUsage: failed to get billing state", slog.Any("error", err))
		return errs.ErrInternal
	}

	if billingState.Status != "active" &&
		(billingState.Status != "trialing" ||
			!billingState.PeriodEnd.Valid ||
			!billingState.PeriodEnd.Time.After(time.Now())) {
		return errs.ErrBillingRequired
	}

	organizationUsage, err := queries.GetOrganizationUsageForUpdate(ctx, input.OrganizationID)
	if err != nil {
		service.logger.ErrorContext(ctx, "ReserveSignalUsage: failed to get organization usage", slog.Any("error", err))
		return errs.ErrInternal
	}

	nextLogsIngestedBytes := organizationUsage.LogsIngestedBytes
	nextTracesIngestedBytes := organizationUsage.TracesIngestedBytes
	nextMetricsIngestedBytes := organizationUsage.MetricsIngestedBytes

	switch input.Signal {
	case ReservationSignal_Logs:
		nextLogsIngestedBytes += input.Bytes
	case ReservationSignal_Traces:
		nextTracesIngestedBytes += input.Bytes
	case ReservationSignal_Metrics:
		nextMetricsIngestedBytes += input.Bytes
	default:
		service.logger.ErrorContext(ctx, "ReserveSignalUsage: invalid reservation signal", slog.Any("input", input))
		return errs.ErrInternal
	}

	totalIngestedBytes := nextLogsIngestedBytes + nextMetricsIngestedBytes + nextTracesIngestedBytes
	notified70At := pgutil.TimestampToPtr(organizationUsage.Notified70At)
	notified85At := pgutil.TimestampToPtr(organizationUsage.Notified85At)
	notified100At := pgutil.TimestampToPtr(organizationUsage.Notified100At)

	if totalIngestedBytes >= organizationUsage.IngestLimitBytes {
		if notified100At == nil {
			candidateNotifiedAt := util.Ptr(time.Now())
			if err := service.triggerUsageThresholdNotification(ctx, triggerUsageThresholdNotificationInput{
				OrganizationID: input.OrganizationID,
				Threshold:      100,
			}, queries); err == nil {
				notified100At = candidateNotifiedAt
			}
		}
	} else if float32(totalIngestedBytes) >= float32(organizationUsage.IngestLimitBytes)*0.85 {
		if notified85At == nil {
			candidateNotifiedAt := util.Ptr(time.Now())
			if err := service.triggerUsageThresholdNotification(ctx, triggerUsageThresholdNotificationInput{
				OrganizationID: input.OrganizationID,
				Threshold:      85,
			}, queries); err == nil {
				notified85At = candidateNotifiedAt
			}
		}
	} else if float32(totalIngestedBytes) >= float32(organizationUsage.IngestLimitBytes)*0.7 {
		if notified70At == nil {
			candidateNotifiedAt := util.Ptr(time.Now())
			if err := service.triggerUsageThresholdNotification(ctx, triggerUsageThresholdNotificationInput{
				OrganizationID: input.OrganizationID,
				Threshold:      70,
			}, queries); err == nil {
				notified70At = candidateNotifiedAt
			}
		}
	}

	updateOrganizationUsageParams := pgdb.UpdateOrganizationUsageParams{
		ID:                   organizationUsage.ID,
		MetricsIngestedBytes: nextMetricsIngestedBytes,
		TracesIngestedBytes:  nextTracesIngestedBytes,
		LogsIngestedBytes:    nextLogsIngestedBytes,
		Notified70At:         pgutil.TimestampFromPtr(notified70At),
		Notified85At:         pgutil.TimestampFromPtr(notified85At),
		Notified100At:        pgutil.TimestampFromPtr(notified100At),
	}

	if totalIngestedBytes > organizationUsage.IngestLimitBytes {
		return errs.ErrBillingQuotaExceeded
	}

	if err := queries.UpdateOrganizationUsage(ctx, updateOrganizationUsageParams); err != nil {
		service.logger.ErrorContext(ctx, "ReserveSignalUsage: failed to update organization usage", slog.Any("error", err))
		return errs.ErrInternal
	}

	if err := tx.Commit(ctx); err != nil {
		service.logger.ErrorContext(ctx, "ReserveSignalUsage: failed to commit usage reservation", slog.Any("error", err))
		return errs.ErrInternal
	}

	return nil
}

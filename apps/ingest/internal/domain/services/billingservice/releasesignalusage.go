package billingservice

import (
	"context"
	"log/slog"

	"github.com/jackc/pgx/v5"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/errs"
	pgdb "github.com/orvo-sh/orvo/apps/ingest/internal/infra/postgres/db"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/apperr"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/util"
)

type ReleaseSignalUsageInput struct {
	OrganizationID string
	Signal         ReservationSignal
	Bytes          int64
}

func (service *service) ReleaseSignalUsage(ctx context.Context, input ReleaseSignalUsageInput) apperr.Error {
	service.logger.InfoContext(ctx, "ReleaseSignalUsage: releasing usage", slog.Any("input", input))

	tx, err := service.postgres.Pool().BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		service.logger.ErrorContext(ctx, "ReleaseSignalUsage: failed to begin transaction", slog.Any("error", err))
		return errs.ErrInternal
	}
	defer func() { _ = tx.Rollback(ctx) }()

	queries := service.postgres.WithTx(tx)

	organizationUsage, err := queries.GetOrganizationUsageForUpdate(ctx, input.OrganizationID)
	if err != nil {
		service.logger.ErrorContext(ctx, "ReleaseSignalUsage: failed to get organization usage", slog.Any("error", err))
		return errs.ErrInternal
	}

	updateOrganizationUsageParams := pgdb.UpdateOrganizationUsageParams{
		ID:                   organizationUsage.ID,
		MetricsIngestedBytes: organizationUsage.MetricsIngestedBytes,
		TracesIngestedBytes:  organizationUsage.TracesIngestedBytes,
		LogsIngestedBytes:    organizationUsage.LogsIngestedBytes,
		Notified70At:         organizationUsage.Notified70At,
		Notified85At:         organizationUsage.Notified85At,
		Notified100At:        organizationUsage.Notified100At,
	}

	switch input.Signal {
	case ReservationSignal_Logs:
		updateOrganizationUsageParams.LogsIngestedBytes = util.MaxInt64(organizationUsage.LogsIngestedBytes-input.Bytes, 0)
	case ReservationSignal_Traces:
		updateOrganizationUsageParams.TracesIngestedBytes = util.MaxInt64(organizationUsage.TracesIngestedBytes-input.Bytes, 0)
	case ReservationSignal_Metrics:
		updateOrganizationUsageParams.MetricsIngestedBytes = util.MaxInt64(organizationUsage.MetricsIngestedBytes-input.Bytes, 0)
	default:
		service.logger.ErrorContext(ctx, "ReleaseSignalUsage: invalid reservation signal",
			slog.String("signal", string(input.Signal)),
		)
		return errs.ErrInternal
	}

	if err := queries.UpdateOrganizationUsage(ctx, updateOrganizationUsageParams); err != nil {
		service.logger.ErrorContext(ctx, "ReleaseSignalUsage: failed to update organization usage", slog.Any("error", err))
		return errs.ErrInternal
	}

	if err := tx.Commit(ctx); err != nil {
		service.logger.ErrorContext(ctx, "ReleaseSignalUsage: failed to commit usage release", slog.Any("error", err))
		return errs.ErrInternal
	}

	return nil
}

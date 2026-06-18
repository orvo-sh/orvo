package billingservice

import (
	"context"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/errs"
	"github.com/orvo-sh/orvo/apps/ingest/internal/infra/postgres/db"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/apperr"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/pgutil"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/util"
)

func (service *service) ReserveSignalUsage(ctx context.Context, organizationID string, signal string, bytes int) (*Reservation, apperr.Error) {
	service.logger.InfoContext(ctx, "ReserveSignalUsage: reserving usage",
		slog.String("organization_id", organizationID),
		slog.String("signal", signal),
		slog.Int("bytes", bytes),
	)

	if organizationID == "" {
		return nil, errs.ErrBillingRequired
	}

	if bytes <= 0 {
		return &Reservation{OrganizationID: organizationID, Signal: signal}, nil
	}

	state, err := service.postgres.Queries().GetBillingState(ctx, organizationID)
	if err != nil {
		if pgutil.IsNoRows(err) {
			return nil, errs.ErrBillingRequired
		}
		service.logger.ErrorContext(ctx, "ReserveSignalUsage: failed to load billing state", "error", err)
		return nil, errs.ErrInternal
	}

	billingState := billingState{
		PlanKey:       state.PlanKey,
		Status:        state.Status,
		IncludedBytes: state.IncludedBytes,
		PeriodStart:   pgutil.TimestampToTime(state.PeriodStart),
		PeriodEnd:     pgutil.TimestampToTime(state.PeriodEnd),
	}
	if billingState.PeriodStart.IsZero() {
		billingState.PeriodStart = time.Now().UTC()
	}
	if billingState.PeriodEnd.IsZero() {
		billingState.PeriodEnd = billingState.PeriodStart.AddDate(0, 0, 30)
	}

	if !statusHasAccess(billingState.Status) {
		return nil, errs.ErrBillingRequired
	}

	tx, err := service.postgres.Pool().BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		service.logger.ErrorContext(ctx, "ReserveSignalUsage: failed to begin transaction", "error", err)
		return nil, errs.ErrInternal
	}
	defer func() { _ = tx.Rollback(ctx) }()

	queries := service.postgres.WithTx(tx)

	row, appErr := service.getUsageRowForUpdate(ctx, queries, organizationID, signal)
	if appErr != nil {
		if !apperr.Is(appErr, errs.ErrBillingRequired) {
			return nil, appErr
		}

		if _, err := queries.CreateOrganizationUsage(ctx, pgdb.CreateOrganizationUsageParams{
			ID:                   util.GenerateID("orgu"),
			OrganizationID:       organizationID,
			LogsRetentionDays:    int32(service.defaultLogsRetentionDays),
			TracesRetentionDays:  int32(service.defaultTracesRetentionDays),
			MetricsRetentionDays: int32(service.defaultMetricsRetentionDays),
			CurrentPeriodStart:   pgutil.Timestamp(billingState.PeriodStart),
			CurrentPeriodEnd:     pgutil.Timestamp(billingState.PeriodEnd),
			IngestLimitBytes:     billingState.IncludedBytes,
		}); err != nil && !pgutil.IsUniqueViolation(err, "organization_usage_organization_id_uidx") {
			service.logger.ErrorContext(ctx, "ReserveSignalUsage: failed to create usage row", "error", err)
			return nil, errs.ErrInternal
		}

		row, appErr = service.getUsageRowForUpdate(ctx, queries, organizationID, signal)
		if appErr != nil {
			return nil, appErr
		}
	}

	previousUsedBytes := row.UsedBytes
	newUsedBytes := previousUsedBytes + int64(bytes)
	if billingState.PlanKey == "starter" && newUsedBytes > row.IncludedBytes {
		return nil, errs.ErrBillingQuotaExceeded
	}

	now := time.Now().UTC()
	notified70At := row.Notified70At
	notified85At := row.Notified85At
	notified100At := row.Notified100At

	for _, threshold := range []int{70, 85, 100} {
		if !crossedThreshold(previousUsedBytes, newUsedBytes, row.IncludedBytes, threshold) {
			continue
		}

		switch threshold {
		case 70:
			if !notified70At.IsZero() {
				continue
			}
			notified70At = now
		case 85:
			if !notified85At.IsZero() {
				continue
			}
			notified85At = now
		case 100:
			if !notified100At.IsZero() {
				continue
			}
			notified100At = now
		}
	}

	if appErr := service.updateUsageReservation(ctx, queries, organizationID, signal, usageRow{
		ID:            row.ID,
		UsedBytes:     newUsedBytes,
		IncludedBytes: row.IncludedBytes,
		Notified70At:  notified70At,
		Notified85At:  notified85At,
		Notified100At: notified100At,
	}); appErr != nil {
		return nil, appErr
	}

	if err := tx.Commit(ctx); err != nil {
		service.logger.ErrorContext(ctx, "ReserveSignalUsage: failed to commit usage reservation", "error", err)
		return nil, errs.ErrInternal
	}

	return &Reservation{
		OrganizationID: organizationID,
		Signal:         signal,
		PeriodStart:    billingState.PeriodStart,
		PeriodEnd:      billingState.PeriodEnd,
		ReservedBytes:  int64(bytes),
	}, nil
}

func statusHasAccess(status string) bool {
	switch status {
	case "active", "trialing":
		return true
	default:
		return false
	}
}

func crossedThreshold(previousUsedBytes int64, newUsedBytes int64, includedBytes int64, threshold int) bool {
	if includedBytes <= 0 {
		return false
	}

	thresholdBytes := (includedBytes * int64(threshold)) / 100
	return previousUsedBytes < thresholdBytes && newUsedBytes >= thresholdBytes
}

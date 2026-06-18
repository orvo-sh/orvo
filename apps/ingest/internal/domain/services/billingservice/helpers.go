package billingservice

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/errs"
	pgdb "github.com/orvo-sh/orvo/apps/ingest/internal/infra/postgres/db"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/apperr"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/pgutil"
)

func (service *service) getUsageRowForUpdate(ctx context.Context, queries *pgdb.Queries, organizationID string, signal string) (*usageRow, apperr.Error) {
	current, err := queries.GetOrganizationUsageForUpdate(ctx, organizationID)
	if err != nil {
		if pgutil.IsNoRows(err) {
			return nil, errs.ErrBillingRequired
		}
		service.logger.ErrorContext(ctx, "getUsageRowForUpdate: failed to load usage row", "error", err)
		return nil, errs.ErrInternal
	}

	row := &usageRow{
		ID:            current.ID,
		IncludedBytes: current.IngestLimitBytes,
		Notified70At:  pgutil.TimestampToTime(current.Notified70At),
		Notified85At:  pgutil.TimestampToTime(current.Notified85At),
		Notified100At: pgutil.TimestampToTime(current.Notified100At),
	}

	switch signal {
	case "logs":
		row.UsedBytes = current.LogsIngestedBytes
	case "traces":
		row.UsedBytes = current.TracesIngestedBytes
	case "metrics":
		row.UsedBytes = current.MetricsIngestedBytes
	default:
		return nil, errs.ErrBillingRequired
	}

	return row, nil
}

func (service *service) updateUsageReservation(ctx context.Context, queries *pgdb.Queries, organizationID string, signal string, row usageRow) apperr.Error {
	switch signal {
	case "logs":
		if err := queries.UpdateOrganizationUsageLogs(ctx, pgdb.UpdateOrganizationUsageLogsParams{
			ID:                row.ID,
			OrganizationID:    organizationID,
			LogsIngestedBytes: row.UsedBytes,
			IngestLimitBytes:  row.IncludedBytes,
			Notified70At:      nullableTimestamp(row.Notified70At),
			Notified85At:      nullableTimestamp(row.Notified85At),
			Notified100At:     nullableTimestamp(row.Notified100At),
		}); err != nil {
			service.logger.ErrorContext(ctx, "updateUsageReservation: failed to update logs usage row", "error", err)
			return errs.ErrInternal
		}
	case "traces":
		if err := queries.UpdateOrganizationUsageTraces(ctx, pgdb.UpdateOrganizationUsageTracesParams{
			ID:                  row.ID,
			OrganizationID:      organizationID,
			TracesIngestedBytes: row.UsedBytes,
			IngestLimitBytes:    row.IncludedBytes,
			Notified70At:        nullableTimestamp(row.Notified70At),
			Notified85At:        nullableTimestamp(row.Notified85At),
			Notified100At:       nullableTimestamp(row.Notified100At),
		}); err != nil {
			service.logger.ErrorContext(ctx, "updateUsageReservation: failed to update traces usage row", "error", err)
			return errs.ErrInternal
		}
	case "metrics":
		if err := queries.UpdateOrganizationUsageMetrics(ctx, pgdb.UpdateOrganizationUsageMetricsParams{
			ID:                   row.ID,
			OrganizationID:       organizationID,
			MetricsIngestedBytes: row.UsedBytes,
			IngestLimitBytes:     row.IncludedBytes,
			Notified70At:         nullableTimestamp(row.Notified70At),
			Notified85At:         nullableTimestamp(row.Notified85At),
			Notified100At:        nullableTimestamp(row.Notified100At),
		}); err != nil {
			service.logger.ErrorContext(ctx, "updateUsageReservation: failed to update metrics usage row", "error", err)
			return errs.ErrInternal
		}
	default:
		return errs.ErrBillingRequired
	}

	return nil
}

func nullableTimestamp(value time.Time) pgtype.Timestamp {
	if value.IsZero() {
		return pgtype.Timestamp{Valid: false}
	}
	return pgutil.Timestamp(value)
}

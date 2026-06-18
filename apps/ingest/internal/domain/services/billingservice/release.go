package billingservice

import (
	"context"
	"log/slog"

	"github.com/orvo-sh/orvo/apps/ingest/internal/infra/postgres/db"
)

func (service *service) ReleaseSignalUsage(ctx context.Context, reservation *Reservation) error {
	if reservation == nil || reservation.ReservedBytes <= 0 || reservation.OrganizationID == "" || reservation.Signal == "" {
		return nil
	}

	service.logger.InfoContext(ctx, "ReleaseSignalUsage: releasing usage",
		slog.String("organization_id", reservation.OrganizationID),
		slog.String("signal", reservation.Signal),
		slog.Int64("bytes", reservation.ReservedBytes),
	)

	switch reservation.Signal {
	case "logs":
		return service.postgres.Queries().ReleaseOrganizationUsageLogs(ctx, pgdb.ReleaseOrganizationUsageLogsParams{
			OrganizationID:    reservation.OrganizationID,
			LogsIngestedBytes: reservation.ReservedBytes,
		})
	case "traces":
		return service.postgres.Queries().ReleaseOrganizationUsageTraces(ctx, pgdb.ReleaseOrganizationUsageTracesParams{
			OrganizationID:      reservation.OrganizationID,
			TracesIngestedBytes: reservation.ReservedBytes,
		})
	case "metrics":
		return service.postgres.Queries().ReleaseOrganizationUsageMetrics(ctx, pgdb.ReleaseOrganizationUsageMetricsParams{
			OrganizationID:       reservation.OrganizationID,
			MetricsIngestedBytes: reservation.ReservedBytes,
		})
	default:
		return nil
	}
}

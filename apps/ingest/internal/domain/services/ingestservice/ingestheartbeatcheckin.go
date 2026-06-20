package ingestservice

import (
	"context"
	"log/slog"
	"time"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/errs"
	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/models"
	pgdb "github.com/orvo-sh/orvo/apps/ingest/internal/infra/postgres/db"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/apperr"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/pgutil"
)

func (service *service) IngestHeartbeatCheckIn(ctx context.Context, token string) (time.Time, apperr.Error) {
	service.logger.InfoContext(ctx, "IngestHeartbeatCheckIn: ingesting heartbeat check-in")

	monitor, err := service.postgres.Queries().GetHeartbeatMonitorByToken(ctx, token)
	if err != nil {
		if pgutil.IsNoRows(err) {
			return time.Time{}, errs.ErrHeartbeatMonitorNotFound
		}
		service.logger.ErrorContext(ctx, "IngestHeartbeatCheckIn: failed to load heartbeat monitor", "error", err)
		return time.Time{}, errs.ErrInternal
	}

	checkedInAt := time.Now().UTC()
	if err := service.postgres.Queries().MarkHeartbeatMonitorHealthy(ctx, pgdb.MarkHeartbeatMonitorHealthyParams{
		ID:            monitor.ID,
		LastCheckInAt: pgutil.Timestamp(checkedInAt),
	}); err != nil {
		service.logger.ErrorContext(ctx, "IngestHeartbeatCheckIn: failed to update heartbeat monitor", "error", err)
		return time.Time{}, errs.ErrInternal
	}

	if err := service.enqueueHeartbeatCheckIn(ctx, models.HeartbeatCheckIn{
		AppID:              monitor.AppID,
		HeartbeatMonitorID: monitor.ID,
		CheckedInAt:        checkedInAt,
	}); err != nil {
		service.logger.ErrorContext(ctx, "IngestHeartbeatCheckIn: failed to enqueue heartbeat check-in",
			slog.String("app_id", monitor.AppID),
			slog.String("heartbeat_monitor_id", monitor.ID),
			"error", err,
		)
	}

	return checkedInAt, nil
}

package ingestservice

import (
	"context"
	"time"

	"github.com/orvo-sh/orvo/apps/ingest/internal/domain/models"
	chdb "github.com/orvo-sh/orvo/apps/ingest/internal/infra/clickhouse/db"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/chutil"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/util"
)

func (service *service) flushHeartbeatCheckIns(ctx context.Context, batch []models.HeartbeatCheckIn) error {
	rows := make([]chdb.InsertHeartbeatCheckInsParams, 0, len(batch))

	for _, checkIn := range batch {
		rows = append(rows, chdb.InsertHeartbeatCheckInsParams{
			ID:                 util.GenerateID("hchk"),
			AppID:              checkIn.AppID,
			HeartbeatMonitorID: checkIn.HeartbeatMonitorID,
			CheckedInAt:        chutil.NormalizeTime(checkIn.CheckedInAt, time.Now().UTC()),
		})
	}

	return service.clickhouse.InsertHeartbeatCheckIns(ctx, rows)
}

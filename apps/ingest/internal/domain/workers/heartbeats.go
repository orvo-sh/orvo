package workers

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
			ID:                   util.GenerateID("hchk"),
			AppID:                checkIn.AppID,
			HeartbeatMonitorID:   checkIn.HeartbeatMonitorID,
			HeartbeatName:        checkIn.HeartbeatName,
			CheckedInAt:          chutil.NormalizeTime(checkIn.CheckedInAt, time.Now().UTC()),
			PreviousStatus:       checkIn.PreviousStatus,
			Recovered:            checkIn.Recovered,
			ExpectedEverySeconds: uint32(checkIn.ExpectedEverySeconds),
			GraceSeconds:         uint32(checkIn.GraceSeconds),
			LastCheckInAt:        chutil.TimePtr(zeroTime(checkIn.LastCheckInAt)),
			LastMissedAt:         chutil.TimePtr(zeroTime(checkIn.LastMissedAt)),
			LastRecoveredAt:      chutil.TimePtr(zeroTime(checkIn.LastRecoveredAt)),
		})
	}

	return service.clickhouse.Queries().InsertHeartbeatCheckIns(ctx, rows)
}

func zeroTime(value *time.Time) time.Time {
	if value == nil {
		return time.Time{}
	}
	return *value
}

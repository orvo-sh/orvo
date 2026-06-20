package chdb

import (
	"context"
	"fmt"
)

const insertHeartbeatCheckIns = `
INSERT INTO heartbeat_checkins (
  id,
  app_id,
  heartbeat_monitor_id,
  checked_in_at
)
`

func (q *Queries) InsertHeartbeatCheckIns(ctx context.Context, arg []InsertHeartbeatCheckInsParams) error {
	if len(arg) == 0 {
		return nil
	}

	batch, err := q.db.PrepareBatch(ctx, insertHeartbeatCheckIns)
	if err != nil {
		return fmt.Errorf("clickhouse: prepare heartbeat check-ins batch: %w", err)
	}

	for _, params := range arg {
		if err := batch.Append(
			params.ID,
			params.AppID,
			params.HeartbeatMonitorID,
			params.CheckedInAt,
		); err != nil {
			return fmt.Errorf("clickhouse: append heartbeat check-in row: %w", err)
		}
	}

	if err := batch.Send(); err != nil {
		return fmt.Errorf("clickhouse: send heartbeat check-ins batch: %w", err)
	}

	return nil
}

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
  heartbeat_name,
  checked_in_at,
  previous_status,
  recovered,
  expected_every_seconds,
  grace_seconds,
  last_check_in_at,
  last_missed_at,
  last_recovered_at
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
			params.HeartbeatName,
			params.CheckedInAt,
			params.PreviousStatus,
			params.Recovered,
			params.ExpectedEverySeconds,
			params.GraceSeconds,
			params.LastCheckInAt,
			params.LastMissedAt,
			params.LastRecoveredAt,
		); err != nil {
			return fmt.Errorf("clickhouse: append heartbeat check-in row: %w", err)
		}
	}

	if err := batch.Send(); err != nil {
		return fmt.Errorf("clickhouse: send heartbeat check-ins batch: %w", err)
	}

	return nil
}

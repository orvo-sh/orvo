-- name: MarkAppLogsFirstReceived :exec
UPDATE app
SET logs_first_received_at = NOW()
WHERE id = $1
  AND logs_first_received_at IS NULL;

-- name: MarkAppTracesFirstReceived :exec
UPDATE app
SET traces_first_received_at = NOW()
WHERE id = $1
  AND traces_first_received_at IS NULL;

-- name: MarkAppMetricsFirstReceived :exec
UPDATE app
SET metrics_first_received_at = NOW()
WHERE id = $1
  AND metrics_first_received_at IS NULL;

-- name: MarkAppHeartbeatsFirstReceived :exec
UPDATE app
SET heartbeats_first_received_at = $2
WHERE id = $1
  AND heartbeats_first_received_at IS NULL;

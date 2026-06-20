-- name: GetHeartbeatMonitorByToken :one
SELECT
  heartbeat_monitor.id,
  heartbeat_monitor.app_id
FROM heartbeat_monitor
WHERE heartbeat_monitor.token = $1;

-- name: MarkHeartbeatMonitorHealthy :exec
UPDATE heartbeat_monitor
SET
  last_check_in_at = $2,
  last_status = 'healthy',
  updated_at = $2
WHERE id = $1;

-- name: GetHeartbeatMonitorByToken :one
SELECT
  heartbeat_monitor.id,
  heartbeat_monitor.app_id,
  heartbeat_monitor.name,
  heartbeat_monitor.token,
  heartbeat_monitor.expected_every_seconds,
  heartbeat_monitor.grace_seconds,
  heartbeat_monitor.last_check_in_at,
  heartbeat_monitor.last_status::text AS last_status,
  heartbeat_monitor.last_missed_at,
  heartbeat_monitor.last_recovered_at,
  heartbeat_monitor.paused_at,
  app.name AS app_name
FROM heartbeat_monitor
JOIN app ON app.id = heartbeat_monitor.app_id
WHERE heartbeat_monitor.token = $1;

-- name: MarkHeartbeatMonitorHealthy :exec
UPDATE heartbeat_monitor
SET
  last_check_in_at = $2,
  last_status = 'healthy',
  last_recovered_at = CASE WHEN last_status = 'missed' THEN $2 ELSE last_recovered_at END,
  updated_at = $2
WHERE id = $1;

-- name: ListHeartbeatMonitorDestinationIDs :many
SELECT destination_id
FROM heartbeat_monitor_destination
WHERE heartbeat_monitor_id = $1;

-- name: InsertNotificationDelivery :exec
INSERT INTO notification_delivery (
  id,
  app_id,
  destination_id,
  source_kind,
  source_id,
  event_type,
  payload,
  status,
  next_attempt_at
)
VALUES ($1, $2, $3, 'heartbeat', $4, $5, $6, 'pending', $7);

-- name: GetHeartbeatMonitorByToken :one
SELECT
  heartbeat_monitor.id,
  heartbeat_monitor.app_id,
  heartbeat_monitor.name,
  heartbeat_monitor.expected_every_seconds,
  heartbeat_monitor.grace_seconds,
  heartbeat_monitor.last_check_in_at,
  heartbeat_monitor.status,
  app.name AS app_name
FROM heartbeat_monitor
INNER JOIN app ON app.id = heartbeat_monitor.app_id
WHERE heartbeat_monitor.token = $1
FOR UPDATE OF heartbeat_monitor;

-- name: MarkHeartbeatMonitorHealthy :exec
UPDATE heartbeat_monitor
SET
  last_check_in_at = $2,
  status = 'healthy',
  updated_at = $2
WHERE id = $1;

-- name: ResolveOpenHeartbeatIncident :one
WITH latest AS (
  SELECT id
  FROM incident
  WHERE
    incident.app_id = $1
    AND incident.source_key = $2
    AND incident.status = 'open'
  ORDER BY incident.opened_at DESC
  LIMIT 1
  FOR UPDATE
)
UPDATE incident
SET
  status = 'resolved',
  resolved_at = $3,
  last_observed_at = $3,
  updated_at = $3
FROM latest
WHERE incident.id = latest.id
RETURNING incident.id;

-- name: InsertHeartbeatIncidentEvent :exec
INSERT INTO incident_event (
  id,
  app_id,
  incident_id,
  event_type,
  occurred_at,
  metadata,
  created_at
)
VALUES ($1, $2, $3, $4, $5, $6, $5);

-- name: ListHeartbeatDestinationIDs :many
SELECT destination_id
FROM heartbeat_monitor_destination
WHERE heartbeat_monitor_id = $1;

-- name: InsertHeartbeatRecoveryDelivery :exec
INSERT INTO notification_delivery (
  id,
  app_id,
  destination_id,
  incident_id,
  source_kind,
  source_id,
  event_type,
  payload,
  status,
  next_attempt_at,
  created_at,
  updated_at
)
VALUES (
  $1,
  $2,
  $3,
  $4,
  'heartbeat',
  $5,
  'heartbeat.recovered',
  $6,
  'pending',
  $7,
  $7,
  $7
);

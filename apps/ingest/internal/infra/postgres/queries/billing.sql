-- name: GetBillingState :one
SELECT
  COALESCE(current_subscription.plan, organization.billing_plan::text, 'none') AS plan_key,
  COALESCE(current_subscription.status, organization.billing_status::text, 'inactive') AS status,
  COALESCE(organization_usage.ingest_limit_bytes, 0) AS included_bytes,
  COALESCE(organization_usage.current_period_start, current_subscription.period_start) AS period_start,
  COALESCE(organization_usage.current_period_end, current_subscription.period_end) AS period_end
FROM organization
LEFT JOIN organization_usage ON organization_usage.organization_id = organization.id
LEFT JOIN LATERAL (
  SELECT plan, status, period_start, period_end
  FROM subscription
  WHERE reference_id = $1
  ORDER BY
    CASE status
      WHEN 'active' THEN 0
      WHEN 'trialing' THEN 1
      WHEN 'paused' THEN 2
      WHEN 'past_due' THEN 3
      WHEN 'unpaid' THEN 4
      WHEN 'incomplete' THEN 5
      ELSE 6
    END,
    period_end DESC
  LIMIT 1
) AS current_subscription ON TRUE
WHERE organization.id = $1;

-- name: GetOrganizationUsageForUpdate :one
SELECT
  id,
  organization_id,
  logs_retention_days,
  traces_retention_days,
  metrics_retention_days,
  current_period_start,
  current_period_end,
  logs_ingested_bytes,
  traces_ingested_bytes,
  metrics_ingested_bytes,
  ingest_limit_bytes,
  ingest_overage_enabled,
  ingest_overage_budget_cents,
  scout_overage_enabled,
  scout_overage_budget_cents,
  notified_70_at,
  notified_85_at,
  notified_100_at,
  created_at,
  updated_at
FROM organization_usage
WHERE organization_id = $1
FOR UPDATE;

-- name: UpdateOrganizationUsage :exec
UPDATE organization_usage
SET metrics_ingested_bytes = $2,
    traces_ingested_bytes = $3, 
    logs_ingested_bytes = $4,
    notified_70_at = $5,
    notified_85_at = $6,
    notified_100_at = $7,
    updated_at = NOW()
WHERE id = $1;

-- name: GetAppRetentionPolicy :one
SELECT
  app.organization_id,
  COALESCE(organization.billing_plan::text, ''::text)::text AS plan_key,
  CASE WHEN organization.billing_plan IS NULL THEN 'default' ELSE 'billing' END::text AS source,
  organization_usage.logs_retention_days AS logs_retention_days,
  organization_usage.traces_retention_days AS traces_retention_days,
  organization_usage.metrics_retention_days AS metrics_retention_days,
  organization_usage.ingest_limit_bytes AS logs_max_ingest_bytes_per_period,
  organization_usage.ingest_limit_bytes AS traces_max_ingest_bytes_per_period,
  organization_usage.ingest_limit_bytes AS metrics_max_ingest_bytes_per_period
FROM app
JOIN organization ON organization.id = app.organization_id
LEFT JOIN organization_usage ON organization_usage.organization_id = organization.id
WHERE app.id = $1;

-- name: InsertPgBossJob :one
WITH queue_config AS (
  SELECT
    retry_limit,
    retry_delay,
    retry_backoff,
    retry_delay_max,
    expire_seconds,
    retention_seconds,
    deletion_seconds,
    dead_letter,
    policy
  FROM pgboss.queue
  WHERE name = $1
)
INSERT INTO pgboss.job (
  name,
  data,
  priority,
  start_after,
  expire_seconds,
  deletion_seconds,
  keep_until,
  retry_limit,
  retry_delay,
  retry_backoff,
  retry_delay_max,
  policy,
  dead_letter
)
SELECT
  $1,
  $2,
  0,
  NOW(),
  queue_config.expire_seconds,
  queue_config.deletion_seconds,
  NOW() + (queue_config.retention_seconds * interval '1 second'),
  queue_config.retry_limit,
  queue_config.retry_delay,
  queue_config.retry_backoff,
  queue_config.retry_delay_max,
  queue_config.policy,
  queue_config.dead_letter
FROM queue_config
RETURNING id::text;

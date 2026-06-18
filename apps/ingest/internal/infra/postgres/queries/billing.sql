-- name: GetBillingState :one
SELECT
  COALESCE(organization.billing_plan::text, current_subscription.plan, 'none') AS plan_key,
  COALESCE(organization.billing_status::text, current_subscription.status, 'inactive') AS status,
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
  notified_70_at,
  notified_85_at,
  notified_100_at,
  created_at,
  updated_at
FROM organization_usage
WHERE organization_id = $1
FOR UPDATE;

-- name: CreateOrganizationUsage :one
INSERT INTO organization_usage (
  id,
  organization_id,
  logs_retention_days,
  traces_retention_days,
  metrics_retention_days,
  current_period_start,
  current_period_end,
  ingest_limit_bytes
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING
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
  notified_70_at,
  notified_85_at,
  notified_100_at,
  created_at,
  updated_at;

-- name: UpdateOrganizationUsageLogs :exec
UPDATE organization_usage
SET logs_ingested_bytes = $3,
    ingest_limit_bytes = $4,
    notified_70_at = $5,
    notified_85_at = $6,
    notified_100_at = $7,
    updated_at = NOW()
WHERE id = $1
  AND organization_id = $2;

-- name: UpdateOrganizationUsageTraces :exec
UPDATE organization_usage
SET traces_ingested_bytes = $3,
    ingest_limit_bytes = $4,
    notified_70_at = $5,
    notified_85_at = $6,
    notified_100_at = $7,
    updated_at = NOW()
WHERE id = $1
  AND organization_id = $2;

-- name: UpdateOrganizationUsageMetrics :exec
UPDATE organization_usage
SET metrics_ingested_bytes = $3,
    ingest_limit_bytes = $4,
    notified_70_at = $5,
    notified_85_at = $6,
    notified_100_at = $7,
    updated_at = NOW()
WHERE id = $1
  AND organization_id = $2;

-- name: ReleaseOrganizationUsageLogs :exec
UPDATE organization_usage
SET logs_ingested_bytes = GREATEST(logs_ingested_bytes - $2, 0),
    updated_at = NOW()
WHERE organization_id = $1;

-- name: ReleaseOrganizationUsageTraces :exec
UPDATE organization_usage
SET traces_ingested_bytes = GREATEST(traces_ingested_bytes - $2, 0),
    updated_at = NOW()
WHERE organization_id = $1;

-- name: ReleaseOrganizationUsageMetrics :exec
UPDATE organization_usage
SET metrics_ingested_bytes = GREATEST(metrics_ingested_bytes - $2, 0),
    updated_at = NOW()
WHERE organization_id = $1;

-- name: GetAppRetentionPolicy :one
SELECT
  app.organization_id,
  COALESCE(organization.billing_plan::text, ''::text)::text AS plan_key,
  CASE WHEN organization.billing_plan IS NULL THEN 'default' ELSE 'billing' END::text AS source,
  COALESCE(organization_usage.logs_retention_days, sqlc.arg(default_logs_retention_days)::integer) AS logs_retention_days,
  COALESCE(organization_usage.traces_retention_days, sqlc.arg(default_traces_retention_days)::integer) AS traces_retention_days,
  COALESCE(organization_usage.metrics_retention_days, sqlc.arg(default_metrics_retention_days)::integer) AS metrics_retention_days,
  organization_usage.ingest_limit_bytes AS logs_max_ingest_bytes_per_period,
  organization_usage.ingest_limit_bytes AS traces_max_ingest_bytes_per_period,
  organization_usage.ingest_limit_bytes AS metrics_max_ingest_bytes_per_period
FROM app
JOIN organization ON organization.id = app.organization_id
LEFT JOIN organization_usage ON organization_usage.organization_id = organization.id
WHERE app.id = $1;

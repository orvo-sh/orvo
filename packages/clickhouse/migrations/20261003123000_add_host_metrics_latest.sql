CREATE TABLE IF NOT EXISTS host_metrics_latest (
    app_id String,
    host_id String,
    host_name AggregateFunction(argMax, String, DateTime64(3)),
    host_arch AggregateFunction(argMax, String, DateTime64(3)),
    os_type AggregateFunction(argMax, String, DateTime64(3)),
    deployment_environment AggregateFunction(argMax, String, DateTime64(3)),
    agent_version AggregateFunction(argMax, String, DateTime64(3)),
    last_seen SimpleAggregateFunction(max, DateTime64(3)),
    expires_at SimpleAggregateFunction(max, DateTime64(3))
) ENGINE = AggregatingMergeTree
ORDER BY (app_id, host_id)
TTL expires_at DELETE;
-- statement-breakpoint
CREATE MATERIALIZED VIEW IF NOT EXISTS host_metrics_latest_mv
TO host_metrics_latest
AS
SELECT
    app_id,
    host_id,
    argMaxState(toString(host_name), time) AS host_name,
    argMaxState(toString(host_arch), time) AS host_arch,
    argMaxState(toString(os_type), time) AS os_type,
    argMaxState(toString(deployment_environment), time) AS deployment_environment,
    argMaxState(resource_attributes['orvo.agent.version'], time) AS agent_version,
    max(time) AS last_seen,
    max(expires_at) AS expires_at
FROM metrics_raw
WHERE entity_kind = 'host'
  AND host_id != ''
GROUP BY app_id, host_id;
-- statement-breakpoint
INSERT INTO host_metrics_latest
SELECT
    app_id,
    host_id,
    argMaxState(toString(host_name), time) AS host_name,
    argMaxState(toString(host_arch), time) AS host_arch,
    argMaxState(toString(os_type), time) AS os_type,
    argMaxState(toString(deployment_environment), time) AS deployment_environment,
    argMaxState(resource_attributes['orvo.agent.version'], time) AS agent_version,
    max(time) AS last_seen,
    max(expires_at) AS expires_at
FROM metrics_raw
WHERE entity_kind = 'host'
  AND host_id != ''
GROUP BY app_id, host_id;

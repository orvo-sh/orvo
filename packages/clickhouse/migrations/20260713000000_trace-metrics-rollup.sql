CREATE TABLE IF NOT EXISTS trace_metrics_1m (
    app_id String,
    bucket_start DateTime,
    service_name LowCardinality(String),
    deployment_environment LowCardinality(String),
    scope_name LowCardinality(String),
    operation_name String,
    expires_at SimpleAggregateFunction(max, DateTime64(3)),
    request_count SimpleAggregateFunction(sum, UInt64),
    error_count SimpleAggregateFunction(sum, UInt64),
    duration_sum_ns SimpleAggregateFunction(sum, Int64),
    duration_min_ns SimpleAggregateFunction(min, Int64),
    duration_max_ns SimpleAggregateFunction(max, Int64),
    duration_quantiles AggregateFunction(
        quantilesTDigest(0.5, 0.95, 0.99),
        Int64
    )
) ENGINE = AggregatingMergeTree
PARTITION BY toYYYYMM(bucket_start)
ORDER BY (
    app_id,
    bucket_start,
    deployment_environment,
    service_name,
    scope_name,
    operation_name
)
TTL expires_at DELETE;
-- statement-breakpoint
CREATE MATERIALIZED VIEW IF NOT EXISTS trace_metrics_1m_mv
TO trace_metrics_1m
AS
SELECT
    app_id,
    toStartOfMinute(start_time) AS bucket_start,
    service_name,
    deployment_environment,
    scope_name,
    name AS operation_name,
    max(expires_at) AS expires_at,
    toUInt64(count()) AS request_count,
    toUInt64(countIf(status_code = 2)) AS error_count,
    sum(duration_ns) AS duration_sum_ns,
    min(duration_ns) AS duration_min_ns,
    max(duration_ns) AS duration_max_ns,
    quantilesTDigestState(0.5, 0.95, 0.99)(duration_ns) AS duration_quantiles
FROM traces_raw
WHERE kind IN (2, 5)
GROUP BY
    app_id,
    bucket_start,
    service_name,
    deployment_environment,
    scope_name,
    operation_name;

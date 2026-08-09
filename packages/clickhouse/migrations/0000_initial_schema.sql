CREATE TABLE IF NOT EXISTS logs_raw (
    id String,
    app_id String,
    ingestion_key_id String,
    received_at DateTime64(3),
    expires_at DateTime64(3),
    timestamp DateTime64(3),
    observed_timestamp DateTime64(3),
    severity_number UInt8,
    severity_text LowCardinality(String),
    body String,
    trace_id String,
    span_id String,
    trace_flags UInt32,
    resource_attributes Map(String, String),
    resource_schema_url String,
    scope_name LowCardinality(String),
    scope_version LowCardinality(String),
    scope_attributes Map(String, String),
    scope_schema_url String,
    log_attributes Map(String, String),
    service_name LowCardinality(String),
    deployment_environment LowCardinality(String),
    INDEX idx_logs_trace_id trace_id TYPE bloom_filter(0.001) GRANULARITY 4,
    INDEX idx_logs_span_id span_id TYPE bloom_filter(0.001) GRANULARITY 4,
    INDEX idx_logs_body body TYPE tokenbf_v1(32768, 3, 0) GRANULARITY 64
) ENGINE = MergeTree
PARTITION BY toDate(timestamp)
ORDER BY (app_id, service_name, deployment_environment, timestamp, id)
TTL expires_at DELETE;
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS traces_raw (
    id String,
    app_id String,
    ingestion_key_id String,
    received_at DateTime64(3),
    expires_at DateTime64(3),
    trace_id String,
    span_id String,
    parent_span_id String,
    trace_state String,
    name String,
    kind UInt8,
    start_time DateTime64(3),
    end_time DateTime64(3),
    duration_ns Int64,
    status_code UInt8,
    status_message String,
    resource_attributes Map(String, String),
    scope_attributes Map(String, String),
    span_attributes Map(String, String),
    resource_schema_url String,
    scope_name LowCardinality(String),
    scope_version LowCardinality(String),
    scope_schema_url String,
    events_json String,
    links_json String,
    service_name LowCardinality(String),
    deployment_environment LowCardinality(String),
    INDEX idx_traces_trace_id trace_id TYPE bloom_filter(0.001) GRANULARITY 4,
    INDEX idx_traces_span_id span_id TYPE bloom_filter(0.001) GRANULARITY 4,
    INDEX idx_traces_parent_span_id parent_span_id TYPE bloom_filter(0.001) GRANULARITY 4
) ENGINE = MergeTree
PARTITION BY toDate(start_time)
ORDER BY (app_id, service_name, deployment_environment, start_time, trace_id, span_id)
TTL expires_at DELETE;
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS metrics_raw (
    id String,
    app_id String,
    ingestion_key_id String,
    received_at DateTime64(3),
    expires_at DateTime64(3),
    entity_kind LowCardinality(String) DEFAULT 'application',
    host_id String DEFAULT '',
    host_name LowCardinality(String) DEFAULT '',
    host_arch LowCardinality(String) DEFAULT '',
    os_type LowCardinality(String) DEFAULT '',
    container_id String DEFAULT '',
    container_name LowCardinality(String) DEFAULT '',
    container_image_name LowCardinality(String) DEFAULT '',
    metric_name LowCardinality(String),
    metric_type LowCardinality(String),
    metric_unit LowCardinality(String),
    description String,
    service_name LowCardinality(String),
    deployment_environment LowCardinality(String),
    resource_attributes Map(String, String),
    scope_name LowCardinality(String),
    scope_version LowCardinality(String),
    attributes Map(String, String),
    start_time DateTime64(3),
    time DateTime64(3),
    value_int Nullable(Int64),
    value_double Nullable(Float64),
    aggregation_temporality LowCardinality(String),
    is_monotonic Bool,
    histogram_count Nullable(UInt64),
    histogram_sum Nullable(Float64),
    histogram_min Nullable(Float64),
    histogram_max Nullable(Float64),
    histogram_bucket_counts Array(UInt64),
    histogram_explicit_bounds Array(Float64),
    exemplars_json String,
    flags UInt32,
    INDEX idx_metrics_name metric_name TYPE bloom_filter(0.001) GRANULARITY 4,
    INDEX idx_metrics_host_id host_id TYPE bloom_filter(0.001) GRANULARITY 4,
    INDEX idx_metrics_host_name host_name TYPE bloom_filter(0.001) GRANULARITY 4,
    INDEX idx_metrics_container_id container_id TYPE bloom_filter(0.001) GRANULARITY 4
) ENGINE = MergeTree
PARTITION BY toDate(time)
ORDER BY (app_id, service_name, metric_name, time, id)
TTL expires_at DELETE;
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS heartbeat_checkins (
    id String,
    app_id String,
    heartbeat_monitor_id String,
    checked_in_at DateTime64(3),
    INDEX idx_heartbeat_checkins_monitor_id heartbeat_monitor_id TYPE bloom_filter(0.001) GRANULARITY 4
) ENGINE = MergeTree
PARTITION BY toDate(checked_in_at)
ORDER BY (app_id, heartbeat_monitor_id, checked_in_at, id);
-- statement-breakpoint
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

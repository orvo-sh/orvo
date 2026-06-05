DROP TABLE IF EXISTS logs_raw;
-- statement-breakpoint
DROP TABLE IF EXISTS traces_raw;
-- statement-breakpoint
DROP TABLE IF EXISTS metrics_raw;
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS logs_raw (
    id String,
    app_id String,
    ingestion_key_id String,
    received_at DateTime64 (3),
    expires_at DateTime64 (3),
    timestamp DateTime64 (3),
    observed_timestamp DateTime64 (3),
    severity_number UInt8,
    severity_text LowCardinality (String),
    body String,
    trace_id String,
    span_id String,
    trace_flags UInt32,
    resource_attributes Map (String, String),
    resource_schema_url String,
    scope_name LowCardinality (String),
    scope_version LowCardinality (String),
    scope_attributes Map (String, String),
    scope_schema_url String,
    log_attributes Map (String, String),
    service_name LowCardinality (String),
    deployment_environment LowCardinality (String),
    INDEX idx_logs_trace_id trace_id TYPE bloom_filter (0.001) GRANULARITY 4,
    INDEX idx_logs_span_id span_id TYPE bloom_filter (0.001) GRANULARITY 4,
    INDEX idx_logs_body body TYPE tokenbf_v1 (32768, 3, 0) GRANULARITY 64
) ENGINE = MergeTree
PARTITION BY
    toDate (timestamp)
ORDER BY (
        app_id, service_name, deployment_environment, timestamp, id
    ) TTL expires_at DELETE
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS traces_raw (
    id String, app_id String, ingestion_key_id String, received_at DateTime64 (3), expires_at DateTime64 (3), trace_id String, span_id String, parent_span_id String, trace_state String, name String, kind UInt8, start_time DateTime64 (3), end_time DateTime64 (3), duration_ns Int64, status_code UInt8, status_message String, resource_attributes Map (String, String), scope_attributes Map (String, String), span_attributes Map (String, String), resource_schema_url String, scope_name LowCardinality (String), scope_version LowCardinality (String), scope_schema_url String, events_json String, links_json String, service_name LowCardinality (String), deployment_environment LowCardinality (String), INDEX idx_traces_trace_id trace_id TYPE bloom_filter (0.001) GRANULARITY 4, INDEX idx_traces_span_id span_id TYPE bloom_filter (0.001) GRANULARITY 4, INDEX idx_traces_parent_span_id parent_span_id TYPE bloom_filter (0.001) GRANULARITY 4
) ENGINE = MergeTree
PARTITION BY
    toDate (start_time)
ORDER BY (
        app_id, service_name, deployment_environment, start_time, trace_id, span_id
    ) TTL expires_at DELETE
-- statement-breakpoint
CREATE TABLE IF NOT EXISTS metrics_raw (
    id String, app_id String, ingestion_key_id String, received_at DateTime64 (3), expires_at DateTime64 (3), metric_name LowCardinality (String), metric_type LowCardinality (String), metric_unit LowCardinality (String), description String, service_name LowCardinality (String), deployment_environment LowCardinality (String), resource_attributes Map (String, String), scope_name LowCardinality (String), scope_version LowCardinality (String), attributes Map (String, String), start_time DateTime64 (3), time DateTime64 (3), value_int Nullable (Int64), value_double Nullable (Float64), aggregation_temporality LowCardinality (String), is_monotonic Bool, histogram_count Nullable (UInt64), histogram_sum Nullable (Float64), histogram_min Nullable (Float64), histogram_max Nullable (Float64), histogram_bucket_counts Array(UInt64), histogram_explicit_bounds Array(Float64), exemplars_json String, flags UInt32, INDEX idx_metrics_name metric_name TYPE bloom_filter (0.001) GRANULARITY 4
) ENGINE = MergeTree
PARTITION BY
    toDate (time)
ORDER BY (
        app_id, service_name, metric_name, time, id
    ) TTL expires_at DELETE

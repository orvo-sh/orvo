CREATE TABLE IF NOT EXISTS heartbeat_checkins (
    id String,
    app_id String,
    heartbeat_monitor_id String,
    heartbeat_name LowCardinality(String),
    checked_in_at DateTime64(3),
    previous_status LowCardinality(String),
    recovered Bool,
    expected_every_seconds UInt32,
    grace_seconds UInt32,
    last_check_in_at Nullable(DateTime64(3)),
    last_missed_at Nullable(DateTime64(3)),
    last_recovered_at Nullable(DateTime64(3)),
    INDEX idx_heartbeat_checkins_monitor_id heartbeat_monitor_id TYPE bloom_filter(0.001) GRANULARITY 4
) ENGINE = MergeTree
PARTITION BY toDate(checked_in_at)
ORDER BY (app_id, heartbeat_monitor_id, checked_in_at, id);

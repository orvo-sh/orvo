CREATE TABLE IF NOT EXISTS heartbeat_checkins (
    id String,
    app_id String,
    heartbeat_monitor_id String,
    checked_in_at DateTime64(3),
    INDEX idx_heartbeat_checkins_monitor_id heartbeat_monitor_id TYPE bloom_filter(0.001) GRANULARITY 4
) ENGINE = MergeTree
PARTITION BY toDate(checked_in_at)
ORDER BY (app_id, heartbeat_monitor_id, checked_in_at, id);

ALTER TABLE metrics_raw
    ADD COLUMN IF NOT EXISTS entity_kind LowCardinality(String) DEFAULT 'application'
-- statement-breakpoint
ALTER TABLE metrics_raw
    ADD COLUMN IF NOT EXISTS host_id String DEFAULT ''
-- statement-breakpoint
ALTER TABLE metrics_raw
    ADD COLUMN IF NOT EXISTS host_name LowCardinality(String) DEFAULT ''
-- statement-breakpoint
ALTER TABLE metrics_raw
    ADD COLUMN IF NOT EXISTS host_arch LowCardinality(String) DEFAULT ''
-- statement-breakpoint
ALTER TABLE metrics_raw
    ADD COLUMN IF NOT EXISTS os_type LowCardinality(String) DEFAULT ''
-- statement-breakpoint
ALTER TABLE metrics_raw
    ADD COLUMN IF NOT EXISTS container_id String DEFAULT ''
-- statement-breakpoint
ALTER TABLE metrics_raw
    ADD COLUMN IF NOT EXISTS container_name LowCardinality(String) DEFAULT ''
-- statement-breakpoint
ALTER TABLE metrics_raw
    ADD COLUMN IF NOT EXISTS container_image_name LowCardinality(String) DEFAULT ''
-- statement-breakpoint
ALTER TABLE metrics_raw
    ADD INDEX IF NOT EXISTS idx_metrics_host_id host_id TYPE bloom_filter(0.001) GRANULARITY 4
-- statement-breakpoint
ALTER TABLE metrics_raw
    ADD INDEX IF NOT EXISTS idx_metrics_host_name host_name TYPE bloom_filter(0.001) GRANULARITY 4
-- statement-breakpoint
ALTER TABLE metrics_raw
    ADD INDEX IF NOT EXISTS idx_metrics_container_id container_id TYPE bloom_filter(0.001) GRANULARITY 4

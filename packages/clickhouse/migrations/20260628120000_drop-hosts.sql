ALTER TABLE metrics_raw
    DROP INDEX IF EXISTS idx_metrics_host_id
-- statement-breakpoint
ALTER TABLE metrics_raw
    DROP INDEX IF EXISTS idx_metrics_host_name
-- statement-breakpoint
ALTER TABLE metrics_raw
    DROP COLUMN IF EXISTS host_id
-- statement-breakpoint
ALTER TABLE metrics_raw
    DROP COLUMN IF EXISTS host_name
-- statement-breakpoint
ALTER TABLE metrics_raw
    DROP COLUMN IF EXISTS host_arch
-- statement-breakpoint
ALTER TABLE metrics_raw
    DROP COLUMN IF EXISTS os_type

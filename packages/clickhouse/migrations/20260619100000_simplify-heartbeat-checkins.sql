ALTER TABLE heartbeat_checkins DROP COLUMN IF EXISTS heartbeat_name;
-- statement-breakpoint
ALTER TABLE heartbeat_checkins DROP COLUMN IF EXISTS previous_status;
-- statement-breakpoint
ALTER TABLE heartbeat_checkins DROP COLUMN IF EXISTS recovered;
-- statement-breakpoint
ALTER TABLE heartbeat_checkins DROP COLUMN IF EXISTS expected_every_seconds;
-- statement-breakpoint
ALTER TABLE heartbeat_checkins DROP COLUMN IF EXISTS grace_seconds;
-- statement-breakpoint
ALTER TABLE heartbeat_checkins DROP COLUMN IF EXISTS last_check_in_at;
-- statement-breakpoint
ALTER TABLE heartbeat_checkins DROP COLUMN IF EXISTS last_missed_at;
-- statement-breakpoint
ALTER TABLE heartbeat_checkins DROP COLUMN IF EXISTS last_recovered_at;

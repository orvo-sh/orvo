ALTER TABLE logs_raw
    DROP COLUMN IF EXISTS content_type,
    DROP COLUMN IF EXISTS content_encoding,
    DROP COLUMN IF EXISTS remote_addr,
    DROP COLUMN IF EXISTS user_agent;

ALTER TABLE traces_raw
    DROP COLUMN IF EXISTS content_type,
    DROP COLUMN IF EXISTS content_encoding,
    DROP COLUMN IF EXISTS remote_addr,
    DROP COLUMN IF EXISTS user_agent;

ALTER TABLE metrics_raw
    DROP COLUMN IF EXISTS content_type,
    DROP COLUMN IF EXISTS content_encoding,
    DROP COLUMN IF EXISTS remote_addr,
    DROP COLUMN IF EXISTS user_agent;

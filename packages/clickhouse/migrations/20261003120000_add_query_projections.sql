ALTER TABLE logs_raw
ADD PROJECTION IF NOT EXISTS logs_by_app_time
(
    SELECT *
    ORDER BY (app_id, timestamp, id)
);
-- statement-breakpoint
ALTER TABLE traces_raw
ADD PROJECTION IF NOT EXISTS traces_by_app_time
(
    SELECT *
    ORDER BY (app_id, start_time, trace_id, span_id)
);
-- statement-breakpoint
ALTER TABLE metrics_raw
ADD PROJECTION IF NOT EXISTS metrics_by_app_time
(
    SELECT *
    ORDER BY (app_id, time, metric_name, id)
);
-- statement-breakpoint
ALTER TABLE metrics_raw
ADD PROJECTION IF NOT EXISTS metrics_by_host
(
    SELECT *
    ORDER BY (app_id, entity_kind, host_id, metric_name, time, id)
);
-- statement-breakpoint
ALTER TABLE logs_raw MATERIALIZE PROJECTION logs_by_app_time;
-- statement-breakpoint
ALTER TABLE traces_raw MATERIALIZE PROJECTION traces_by_app_time;
-- statement-breakpoint
ALTER TABLE metrics_raw MATERIALIZE PROJECTION metrics_by_app_time;
-- statement-breakpoint
ALTER TABLE metrics_raw MATERIALIZE PROJECTION metrics_by_host;

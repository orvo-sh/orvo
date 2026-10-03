ALTER TABLE traces_raw
ADD PROJECTION IF NOT EXISTS traces_by_app_trace
(
    SELECT *
    ORDER BY (app_id, trace_id, start_time, span_id)
);
-- statement-breakpoint
ALTER TABLE traces_raw MATERIALIZE PROJECTION traces_by_app_trace;

package chdb

import (
	"context"
	"fmt"
)

const insertTracesRaw = `
INSERT INTO traces_raw (
  id,
  app_id,
  ingestion_key_id,
  received_at,
  expires_at,
  trace_id,
  span_id,
  parent_span_id,
  trace_state,
  name,
  kind,
  start_time,
  end_time,
  duration_ns,
  status_code,
  status_message,
  resource_attributes,
  scope_attributes,
  span_attributes,
  resource_schema_url,
  scope_name,
  scope_version,
  scope_schema_url,
  events_json,
  links_json,
  service_name,
  deployment_environment
)
`

func (q *Queries) InsertTracesRaw(ctx context.Context, arg []InsertTracesRawParams) error {
	if len(arg) == 0 {
		return nil
	}

	batch, err := q.db.PrepareBatch(ctx, insertTracesRaw)
	if err != nil {
		return fmt.Errorf("clickhouse: prepare traces batch: %w", err)
	}

	for _, params := range arg {
		if err := batch.Append(
			params.ID,
			params.AppID,
			params.IngestionKeyID,
			params.ReceivedAt,
			params.ExpiresAt,
			params.TraceID,
			params.SpanID,
			params.ParentSpanID,
			params.TraceState,
			params.Name,
			params.Kind,
			params.StartTime,
			params.EndTime,
			params.DurationNs,
			params.StatusCode,
			params.StatusMessage,
			params.ResourceAttributes,
			params.ScopeAttributes,
			params.SpanAttributes,
			params.ResourceSchemaURL,
			params.ScopeName,
			params.ScopeVersion,
			params.ScopeSchemaURL,
			params.EventsJSON,
			params.LinksJSON,
			params.ServiceName,
			params.DeploymentEnvironment,
		); err != nil {
			return fmt.Errorf("clickhouse: append trace row: %w", err)
		}
	}

	if err := batch.Send(); err != nil {
		return fmt.Errorf("clickhouse: send traces batch: %w", err)
	}

	return nil
}

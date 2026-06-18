package chdb

import (
	"context"
	"fmt"
)

const insertLogsRaw = `
INSERT INTO logs_raw (
  id,
  app_id,
  ingestion_key_id,
  received_at,
  expires_at,
  timestamp,
  observed_timestamp,
  severity_number,
  severity_text,
  body,
  trace_id,
  span_id,
  trace_flags,
  resource_attributes,
  resource_schema_url,
  scope_name,
  scope_version,
  scope_attributes,
  scope_schema_url,
  log_attributes,
  service_name,
  deployment_environment
)
`

func (q *Queries) InsertLogsRaw(ctx context.Context, arg []InsertLogsRawParams) error {
	if len(arg) == 0 {
		return nil
	}

	batch, err := q.db.PrepareBatch(ctx, insertLogsRaw)
	if err != nil {
		return fmt.Errorf("clickhouse: prepare logs batch: %w", err)
	}

	for _, params := range arg {
		if err := batch.Append(
			params.ID,
			params.AppID,
			params.IngestionKeyID,
			params.ReceivedAt,
			params.ExpiresAt,
			params.Timestamp,
			params.ObservedTimestamp,
			params.SeverityNumber,
			params.SeverityText,
			params.Body,
			params.TraceID,
			params.SpanID,
			params.TraceFlags,
			params.ResourceAttributes,
			params.ResourceSchemaURL,
			params.ScopeName,
			params.ScopeVersion,
			params.ScopeAttributes,
			params.ScopeSchemaURL,
			params.LogAttributes,
			params.ServiceName,
			params.DeploymentEnvironment,
		); err != nil {
			return fmt.Errorf("clickhouse: append log row: %w", err)
		}
	}

	if err := batch.Send(); err != nil {
		return fmt.Errorf("clickhouse: send logs batch: %w", err)
	}

	return nil
}

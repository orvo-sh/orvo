package clickhouse

import (
	"context"
	"fmt"
	"time"

	ch "github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"

	"github.com/orvo-sh/orvo/apps/telemetry-writer/internal/config"
	"github.com/orvo-sh/orvo/apps/telemetry-writer/internal/telemetry"
)

type Client struct {
	conn driver.Conn
}

func New(ctx context.Context, cfg config.ClickHouseConfig) (*Client, error) {
	options, err := ch.ParseDSN(cfg.URL)
	if err != nil {
		return nil, fmt.Errorf("clickhouse: parse dsn: %w", err)
	}

	conn, err := ch.Open(options)
	if err != nil {
		return nil, fmt.Errorf("clickhouse: open connection: %w", err)
	}

	if err := conn.Ping(ctx); err != nil {
		return nil, fmt.Errorf("clickhouse: ping failed: %w", err)
	}

	return &Client{conn: conn}, nil
}

func (client *Client) Close() error {
	return client.conn.Close()
}

func (client *Client) InsertLogs(ctx context.Context, rows []telemetry.LogRow) error {
	batch, err := client.conn.PrepareBatch(ctx, `
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
	`)
	if err != nil {
		return fmt.Errorf("clickhouse: prepare logs batch: %w", err)
	}

	for _, row := range rows {
		if err := batch.Append(
			row.ID,
			row.AppID,
			row.IngestionKeyID,
			row.ReceivedAt,
			row.ExpiresAt,
			row.Timestamp,
			row.ObservedTimestamp,
			row.SeverityNumber,
			row.SeverityText,
			row.Body,
			row.TraceID,
			row.SpanID,
			row.TraceFlags,
			row.ResourceAttributes,
			row.ResourceSchemaURL,
			row.ScopeName,
			row.ScopeVersion,
			row.ScopeAttributes,
			row.ScopeSchemaURL,
			row.LogAttributes,
			row.ServiceName,
			row.DeploymentEnvironment,
		); err != nil {
			return fmt.Errorf("clickhouse: append log row: %w", err)
		}
	}

	if err := batch.Send(); err != nil {
		return fmt.Errorf("clickhouse: send logs batch: %w", err)
	}
	return nil
}

func (client *Client) InsertTraces(ctx context.Context, rows []telemetry.TraceRow) error {
	batch, err := client.conn.PrepareBatch(ctx, `
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
	`)
	if err != nil {
		return fmt.Errorf("clickhouse: prepare traces batch: %w", err)
	}

	for _, row := range rows {
		if err := batch.Append(
			row.ID,
			row.AppID,
			row.IngestionKeyID,
			row.ReceivedAt,
			row.ExpiresAt,
			row.TraceID,
			row.SpanID,
			row.ParentSpanID,
			row.TraceState,
			row.Name,
			row.Kind,
			row.StartTime,
			row.EndTime,
			row.DurationNs,
			row.StatusCode,
			row.StatusMessage,
			row.ResourceAttributes,
			row.ScopeAttributes,
			row.SpanAttributes,
			row.ResourceSchemaURL,
			row.ScopeName,
			row.ScopeVersion,
			row.ScopeSchemaURL,
			row.EventsJSON,
			row.LinksJSON,
			row.ServiceName,
			row.DeploymentEnvironment,
		); err != nil {
			return fmt.Errorf("clickhouse: append trace row: %w", err)
		}
	}

	if err := batch.Send(); err != nil {
		return fmt.Errorf("clickhouse: send traces batch: %w", err)
	}
	return nil
}

func (client *Client) InsertMetrics(ctx context.Context, rows []telemetry.MetricRow) error {
	batch, err := client.conn.PrepareBatch(ctx, `
		INSERT INTO metrics_raw (
			id,
			app_id,
			ingestion_key_id,
			received_at,
			expires_at,
			metric_name,
			metric_type,
			metric_unit,
			description,
			service_name,
			deployment_environment,
			resource_attributes,
			scope_name,
			scope_version,
			attributes,
			start_time,
			time,
			value_int,
			value_double,
			aggregation_temporality,
			is_monotonic,
			histogram_count,
			histogram_sum,
			histogram_min,
			histogram_max,
			histogram_bucket_counts,
			histogram_explicit_bounds,
			exemplars_json,
			flags
		)
	`)
	if err != nil {
		return fmt.Errorf("clickhouse: prepare metrics batch: %w", err)
	}

	for _, row := range rows {
		if err := batch.Append(
			row.ID,
			row.AppID,
			row.IngestionKeyID,
			row.ReceivedAt,
			row.ExpiresAt,
			row.MetricName,
			row.MetricType,
			row.MetricUnit,
			row.Description,
			row.ServiceName,
			row.DeploymentEnvironment,
			row.ResourceAttributes,
			row.ScopeName,
			row.ScopeVersion,
			row.Attributes,
			row.StartTime,
			row.Time,
			row.ValueInt,
			row.ValueDouble,
			row.AggregationTemporality,
			row.IsMonotonic,
			row.HistogramCount,
			row.HistogramSum,
			row.HistogramMin,
			row.HistogramMax,
			row.HistogramBucketCounts,
			row.HistogramExplicitBounds,
			row.ExemplarsJSON,
			row.Flags,
		); err != nil {
			return fmt.Errorf("clickhouse: append metric row: %w", err)
		}
	}

	if err := batch.Send(); err != nil {
		return fmt.Errorf("clickhouse: send metrics batch: %w", err)
	}
	return nil
}

func Truncate(value time.Time) time.Time {
	return value.UTC().Truncate(time.Millisecond)
}

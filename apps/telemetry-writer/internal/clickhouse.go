package writer

import (
	"context"
	"fmt"

	clickhouse "github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
)

type ClickHouse struct {
	conn driver.Conn
}

func NewClickHouse(ctx context.Context, config ClickHouseConfig) (*ClickHouse, error) {
	options, err := clickhouse.ParseDSN(config.URL)
	if err != nil {
		return nil, fmt.Errorf("clickhouse: parse dsn: %w", err)
	}

	conn, err := clickhouse.Open(options)
	if err != nil {
		return nil, fmt.Errorf("clickhouse: open connection: %w", err)
	}

	if err := conn.Ping(ctx); err != nil {
		return nil, fmt.Errorf("clickhouse: ping failed: %w", err)
	}

	return &ClickHouse{conn: conn}, nil
}

func (db *ClickHouse) Close() error {
	return db.conn.Close()
}

func (db *ClickHouse) InsertLogs(ctx context.Context, rows []LogRow) error {
	batch, err := db.conn.PrepareBatch(ctx, "INSERT INTO logs_raw")
	if err != nil {
		return fmt.Errorf("clickhouse: prepare logs batch: %w", err)
	}

	for _, row := range rows {
		if err := batch.Append(
			row.ID,
			row.OrganizationID,
			row.APIKeyID,
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
			row.ContentType,
			row.ContentEncoding,
			row.RemoteAddr,
			row.UserAgent,
		); err != nil {
			return fmt.Errorf("clickhouse: append log row: %w", err)
		}
	}

	if err := batch.Send(); err != nil {
		return fmt.Errorf("clickhouse: send logs batch: %w", err)
	}

	return nil
}

func (db *ClickHouse) InsertTraces(ctx context.Context, rows []TraceRow) error {
	batch, err := db.conn.PrepareBatch(ctx, "INSERT INTO traces_raw")
	if err != nil {
		return fmt.Errorf("clickhouse: prepare traces batch: %w", err)
	}

	for _, row := range rows {
		if err := batch.Append(
			row.ID,
			row.OrganizationID,
			row.APIKeyID,
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
			row.ContentType,
			row.ContentEncoding,
			row.RemoteAddr,
			row.UserAgent,
		); err != nil {
			return fmt.Errorf("clickhouse: append trace row: %w", err)
		}
	}

	if err := batch.Send(); err != nil {
		return fmt.Errorf("clickhouse: send traces batch: %w", err)
	}

	return nil
}

func (db *ClickHouse) InsertMetrics(ctx context.Context, rows []MetricRow) error {
	batch, err := db.conn.PrepareBatch(ctx, "INSERT INTO metrics_raw")
	if err != nil {
		return fmt.Errorf("clickhouse: prepare metrics batch: %w", err)
	}

	for _, row := range rows {
		if err := batch.Append(
			row.ID,
			row.OrganizationID,
			row.APIKeyID,
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
			row.ContentType,
			row.ContentEncoding,
			row.RemoteAddr,
			row.UserAgent,
		); err != nil {
			return fmt.Errorf("clickhouse: append metric row: %w", err)
		}
	}

	if err := batch.Send(); err != nil {
		return fmt.Errorf("clickhouse: send metrics batch: %w", err)
	}

	return nil
}

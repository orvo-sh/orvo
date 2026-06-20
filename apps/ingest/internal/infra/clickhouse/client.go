package clickhouse

import (
	"context"
	"fmt"

	ch "github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"go.opentelemetry.io/otel"
	semconv "go.opentelemetry.io/otel/semconv/v1.34.0"
	"go.opentelemetry.io/otel/trace"

	"github.com/orvo-sh/orvo/apps/ingest/internal/infra/clickhouse/db"
)

type Client struct {
	conn    driver.Conn
	queries *chdb.Queries
	tracer  trace.Tracer
}

func New(ctx context.Context, url string) (*Client, error) {
	options, err := ch.ParseDSN(url)
	if err != nil {
		return nil, fmt.Errorf("clickhouse: parse dsn: %w", err)
	}

	conn, err := ch.Open(options)
	if err != nil {
		return nil, fmt.Errorf("clickhouse: open connection: %w", err)
	}

	if err := conn.Ping(ctx); err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("clickhouse: ping failed: %w", err)
	}

	return &Client{
		conn:    conn,
		queries: chdb.New(conn),
		tracer:  otel.Tracer("github.com/orvo-sh/orvo/apps/ingest/internal/infra/clickhouse"),
	}, nil
}

func (client *Client) Queries() *chdb.Queries {
	return client.queries
}

func (client *Client) Ping(ctx context.Context) error {
	if err := client.conn.Ping(ctx); err != nil {
		return fmt.Errorf("clickhouse: ping failed: %w", err)
	}

	return nil
}

func (client *Client) Close() error {
	return client.conn.Close()
}

func (client *Client) InsertHeartbeatCheckIns(ctx context.Context, rows []chdb.InsertHeartbeatCheckInsParams) error {
	ctx, span := client.startSpan(ctx, "clickhouse.insert_heartbeat_checkins", "heartbeat_checkins", len(rows))
	defer span.End()

	return client.queries.InsertHeartbeatCheckIns(client.queryContext(ctx), rows)
}

func (client *Client) InsertLogsRaw(ctx context.Context, rows []chdb.InsertLogsRawParams) error {
	ctx, span := client.startSpan(ctx, "clickhouse.insert_logs_raw", "logs_raw", len(rows))
	defer span.End()

	return client.queries.InsertLogsRaw(client.queryContext(ctx), rows)
}

func (client *Client) InsertMetricsRaw(ctx context.Context, rows []chdb.InsertMetricsRawParams) error {
	ctx, span := client.startSpan(ctx, "clickhouse.insert_metrics_raw", "metrics_raw", len(rows))
	defer span.End()

	return client.queries.InsertMetricsRaw(client.queryContext(ctx), rows)
}

func (client *Client) InsertTracesRaw(ctx context.Context, rows []chdb.InsertTracesRawParams) error {
	ctx, span := client.startSpan(ctx, "clickhouse.insert_traces_raw", "traces_raw", len(rows))
	defer span.End()

	return client.queries.InsertTracesRaw(client.queryContext(ctx), rows)
}

func (client *Client) queryContext(ctx context.Context) context.Context {
	spanContext := trace.SpanContextFromContext(ctx)
	if !spanContext.IsValid() {
		return ctx
	}

	return ch.Context(ctx, ch.WithSpan(spanContext))
}

func (client *Client) startSpan(ctx context.Context, name string, table string, rowCount int) (context.Context, trace.Span) {
	return client.tracer.Start(ctx, name, trace.WithSpanKind(trace.SpanKindClient), trace.WithAttributes(
		semconv.DBSystemNameClickHouse,
		semconv.DBOperationName("INSERT"),
		semconv.DBCollectionName(table),
		semconv.DBQuerySummary("INSERT INTO "+table),
		semconv.DBOperationBatchSize(rowCount),
	))
}

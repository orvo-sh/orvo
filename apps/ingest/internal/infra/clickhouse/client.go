package clickhouse

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	ch "github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"go.opentelemetry.io/otel"
	semconv "go.opentelemetry.io/otel/semconv/v1.34.0"
	"go.opentelemetry.io/otel/trace"

	"github.com/orvo-sh/orvo/apps/ingest/internal/infra/clickhouse/db"
)

type Client struct {
	conn       driver.Conn
	queries    *chdb.Queries
	tracer     trace.Tracer
	httpURL    string
	httpClient *http.Client
}

func NewHTTPBridge(ctx context.Context, baseURL string) (*Client, error) {
	client := &Client{
		httpURL:    strings.TrimRight(baseURL, "/"),
		httpClient: http.DefaultClient,
		tracer:     otel.Tracer("github.com/orvo-sh/orvo/apps/ingest/internal/infra/clickhouse"),
	}
	if err := client.Ping(ctx); err != nil {
		return nil, err
	}
	return client, nil
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
	if client.httpURL != "" {
		request, err := http.NewRequestWithContext(ctx, http.MethodPost, client.httpURL, strings.NewReader("SELECT 1"))
		if err != nil {
			return fmt.Errorf("clickhouse: create bridge ping request: %w", err)
		}
		response, err := client.httpClient.Do(request)
		if err != nil {
			return fmt.Errorf("clickhouse: bridge ping failed: %w", err)
		}
		defer response.Body.Close()
		if response.StatusCode != http.StatusOK {
			return fmt.Errorf("clickhouse: bridge ping failed with %s", response.Status)
		}
		return nil
	}
	if err := client.conn.Ping(ctx); err != nil {
		return fmt.Errorf("clickhouse: ping failed: %w", err)
	}

	return nil
}

func (client *Client) Close() error {
	if client.conn == nil {
		return nil
	}
	return client.conn.Close()
}

func (client *Client) InsertHeartbeatCheckIns(ctx context.Context, rows []chdb.InsertHeartbeatCheckInsParams) error {
	ctx, span := client.startSpan(ctx, "clickhouse.insert_heartbeat_checkins", "heartbeat_checkins", len(rows))
	defer span.End()

	if client.httpURL != "" {
		values := make([][]any, 0, len(rows))
		for _, row := range rows {
			values = append(values, []any{row.ID, row.AppID, row.HeartbeatMonitorID, row.CheckedInAt})
		}
		return client.insertHTTP(ctx, "heartbeat_checkins", values)
	}
	return client.queries.InsertHeartbeatCheckIns(client.queryContext(ctx), rows)
}

func (client *Client) InsertLogsRaw(ctx context.Context, rows []chdb.InsertLogsRawParams) error {
	ctx, span := client.startSpan(ctx, "clickhouse.insert_logs_raw", "logs_raw", len(rows))
	defer span.End()

	if client.httpURL != "" {
		values := make([][]any, 0, len(rows))
		for _, row := range rows {
			values = append(values, []any{row.ID, row.AppID, row.IngestionKeyID, row.ReceivedAt, row.ExpiresAt, row.Timestamp, row.ObservedTimestamp, row.SeverityNumber, row.SeverityText, row.Body, row.TraceID, row.SpanID, row.TraceFlags, row.ResourceAttributes, row.ResourceSchemaURL, row.ScopeName, row.ScopeVersion, row.ScopeAttributes, row.ScopeSchemaURL, row.LogAttributes, row.ServiceName, row.DeploymentEnvironment})
		}
		return client.insertHTTP(ctx, "logs_raw", values)
	}
	return client.queries.InsertLogsRaw(client.queryContext(ctx), rows)
}

func (client *Client) InsertMetricsRaw(ctx context.Context, rows []chdb.InsertMetricsRawParams) error {
	ctx, span := client.startSpan(ctx, "clickhouse.insert_metrics_raw", "metrics_raw", len(rows))
	defer span.End()

	if client.httpURL != "" {
		values := make([][]any, 0, len(rows))
		for _, row := range rows {
			values = append(values, []any{row.ID, row.AppID, row.IngestionKeyID, row.ReceivedAt, row.ExpiresAt, row.EntityKind, row.HostID, row.HostName, row.HostArch, row.OSType, row.ContainerID, row.ContainerName, row.ContainerImageName, row.MetricName, row.MetricType, row.MetricUnit, row.Description, row.ServiceName, row.DeploymentEnvironment, row.ResourceAttributes, row.ScopeName, row.ScopeVersion, row.Attributes, row.StartTime, row.Time, row.ValueInt, row.ValueDouble, row.AggregationTemporality, row.IsMonotonic, row.HistogramCount, row.HistogramSum, row.HistogramMin, row.HistogramMax, row.HistogramBucketCounts, row.HistogramExplicitBounds, row.ExemplarsJSON, row.Flags})
		}
		return client.insertHTTP(ctx, "metrics_raw", values)
	}
	return client.queries.InsertMetricsRaw(client.queryContext(ctx), rows)
}

func (client *Client) InsertTracesRaw(ctx context.Context, rows []chdb.InsertTracesRawParams) error {
	ctx, span := client.startSpan(ctx, "clickhouse.insert_traces_raw", "traces_raw", len(rows))
	defer span.End()

	if client.httpURL != "" {
		values := make([][]any, 0, len(rows))
		for _, row := range rows {
			values = append(values, []any{row.ID, row.AppID, row.IngestionKeyID, row.ReceivedAt, row.ExpiresAt, row.TraceID, row.SpanID, row.ParentSpanID, row.TraceState, row.Name, row.Kind, row.StartTime, row.EndTime, row.DurationNs, row.StatusCode, row.StatusMessage, row.ResourceAttributes, row.ScopeAttributes, row.SpanAttributes, row.ResourceSchemaURL, row.ScopeName, row.ScopeVersion, row.ScopeSchemaURL, row.EventsJSON, row.LinksJSON, row.ServiceName, row.DeploymentEnvironment})
		}
		return client.insertHTTP(ctx, "traces_raw", values)
	}
	return client.queries.InsertTracesRaw(client.queryContext(ctx), rows)
}

func (client *Client) insertHTTP(ctx context.Context, table string, rows [][]any) error {
	if len(rows) == 0 {
		return nil
	}
	var body bytes.Buffer
	encoder := json.NewEncoder(&body)
	for _, row := range rows {
		if err := encoder.Encode(row); err != nil {
			return fmt.Errorf("clickhouse: encode %s row: %w", table, err)
		}
	}
	endpoint := client.httpURL + "/?query=" + url.QueryEscape("INSERT INTO "+table+" FORMAT JSONCompactEachRow")
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, &body)
	if err != nil {
		return fmt.Errorf("clickhouse: create %s insert request: %w", table, err)
	}
	response, err := client.httpClient.Do(request)
	if err != nil {
		return fmt.Errorf("clickhouse: insert %s: %w", table, err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("clickhouse: insert %s failed with %s", table, response.Status)
	}
	return nil
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

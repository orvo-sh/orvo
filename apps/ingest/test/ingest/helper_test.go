package ingest_test

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"strconv"
	"testing"
	"time"

	collectorlogspb "go.opentelemetry.io/proto/otlp/collector/logs/v1"
	collectormetricspb "go.opentelemetry.io/proto/otlp/collector/metrics/v1"
	collectortracepb "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
	logspb "go.opentelemetry.io/proto/otlp/logs/v1"
	metricspb "go.opentelemetry.io/proto/otlp/metrics/v1"
	resourcepb "go.opentelemetry.io/proto/otlp/resource/v1"
	tracepb "go.opentelemetry.io/proto/otlp/trace/v1"
	"google.golang.org/protobuf/proto"

	chdriver "github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	chclient "github.com/orvo-sh/orvo/apps/ingest/internal/infra/clickhouse"
	pgclient "github.com/orvo-sh/orvo/apps/ingest/internal/infra/postgres"
	"github.com/orvo-sh/orvo/apps/ingest/test"
)

func withIngestFlowEnv(
	t *testing.T,
	fn func(ctx context.Context, addr string, postgresDB *pgclient.Client, clickhouseDB *chclient.Client, clickhouseRaw chdriver.Conn),
) {
	t.Helper()
	t.Setenv("TESTCONTAINERS_RYUK_DISABLED", "true")

	test.WithClickhouseDB(t, func(clickhouseDB *chclient.Client, clickhouseRaw chdriver.Conn) {
		test.WithPostgresDB(t, func(postgresDB *pgclient.Client) {
			test.WithIngestServer(t, postgresDB, clickhouseDB, clickhouseRaw, func(addr string) {
				fn(context.Background(), addr, postgresDB, clickhouseDB, clickhouseRaw)
			})
		})
	})
}

func mustMarshal(t *testing.T, message proto.Message) []byte {
	t.Helper()

	body, err := proto.Marshal(message)
	if err != nil {
		t.Fatalf("marshal protobuf: %v", err)
	}

	return body
}

func mustMarshalJSON(t *testing.T, value any) []byte {
	t.Helper()

	body, err := json.Marshal(value)
	if err != nil {
		t.Fatalf("marshal json: %v", err)
	}

	return body
}

func buildLogsRequest() *collectorlogspb.ExportLogsServiceRequest {
	now := time.Now().UTC()
	timestamp := uint64(now.UnixNano())
	observedTimestamp := uint64(now.Add(time.Second).UnixNano())

	return &collectorlogspb.ExportLogsServiceRequest{
		ResourceLogs: []*logspb.ResourceLogs{
			{
				Resource: &resourcepb.Resource{
					Attributes: []*commonpb.KeyValue{
						stringAttr("service.name", "checkout"),
						stringAttr("deployment.environment", "production"),
					},
				},
				ScopeLogs: []*logspb.ScopeLogs{
					{
						Scope: &commonpb.InstrumentationScope{
							Name:    "logger",
							Version: "1.0.0",
						},
						LogRecords: []*logspb.LogRecord{
							{
								TimeUnixNano:         timestamp,
								ObservedTimeUnixNano: observedTimestamp,
								SeverityNumber:       logspb.SeverityNumber_SEVERITY_NUMBER_INFO,
								SeverityText:         "INFO",
								Body:                 &commonpb.AnyValue{Value: &commonpb.AnyValue_StringValue{StringValue: "hello from logs"}},
								TraceId:              decodeHex("4bf92f3577b34da6a3ce929d0e0e4736"),
								SpanId:               decodeHex("00f067aa0ba902b7"),
							},
						},
					},
				},
			},
		},
	}
}

func buildLogsJSONRequest() map[string]any {
	now := time.Now().UTC()
	timestamp := strconv.FormatUint(uint64(now.UnixNano()), 10)
	observedTimestamp := strconv.FormatUint(uint64(now.Add(time.Second).UnixNano()), 10)

	return map[string]any{
		"resourceLogs": []any{
			map[string]any{
				"resource": map[string]any{
					"attributes": []any{
						map[string]any{"key": "service.name", "value": map[string]any{"stringValue": "checkout"}},
						map[string]any{"key": "deployment.environment", "value": map[string]any{"stringValue": "production"}},
					},
				},
				"scopeLogs": []any{
					map[string]any{
						"scope": map[string]any{
							"name":    "logger",
							"version": "1.0.0",
						},
						"logRecords": []any{
							map[string]any{
								"timeUnixNano":         timestamp,
								"observedTimeUnixNano": observedTimestamp,
								"severityNumber":       int(logspb.SeverityNumber_SEVERITY_NUMBER_INFO),
								"severityText":         "INFO",
								"body":                 map[string]any{"stringValue": "hello from json logs"},
								"traceId":              "4bf92f3577b34da6a3ce929d0e0e4736",
								"spanId":               "00f067aa0ba902b7",
							},
						},
					},
				},
			},
		},
	}
}

func buildTracesRequest() *collectortracepb.ExportTraceServiceRequest {
	now := time.Now().UTC()
	startTimestamp := uint64(now.UnixNano())
	endTimestamp := uint64(now.Add(5 * time.Millisecond).UnixNano())

	return &collectortracepb.ExportTraceServiceRequest{
		ResourceSpans: []*tracepb.ResourceSpans{
			{
				Resource: &resourcepb.Resource{
					Attributes: []*commonpb.KeyValue{
						stringAttr("service.name", "checkout"),
						stringAttr("deployment.environment", "production"),
					},
				},
				ScopeSpans: []*tracepb.ScopeSpans{
					{
						Scope: &commonpb.InstrumentationScope{
							Name:    "tracer",
							Version: "1.0.0",
						},
						Spans: []*tracepb.Span{
							{
								TraceId:           decodeHex("4bf92f3577b34da6a3ce929d0e0e4736"),
								SpanId:            decodeHex("00f067aa0ba902b7"),
								Name:              "GET /checkout",
								Kind:              tracepb.Span_SPAN_KIND_SERVER,
								StartTimeUnixNano: startTimestamp,
								EndTimeUnixNano:   endTimestamp,
							},
						},
					},
				},
			},
		},
	}
}

func buildTracesJSONRequest() map[string]any {
	now := time.Now().UTC()
	startTimestamp := strconv.FormatUint(uint64(now.UnixNano()), 10)
	endTimestamp := strconv.FormatUint(uint64(now.Add(5*time.Millisecond).UnixNano()), 10)

	return map[string]any{
		"resourceSpans": []any{
			map[string]any{
				"resource": map[string]any{
					"attributes": []any{
						map[string]any{"key": "service.name", "value": map[string]any{"stringValue": "checkout"}},
						map[string]any{"key": "deployment.environment", "value": map[string]any{"stringValue": "production"}},
					},
				},
				"scopeSpans": []any{
					map[string]any{
						"scope": map[string]any{
							"name":    "tracer",
							"version": "1.0.0",
						},
						"spans": []any{
							map[string]any{
								"traceId":           "4bf92f3577b34da6a3ce929d0e0e4736",
								"spanId":            "00f067aa0ba902b7",
								"name":              "GET /checkout",
								"kind":              int(tracepb.Span_SPAN_KIND_SERVER),
								"startTimeUnixNano": startTimestamp,
								"endTimeUnixNano":   endTimestamp,
							},
						},
					},
				},
			},
		},
	}
}

func buildMetricsRequest() *collectormetricspb.ExportMetricsServiceRequest {
	now := time.Now().UTC()
	timestamp := uint64(now.UnixNano())

	return &collectormetricspb.ExportMetricsServiceRequest{
		ResourceMetrics: []*metricspb.ResourceMetrics{
			{
				Resource: &resourcepb.Resource{
					Attributes: []*commonpb.KeyValue{
						stringAttr("service.name", "infra-agent"),
						stringAttr("deployment.environment", "production"),
						stringAttr("host.name", "host-1"),
						stringAttr("host.id", "host-id-1"),
					},
				},
				ScopeMetrics: []*metricspb.ScopeMetrics{
					{
						Scope: &commonpb.InstrumentationScope{
							Name:    "otel",
							Version: "1.0.0",
						},
						Metrics: []*metricspb.Metric{
							{
								Name: "system.cpu.utilization",
								Unit: "1",
								Data: &metricspb.Metric_Gauge{
									Gauge: &metricspb.Gauge{
										DataPoints: []*metricspb.NumberDataPoint{
											{
												TimeUnixNano: timestamp,
												Value:        &metricspb.NumberDataPoint_AsDouble{AsDouble: 0.42},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
	}
}

func stringAttr(key string, value string) *commonpb.KeyValue {
	return &commonpb.KeyValue{
		Key: key,
		Value: &commonpb.AnyValue{
			Value: &commonpb.AnyValue_StringValue{StringValue: value},
		},
	}
}

func decodeHex(value string) []byte {
	decoded, err := hex.DecodeString(value)
	if err != nil {
		panic(err)
	}

	return decoded
}

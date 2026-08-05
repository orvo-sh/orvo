package ingest_test

import (
	"context"
	"testing"

	chdriver "github.com/ClickHouse/clickhouse-go/v2/lib/driver"

	chclient "github.com/orvo-sh/orvo/apps/ingest/internal/infra/clickhouse"
	pgclient "github.com/orvo-sh/orvo/apps/ingest/internal/infra/postgres"
	"github.com/orvo-sh/orvo/apps/ingest/test"
)

func TestIngestTraces(t *testing.T) {
	withIngestFlowEnv(t, func(ctx context.Context, addr string, postgresDB *pgclient.Client, clickhouseDB *chclient.Client, clickhouseRaw chdriver.Conn) {
		tracesApp, err := test.SeedApp(ctx, postgresDB, test.SeedAppInput{
			Suffix:     "traces",
			Plan:       "pro",
			Status:     "active",
			LimitBytes: 1024 * 1024,
		})
		if err != nil {
			t.Fatalf("seed traces app: %v", err)
		}

		tracesBody := mustMarshal(t, buildTracesRequest())
		tracesJSONBody := mustMarshalJSON(t, buildTracesJSONRequest())

		test.Run(t, test.RunConfig{
			Addr:          addr,
			PostgresDB:    postgresDB,
			ClickhouseDB:  clickhouseDB,
			ClickhouseRaw: clickhouseRaw,
			Tests: []test.Test{
				{
					Name: "successful traces ingest",
					Input: test.HttpRequest{
						Method: "POST",
						URL:    "/v1/traces",
						Body:   tracesBody,
						Headers: map[string]string{
							"Authorization": "Bearer " + tracesApp.IngestionKey,
							"Content-Type":  "application/x-protobuf",
						},
					},
					Validators: []test.Validator{
						test.HttpStatusCodeValidator(202),
						test.PostgresDBValidator(test.NewPostgresDBValidatorInput{
							Name:  "traces usage is reserved",
							Query: "SELECT traces_ingested_bytes FROM organization_usage WHERE organization_id = $1",
							Args:  []any{tracesApp.OrganizationID},
							Expected: []test.Row{{
								"traces_ingested_bytes": int64(len(tracesBody)),
							}},
						}),
						test.PostgresDBValidator(test.NewPostgresDBValidatorInput{
							Name:  "traces first received is marked",
							Query: "SELECT COUNT(*) AS count FROM app WHERE id = $1 AND traces_first_received_at IS NOT NULL",
							Args:  []any{tracesApp.AppID},
							Expected: []test.Row{{
								"count": int64(1),
							}},
						}),
						test.EventuallyClickhouseDBValidator(test.NewClickhouseDBValidatorInput{
							Name:  "trace row is written",
							Query: "SELECT app_id, ingestion_key_id, name, service_name, duration_ns FROM traces_raw WHERE app_id = ?",
							Args:  []any{tracesApp.AppID},
							Expected: []test.Row{{
								"app_id":           tracesApp.AppID,
								"ingestion_key_id": tracesApp.IngestionKeyID,
								"name":             "GET /checkout",
								"service_name":     "checkout",
								"duration_ns":      int64(5000000),
							}},
						}),
						test.EventuallyClickhouseDBValidator(test.NewClickhouseDBValidatorInput{
							Name: "entry span is added to the minute trace metrics rollup",
							Query: `
								SELECT
									app_id,
									service_name,
									deployment_environment,
									scope_name,
									operation_name,
									toInt64(sum(request_count)) AS request_count,
									toInt64(sum(error_count)) AS error_count,
									toInt64(sum(duration_sum_ns)) AS duration_sum_ns
								FROM trace_metrics_1m
								WHERE app_id = ?
								GROUP BY
									app_id,
									service_name,
									deployment_environment,
									scope_name,
									operation_name
							`,
							Args: []any{tracesApp.AppID},
							Expected: []test.Row{{
								"app_id":                 tracesApp.AppID,
								"service_name":           "checkout",
								"deployment_environment": "production",
								"scope_name":             "tracer",
								"operation_name":         "GET /checkout",
								"request_count":          int64(1),
								"error_count":            int64(0),
								"duration_sum_ns":        int64(5000000),
							}},
						}),
					},
				},
				{
					Name: "successful json traces ingest preserves trace correlation ids",
					Input: test.HttpRequest{
						Method: "POST",
						URL:    "/v1/traces",
						Body:   tracesJSONBody,
						Headers: map[string]string{
							"Authorization": "Bearer " + tracesApp.IngestionKey,
							"Content-Type":  "application/json",
						},
					},
					Validators: []test.Validator{
						test.HttpStatusCodeValidator(202),
						test.EventuallyClickhouseDBValidator(test.NewClickhouseDBValidatorInput{
							Name:  "json trace row keeps 32-char trace id and 16-char span id",
							Query: "SELECT trace_id, span_id, name FROM traces_raw WHERE app_id = ? AND name = 'GET /checkout'",
							Args:  []any{tracesApp.AppID},
							Expected: []test.Row{{
								"trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
								"span_id":  "00f067aa0ba902b7",
								"name":     "GET /checkout",
							}},
						}),
					},
				},
			},
		})
	})
}

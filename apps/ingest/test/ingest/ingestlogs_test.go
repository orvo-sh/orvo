package ingest_test

import (
	"context"
	"testing"

	chdriver "github.com/ClickHouse/clickhouse-go/v2/lib/driver"

	chclient "github.com/orvo-sh/orvo/apps/ingest/internal/infra/clickhouse"
	pgclient "github.com/orvo-sh/orvo/apps/ingest/internal/infra/postgres"
	"github.com/orvo-sh/orvo/apps/ingest/test"
)

func TestIngestLogs(t *testing.T) {
	withIngestFlowEnv(t, func(ctx context.Context, addr string, postgresDB *pgclient.Client, clickhouseDB *chclient.Client, clickhouseRaw chdriver.Conn) {
		logsApp, err := test.SeedApp(ctx, postgresDB, test.SeedAppInput{
			Suffix:     "logs",
			Plan:       "pro",
			Status:     "active",
			LimitBytes: 1024 * 1024,
		})
		if err != nil {
			t.Fatalf("seed logs app: %v", err)
		}

		quotaApp, err := test.SeedApp(ctx, postgresDB, test.SeedAppInput{
			Suffix:     "quota",
			Plan:       "starter",
			Status:     "active",
			LimitBytes: 1,
		})
		if err != nil {
			t.Fatalf("seed quota app: %v", err)
		}

		logsBody := mustMarshal(t, buildLogsRequest())
		logsJSONBody := mustMarshalJSON(t, buildLogsJSONRequest())

		test.Run(t, test.RunConfig{
			Addr:          addr,
			PostgresDB:    postgresDB,
			ClickhouseDB:  clickhouseDB,
			ClickhouseRaw: clickhouseRaw,
			Tests: []test.Test{
				{
					Name: "successful logs ingest",
					Input: test.HttpRequest{
						Method: "POST",
						URL:    "/v1/logs",
						Body:   logsBody,
						Headers: map[string]string{
							"Authorization": "Bearer " + logsApp.IngestionKey,
							"Content-Type":  "application/x-protobuf",
						},
					},
					Validators: []test.Validator{
						test.HttpStatusCodeValidator(202),
						test.HttpHeaderExistsValidator("X-Request-Id"),
						test.PostgresDBValidator(test.NewPostgresDBValidatorInput{
							Name:  "logs usage is reserved",
							Query: "SELECT logs_ingested_bytes FROM organization_usage WHERE organization_id = $1",
							Args:  []any{logsApp.OrganizationID},
							Expected: []test.Row{{
								"logs_ingested_bytes": int64(len(logsBody)),
							}},
						}),
						test.PostgresDBValidator(test.NewPostgresDBValidatorInput{
							Name:  "logs first received is marked",
							Query: "SELECT COUNT(*) AS count FROM app WHERE id = $1 AND logs_first_received_at IS NOT NULL",
							Args:  []any{logsApp.AppID},
							Expected: []test.Row{{
								"count": int64(1),
							}},
						}),
						test.EventuallyClickhouseDBValidator(test.NewClickhouseDBValidatorInput{
							Name:  "logs row is written",
							Query: "SELECT app_id, ingestion_key_id, service_name, severity_text, body FROM logs_raw WHERE app_id = ?",
							Args:  []any{logsApp.AppID},
							Expected: []test.Row{{
								"app_id":           logsApp.AppID,
								"ingestion_key_id": logsApp.IngestionKeyID,
								"service_name":     "checkout",
								"severity_text":    "INFO",
								"body":             "hello from logs",
							}},
						}),
					},
				},
				{
					Name: "successful json logs ingest preserves trace correlation ids",
					Input: test.HttpRequest{
						Method: "POST",
						URL:    "/v1/logs",
						Body:   logsJSONBody,
						Headers: map[string]string{
							"Authorization": "Bearer " + logsApp.IngestionKey,
							"Content-Type":  "application/json",
						},
					},
					Validators: []test.Validator{
						test.HttpStatusCodeValidator(202),
						test.EventuallyClickhouseDBValidator(test.NewClickhouseDBValidatorInput{
							Name:  "json log row keeps 32-char trace id and 16-char span id",
							Query: "SELECT trace_id, span_id, body FROM logs_raw WHERE app_id = ? AND body = 'hello from json logs'",
							Args:  []any{logsApp.AppID},
							Expected: []test.Row{{
								"trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
								"span_id":  "00f067aa0ba902b7",
								"body":     "hello from json logs",
							}},
						}),
					},
				},
				{
					Name: "invalid ingestion key is rejected",
					Input: test.HttpRequest{
						Method: "POST",
						URL:    "/v1/logs",
						Body:   logsBody,
						Headers: map[string]string{
							"Authorization": "Bearer ing_test_invalid",
							"Content-Type":  "application/x-protobuf",
						},
					},
					Validators: []test.Validator{
						test.HttpStatusCodeValidator(401),
						test.HttpJsonBodyValidator("error body is returned", func(t *testing.T, body map[string]any) {
							if body["error"] != "ingestion_key_not_found" {
								t.Fatalf("expected ingestion_key_not_found, got %v", body["error"])
							}
						}),
						test.PostgresDBValidator(test.NewPostgresDBValidatorInput{
							Name:  "invalid key does not change logs usage",
							Query: "SELECT logs_ingested_bytes FROM organization_usage WHERE organization_id = $1",
							Args:  []any{quotaApp.OrganizationID},
							Expected: []test.Row{{
								"logs_ingested_bytes": int64(0),
							}},
						}),
					},
				},
				{
					Name: "starter quota exceeded is rejected",
					Input: test.HttpRequest{
						Method: "POST",
						URL:    "/v1/logs",
						Body:   logsBody,
						Headers: map[string]string{
							"Authorization": "Bearer " + quotaApp.IngestionKey,
							"Content-Type":  "application/x-protobuf",
						},
					},
					Validators: []test.Validator{
						test.HttpStatusCodeValidator(402),
						test.HttpJsonBodyValidator("quota exceeded body is returned", func(t *testing.T, body map[string]any) {
							if body["error"] != "billing_quota_exceeded" {
								t.Fatalf("expected billing_quota_exceeded, got %v", body["error"])
							}
						}),
						test.PostgresDBValidator(test.NewPostgresDBValidatorInput{
							Name:  "quota rejection leaves logs usage unchanged",
							Query: "SELECT logs_ingested_bytes FROM organization_usage WHERE organization_id = $1",
							Args:  []any{quotaApp.OrganizationID},
							Expected: []test.Row{{
								"logs_ingested_bytes": int64(0),
							}},
						}),
						test.ClickhouseDBValidator(test.NewClickhouseDBValidatorInput{
							Name:  "quota rejection writes no logs row",
							Query: "SELECT count() AS count FROM logs_raw WHERE app_id = ?",
							Args:  []any{quotaApp.AppID},
							Expected: []test.Row{{
								"count": uint64(0),
							}},
						}),
					},
				},
			},
		})
	})
}

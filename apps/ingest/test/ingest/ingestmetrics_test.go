package ingest_test

import (
	"context"
	"testing"

	chdriver "github.com/ClickHouse/clickhouse-go/v2/lib/driver"

	chclient "github.com/orvo-sh/orvo/apps/ingest/internal/infra/clickhouse"
	pgclient "github.com/orvo-sh/orvo/apps/ingest/internal/infra/postgres"
	"github.com/orvo-sh/orvo/apps/ingest/test"
)

func TestIngestMetrics(t *testing.T) {
	withIngestFlowEnv(t, func(ctx context.Context, addr string, postgresDB *pgclient.Client, clickhouseDB *chclient.Client, clickhouseRaw chdriver.Conn) {
		metricsApp, err := test.SeedApp(ctx, postgresDB, test.SeedAppInput{
			Suffix:     "metrics",
			Plan:       "pro",
			Status:     "active",
			LimitBytes: 1024 * 1024,
		})
		if err != nil {
			t.Fatalf("seed metrics app: %v", err)
		}

		metricsBody := mustMarshal(t, buildMetricsRequest())

		test.Run(t, test.RunConfig{
			Addr:          addr,
			PostgresDB:    postgresDB,
			ClickhouseDB:  clickhouseDB,
			ClickhouseRaw: clickhouseRaw,
			Tests: []test.Test{
				{
					Name: "successful metrics ingest",
					Input: test.HttpRequest{
						Method: "POST",
						URL:    "/v1/metrics",
						Body:   metricsBody,
						Headers: map[string]string{
							"Authorization": "Bearer " + metricsApp.IngestionKey,
							"Content-Type":  "application/x-protobuf",
						},
					},
					Validators: []test.Validator{
						test.HttpStatusCodeValidator(202),
						test.PostgresDBValidator(test.NewPostgresDBValidatorInput{
							Name:  "metrics usage is reserved",
							Query: "SELECT metrics_ingested_bytes FROM organization_usage WHERE organization_id = $1",
							Args:  []any{metricsApp.OrganizationID},
							Expected: []test.Row{{
								"metrics_ingested_bytes": int64(len(metricsBody)),
							}},
						}),
						test.PostgresDBValidator(test.NewPostgresDBValidatorInput{
							Name:  "metrics first received is marked",
							Query: "SELECT COUNT(*) AS count FROM app WHERE id = $1 AND metrics_first_received_at IS NOT NULL",
							Args:  []any{metricsApp.AppID},
							Expected: []test.Row{{
								"count": int64(1),
							}},
						}),
						test.EventuallyClickhouseDBValidator(test.NewClickhouseDBValidatorInput{
							Name:  "metric row is written",
							Query: "SELECT app_id, ingestion_key_id, metric_name, entity_kind, host_name, service_name FROM metrics_raw WHERE app_id = ?",
							Args:  []any{metricsApp.AppID},
							Expected: []test.Row{{
								"app_id":           metricsApp.AppID,
								"ingestion_key_id": metricsApp.IngestionKeyID,
								"metric_name":      "system.cpu.utilization",
								"entity_kind":      "host",
								"host_name":        "host-1",
								"service_name":     "infra-agent",
							}},
						}),
					},
				},
			},
		})
	})
}

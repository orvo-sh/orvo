package ingest_test

import (
	"context"
	"testing"

	chdriver "github.com/ClickHouse/clickhouse-go/v2/lib/driver"

	chclient "github.com/orvo-sh/orvo/apps/ingest/internal/infra/clickhouse"
	pgclient "github.com/orvo-sh/orvo/apps/ingest/internal/infra/postgres"
	"github.com/orvo-sh/orvo/apps/ingest/test"
)

func TestIngestHeartbeatCheckIn(t *testing.T) {
	withIngestFlowEnv(t, func(ctx context.Context, addr string, postgresDB *pgclient.Client, clickhouseDB *chclient.Client, clickhouseRaw chdriver.Conn) {
		successApp, err := test.SeedApp(ctx, postgresDB, test.SeedAppInput{
			Suffix:     "heartbeat_ok",
			Plan:       "pro",
			Status:     "active",
			LimitBytes: 1024 * 1024,
		})
		if err != nil {
			t.Fatalf("seed heartbeat success app: %v", err)
		}

		missedApp, err := test.SeedApp(ctx, postgresDB, test.SeedAppInput{
			Suffix:     "heartbeat_missed",
			Plan:       "pro",
			Status:     "active",
			LimitBytes: 1024 * 1024,
		})
		if err != nil {
			t.Fatalf("seed missed heartbeat app: %v", err)
		}

		postApp, err := test.SeedApp(ctx, postgresDB, test.SeedAppInput{
			Suffix:     "heartbeat_post",
			Plan:       "pro",
			Status:     "active",
			LimitBytes: 1024 * 1024,
		})
		if err != nil {
			t.Fatalf("seed post heartbeat app: %v", err)
		}

		successHeartbeat, err := test.SeedHeartbeat(ctx, postgresDB, test.SeedHeartbeatInput{
			Suffix:          "ok",
			AppID:           successApp.AppID,
			Status:          "never_received",
			WithDestination: false,
		})
		if err != nil {
			t.Fatalf("seed success heartbeat: %v", err)
		}

		missedHeartbeat, err := test.SeedHeartbeat(ctx, postgresDB, test.SeedHeartbeatInput{
			Suffix:           "missed",
			AppID:            missedApp.AppID,
			Status:           "missed",
			WithDestination:  true,
			WithOpenIncident: true,
		})
		if err != nil {
			t.Fatalf("seed missed heartbeat: %v", err)
		}

		postHeartbeat, err := test.SeedHeartbeat(ctx, postgresDB, test.SeedHeartbeatInput{
			Suffix:          "post",
			AppID:           postApp.AppID,
			Status:          "never_received",
			WithDestination: false,
		})
		if err != nil {
			t.Fatalf("seed post heartbeat: %v", err)
		}

		test.Run(t, test.RunConfig{
			Addr:          addr,
			PostgresDB:    postgresDB,
			ClickhouseDB:  clickhouseDB,
			ClickhouseRaw: clickhouseRaw,
			Tests: []test.Test{
				{
					Name: "successful heartbeat check-in",
					Input: test.HttpRequest{
						Method: "GET",
						URL:    "/v1/heartbeats/" + successHeartbeat.Token,
					},
					Validators: []test.Validator{
						test.HttpStatusCodeValidator(202),
						test.HttpJsonBodyValidator("heartbeat response body is returned", func(t *testing.T, body map[string]any) {
							if body["ok"] != true {
								t.Fatalf("expected ok true, got %v", body["ok"])
							}
						}),
						test.PostgresDBValidator(test.NewPostgresDBValidatorInput{
							Name:  "heartbeat monitor is marked healthy",
							Query: "SELECT status FROM heartbeat_monitor WHERE id = $1",
							Args:  []any{successHeartbeat.MonitorID},
							Expected: []test.Row{{
								"status": "healthy",
							}},
						}),
						test.EventuallyClickhouseDBValidator(test.NewClickhouseDBValidatorInput{
							Name:  "heartbeat checkin row is written",
							Query: "SELECT app_id, heartbeat_monitor_id FROM heartbeat_checkins WHERE heartbeat_monitor_id = ?",
							Args:  []any{successHeartbeat.MonitorID},
							Expected: []test.Row{{
								"app_id":               successApp.AppID,
								"heartbeat_monitor_id": successHeartbeat.MonitorID,
							}},
						}),
					},
				},
				{
					Name: "missed heartbeat check-in resolves its incident",
					Input: test.HttpRequest{
						Method: "GET",
						URL:    "/v1/heartbeats/" + missedHeartbeat.Token,
					},
					Validators: []test.Validator{
						test.HttpStatusCodeValidator(202),
						test.PostgresDBValidator(test.NewPostgresDBValidatorInput{
							Name:  "heartbeat monitor is marked healthy",
							Query: "SELECT status FROM heartbeat_monitor WHERE id = $1",
							Args:  []any{missedHeartbeat.MonitorID},
							Expected: []test.Row{{
								"status": "healthy",
							}},
						}),
						test.PostgresDBValidator(test.NewPostgresDBValidatorInput{
							Name:  "heartbeat incident is resolved",
							Query: "SELECT status FROM incident WHERE id = $1",
							Args:  []any{missedHeartbeat.IncidentID},
							Expected: []test.Row{{
								"status": "resolved",
							}},
						}),
						test.PostgresDBValidator(test.NewPostgresDBValidatorInput{
							Name:  "heartbeat recovery events are recorded",
							Query: "SELECT event_type FROM incident_event WHERE incident_id = $1 ORDER BY occurred_at, event_type",
							Args:  []any{missedHeartbeat.IncidentID},
							Expected: []test.Row{
								{"event_type": "incident.resolved"},
								{"event_type": "heartbeat.recovered"},
							},
						}),
						test.PostgresDBValidator(test.NewPostgresDBValidatorInput{
							Name:  "heartbeat recovery notification is queued",
							Query: "SELECT event_type, status FROM notification_delivery WHERE source_id = $1",
							Args:  []any{missedHeartbeat.MonitorID},
							Expected: []test.Row{{
								"event_type": "heartbeat.recovered",
								"status":     "pending",
							}},
						}),
						test.EventuallyClickhouseDBValidator(test.NewClickhouseDBValidatorInput{
							Name:  "missed heartbeat checkin row is written",
							Query: "SELECT app_id, heartbeat_monitor_id FROM heartbeat_checkins WHERE heartbeat_monitor_id = ?",
							Args:  []any{missedHeartbeat.MonitorID},
							Expected: []test.Row{{
								"app_id":               missedApp.AppID,
								"heartbeat_monitor_id": missedHeartbeat.MonitorID,
							}},
						}),
					},
				},
				{
					Name: "post heartbeat check-in is accepted",
					Input: test.HttpRequest{
						Method: "POST",
						URL:    "/v1/heartbeats/" + postHeartbeat.Token,
					},
					Validators: []test.Validator{
						test.HttpStatusCodeValidator(202),
						test.EventuallyClickhouseDBValidator(test.NewClickhouseDBValidatorInput{
							Name:  "post heartbeat checkin row is written",
							Query: "SELECT app_id, heartbeat_monitor_id FROM heartbeat_checkins WHERE heartbeat_monitor_id = ?",
							Args:  []any{postHeartbeat.MonitorID},
							Expected: []test.Row{{
								"app_id":               postApp.AppID,
								"heartbeat_monitor_id": postHeartbeat.MonitorID,
							}},
						}),
					},
				},
				{
					Name: "unknown heartbeat token is rejected",
					Input: test.HttpRequest{
						Method: "GET",
						URL:    "/v1/heartbeats/hb_token_missing",
					},
					Validators: []test.Validator{
						test.HttpStatusCodeValidator(404),
						test.HttpJsonBodyValidator("not found body is returned", func(t *testing.T, body map[string]any) {
							if body["error"] != "heartbeat_monitor_not_found" {
								t.Fatalf("expected heartbeat_monitor_not_found, got %v", body["error"])
							}
						}),
					},
				},
			},
		})
	})
}

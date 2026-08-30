package test

import (
	"context"
	"fmt"
	"time"

	pgclient "github.com/orvo-sh/orvo/apps/ingest/internal/infra/postgres"
)

type SeedAppInput struct {
	Suffix                   string
	Plan                     string
	Status                   string
	LimitBytes               int64
	PeriodEnd                time.Time
	IngestOverageEnabled     bool
	IngestOverageBudgetCents *int32
}

type SeededApp struct {
	OrganizationID string
	AppID          string
	IngestionKeyID string
	IngestionKey   string
}

func SeedApp(ctx context.Context, postgresDB *pgclient.Client, input SeedAppInput) (*SeededApp, error) {
	now := time.Now().UTC()

	organizationID := fmt.Sprintf("org_%s", input.Suffix)
	appID := fmt.Sprintf("app_%s", input.Suffix)
	ingestionKeyID := fmt.Sprintf("ingk_%s", input.Suffix)
	ingestionKey := fmt.Sprintf("ing_test_%s", input.Suffix)
	usageID := fmt.Sprintf("orgu_%s", input.Suffix)
	periodEnd := input.PeriodEnd
	if periodEnd.IsZero() {
		periodEnd = now.Add(30 * 24 * time.Hour)
	}

	if _, err := postgresDB.Pool().Exec(ctx, `
		INSERT INTO organization (id, name, slug, billing_plan, billing_status, created_at, updated_at)
		VALUES ($1, $2, $3, $4::billing_plan, $5::billing_status, $6, $6)
	`, organizationID, "Test org "+input.Suffix, "test-org-"+input.Suffix, input.Plan, input.Status, now); err != nil {
		return nil, fmt.Errorf("insert organization: %w", err)
	}

	if _, err := postgresDB.Pool().Exec(ctx, `
		INSERT INTO app (id, organization_id, name, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $4)
	`, appID, organizationID, "Test app "+input.Suffix, now); err != nil {
		return nil, fmt.Errorf("insert app: %w", err)
	}

	if _, err := postgresDB.Pool().Exec(ctx, `
		INSERT INTO ingestion_key (id, app_id, name, key, created_at)
		VALUES ($1, $2, 'Test key', $3, $4)
	`, ingestionKeyID, appID, ingestionKey, now); err != nil {
		return nil, fmt.Errorf("insert ingestion key: %w", err)
	}

	if _, err := postgresDB.Pool().Exec(ctx, `
		INSERT INTO organization_usage (
			id,
			organization_id,
			logs_retention_days,
			traces_retention_days,
			metrics_retention_days,
			current_period_start,
			current_period_end,
			ingest_limit_bytes,
			ingest_overage_enabled,
			ingest_overage_budget_cents
		)
		VALUES ($1, $2, 30, 30, 30, $3, $4, $5, $6, $7)
	`, usageID, organizationID, now.Add(-time.Hour), periodEnd, input.LimitBytes, input.IngestOverageEnabled, input.IngestOverageBudgetCents); err != nil {
		return nil, fmt.Errorf("insert organization usage: %w", err)
	}

	return &SeededApp{
		OrganizationID: organizationID,
		AppID:          appID,
		IngestionKeyID: ingestionKeyID,
		IngestionKey:   ingestionKey,
	}, nil
}

type SeedHeartbeatInput struct {
	Suffix           string
	AppID            string
	Status           string
	WithDestination  bool
	WithOpenIncident bool
}

type SeededHeartbeat struct {
	MonitorID  string
	Token      string
	IncidentID string
}

func SeedHeartbeat(ctx context.Context, postgresDB *pgclient.Client, input SeedHeartbeatInput) (*SeededHeartbeat, error) {
	now := time.Now().UTC().Add(-time.Minute)

	monitorID := fmt.Sprintf("hbmon_%s", input.Suffix)
	token := fmt.Sprintf("hb_token_%s", input.Suffix)

	if _, err := postgresDB.Pool().Exec(ctx, `
		INSERT INTO heartbeat_monitor (
			id,
			app_id,
			name,
			token,
			expected_every_seconds,
			grace_seconds,
			last_check_in_at,
			status,
			created_at,
			updated_at
		)
		VALUES ($1, $2, $3, $4, 60, 30, $5, $6::heartbeat_monitor_status, $7, $7)
	`, monitorID, input.AppID, "API health "+input.Suffix, token, now, input.Status, now); err != nil {
		return nil, fmt.Errorf("insert heartbeat monitor: %w", err)
	}

	if input.WithDestination {
		destinationID := fmt.Sprintf("dest_%s", input.Suffix)
		if _, err := postgresDB.Pool().Exec(ctx, `
			INSERT INTO notification_destination (
				id,
				app_id,
				name,
				kind,
				webhook_url,
				webhook_headers_encrypted,
				created_at,
				updated_at
			)
			VALUES ($1, $2, $3, 'webhook', 'https://example.com', '{}', $4, $4)
		`, destinationID, input.AppID, "Destination "+input.Suffix, now); err != nil {
			return nil, fmt.Errorf("insert notification destination: %w", err)
		}

		if _, err := postgresDB.Pool().Exec(ctx, `
			INSERT INTO heartbeat_monitor_destination (heartbeat_monitor_id, destination_id)
			VALUES ($1, $2)
		`, monitorID, destinationID); err != nil {
			return nil, fmt.Errorf("insert heartbeat monitor destination: %w", err)
		}
	}

	incidentID := ""
	if input.WithOpenIncident {
		incidentID = fmt.Sprintf("inc_%s", input.Suffix)
		if _, err := postgresDB.Pool().Exec(ctx, `
			INSERT INTO incident (
				id,
				app_id,
				source_type,
				source_id,
				source_key,
				type,
				title,
				severity,
				status,
				entity_type,
				entity_id,
				opened_at,
				last_observed_at,
				created_at,
				updated_at
			)
			VALUES ($1, $2, 'heartbeat', $3, $4, 'heartbeat_missed', $5, 'critical', 'open', 'app', $2, $6, $6, $6, $6)
		`, incidentID, input.AppID, monitorID, "heartbeat:"+monitorID+":missed", "API health "+input.Suffix, now); err != nil {
			return nil, fmt.Errorf("insert heartbeat incident: %w", err)
		}
	}

	return &SeededHeartbeat{
		MonitorID:  monitorID,
		Token:      token,
		IncidentID: incidentID,
	}, nil
}

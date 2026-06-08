package entitlements

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/orvo-sh/orvo/apps/telemetry-writer/internal/config"
	"github.com/orvo-sh/orvo/apps/telemetry-writer/internal/storage/postgres"
)

type Policy struct {
	OrganizationID                 string
	PlanKey                        string
	Source                         string
	LogsRetentionDays              int
	TracesRetentionDays            int
	MetricsRetentionDays           int
	LogsMaxIngestBytesPerPeriod    *int64
	TracesMaxIngestBytesPerPeriod  *int64
	MetricsMaxIngestBytesPerPeriod *int64
	MaxStoredBytes                 *int64
	MaxTelemetryEventsMonthly      *int64
}

func DefaultPolicy(organizationID string) Policy {
	return Policy{
		OrganizationID:       organizationID,
		Source:               "default",
		LogsRetentionDays:    config.DefaultLogsRetentionDays,
		TracesRetentionDays:  config.DefaultTracesRetentionDays,
		MetricsRetentionDays: config.DefaultMetricsRetentionDays,
	}
}

func (policy Policy) RetentionDays(signal string) int {
	switch signal {
	case "logs":
		return policy.LogsRetentionDays
	case "traces":
		return policy.TracesRetentionDays
	case "metrics":
		return policy.MetricsRetentionDays
	default:
		return config.DefaultLogsRetentionDays
	}
}

type cacheEntry struct {
	policy    Policy
	expiresAt time.Time
}

type Cache struct {
	db     *postgres.Client
	logger *slog.Logger
	ttl    time.Duration

	mu    sync.RWMutex
	cache map[string]cacheEntry
}

func NewCache(db *postgres.Client, logger *slog.Logger, ttl time.Duration) *Cache {
	return &Cache{
		db:     db,
		logger: logger,
		ttl:    ttl,
		cache:  make(map[string]cacheEntry),
	}
}

func (cache *Cache) Get(ctx context.Context, appID string) (Policy, error) {
	if appID == "" {
		return DefaultPolicy(""), nil
	}

	cache.mu.RLock()
	if entry, ok := cache.cache[appID]; ok && time.Now().Before(entry.expiresAt) {
		cache.mu.RUnlock()
		return entry.policy, nil
	}
	cache.mu.RUnlock()

	policy, err := cache.load(ctx, appID)
	if err != nil {
		return Policy{}, err
	}

	cache.mu.Lock()
	cache.cache[appID] = cacheEntry{
		policy:    policy,
		expiresAt: time.Now().Add(cache.ttl),
	}
	cache.mu.Unlock()

	return policy, nil
}

func (cache *Cache) load(ctx context.Context, appID string) (Policy, error) {
	const query = `
SELECT
  app.organization_id,
  COALESCE(organization.billing_plan::text, ''),
  CASE WHEN organization.billing_plan IS NULL THEN 'default' ELSE 'billing' END,
  COALESCE(organization_usage.logs_retention_days, $2),
  COALESCE(organization_usage.traces_retention_days, $3),
  COALESCE(organization_usage.metrics_retention_days, $4),
  organization_usage.ingest_limit_bytes,
  organization_usage.ingest_limit_bytes,
  organization_usage.ingest_limit_bytes,
  NULL::bigint,
  NULL::bigint
FROM app
JOIN organization ON organization.id = app.organization_id
LEFT JOIN organization_usage ON organization_usage.organization_id = organization.id
WHERE app.id = $1
`

	policy := DefaultPolicy("")
	var logsMaxIngestBytesPerPeriod sql.NullInt64
	var tracesMaxIngestBytesPerPeriod sql.NullInt64
	var metricsMaxIngestBytesPerPeriod sql.NullInt64
	var maxStoredBytes sql.NullInt64
	var maxTelemetryEventsMonthly sql.NullInt64

	err := cache.db.Pool.QueryRow(
		ctx,
		query,
		appID,
		config.DefaultLogsRetentionDays,
		config.DefaultTracesRetentionDays,
		config.DefaultMetricsRetentionDays,
	).Scan(
		&policy.OrganizationID,
		&policy.PlanKey,
		&policy.Source,
		&policy.LogsRetentionDays,
		&policy.TracesRetentionDays,
		&policy.MetricsRetentionDays,
		&logsMaxIngestBytesPerPeriod,
		&tracesMaxIngestBytesPerPeriod,
		&metricsMaxIngestBytesPerPeriod,
		&maxStoredBytes,
		&maxTelemetryEventsMonthly,
	)
	if err == nil {
		if logsMaxIngestBytesPerPeriod.Valid {
			policy.LogsMaxIngestBytesPerPeriod = &logsMaxIngestBytesPerPeriod.Int64
		}
		if tracesMaxIngestBytesPerPeriod.Valid {
			policy.TracesMaxIngestBytesPerPeriod = &tracesMaxIngestBytesPerPeriod.Int64
		}
		if metricsMaxIngestBytesPerPeriod.Valid {
			policy.MetricsMaxIngestBytesPerPeriod = &metricsMaxIngestBytesPerPeriod.Int64
		}
		if maxStoredBytes.Valid {
			policy.MaxStoredBytes = &maxStoredBytes.Int64
		}
		if maxTelemetryEventsMonthly.Valid {
			policy.MaxTelemetryEventsMonthly = &maxTelemetryEventsMonthly.Int64
		}
		return policy, nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return policy, nil
	}

	return Policy{}, fmt.Errorf("postgres: load entitlement policy: %w", err)
}

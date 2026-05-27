package writer

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
)

type Entitlement struct {
	OrganizationID            string
	PlanKey                   string
	Source                    string
	LogsRetentionDays         int
	TracesRetentionDays       int
	MetricsRetentionDays      int
	MaxIngestBytesMonthly     *int64
	MaxStoredBytes            *int64
	MaxTelemetryEventsMonthly *int64
}

func DefaultEntitlement(organizationID string) Entitlement {
	return Entitlement{
		OrganizationID:       organizationID,
		Source:               "default",
		LogsRetentionDays:    DefaultLogsRetentionDays,
		TracesRetentionDays:  DefaultTracesRetentionDays,
		MetricsRetentionDays: DefaultMetricsRetentionDays,
	}
}

func (entitlement Entitlement) RetentionDays(signal string) int {
	switch signal {
	case "logs":
		return entitlement.LogsRetentionDays
	case "traces":
		return entitlement.TracesRetentionDays
	case "metrics":
		return entitlement.MetricsRetentionDays
	default:
		return DefaultLogsRetentionDays
	}
}

type entitlementCacheEntry struct {
	entitlement Entitlement
	expiresAt   time.Time
}

type EntitlementsCache struct {
	db     *Postgres
	logger *slog.Logger
	ttl    time.Duration

	mu    sync.RWMutex
	cache map[string]entitlementCacheEntry
}

func NewEntitlementsCache(db *Postgres, logger *slog.Logger, ttl time.Duration) *EntitlementsCache {
	return &EntitlementsCache{
		db:     db,
		logger: logger,
		ttl:    ttl,
		cache:  make(map[string]entitlementCacheEntry),
	}
}

func (cache *EntitlementsCache) Get(ctx context.Context, organizationID string) (Entitlement, error) {
	if organizationID == "" {
		return DefaultEntitlement(""), nil
	}

	cache.mu.RLock()
	if entry, ok := cache.cache[organizationID]; ok && time.Now().Before(entry.expiresAt) {
		cache.mu.RUnlock()
		return entry.entitlement, nil
	}
	cache.mu.RUnlock()

	entitlement, err := cache.load(ctx, organizationID)
	if err != nil {
		return Entitlement{}, err
	}

	cache.mu.Lock()
	cache.cache[organizationID] = entitlementCacheEntry{
		entitlement: entitlement,
		expiresAt:   time.Now().Add(cache.ttl),
	}
	cache.mu.Unlock()

	return entitlement, nil
}

func (cache *EntitlementsCache) load(ctx context.Context, organizationID string) (Entitlement, error) {
	const query = `
SELECT organization_id, COALESCE(plan_key, ''), source, logs_retention_days, traces_retention_days, metrics_retention_days,
       max_ingest_bytes_monthly, max_stored_bytes, max_telemetry_events_monthly
FROM entitlements
WHERE organization_id = $1
`

	entitlement := DefaultEntitlement(organizationID)
	var maxIngestBytesMonthly sql.NullInt64
	var maxStoredBytes sql.NullInt64
	var maxTelemetryEventsMonthly sql.NullInt64

	err := cache.db.pool.QueryRow(ctx, query, organizationID).Scan(
		&entitlement.OrganizationID,
		&entitlement.PlanKey,
		&entitlement.Source,
		&entitlement.LogsRetentionDays,
		&entitlement.TracesRetentionDays,
		&entitlement.MetricsRetentionDays,
		&maxIngestBytesMonthly,
		&maxStoredBytes,
		&maxTelemetryEventsMonthly,
	)
	if err == nil {
		if maxIngestBytesMonthly.Valid {
			entitlement.MaxIngestBytesMonthly = &maxIngestBytesMonthly.Int64
		}
		if maxStoredBytes.Valid {
			entitlement.MaxStoredBytes = &maxStoredBytes.Int64
		}
		if maxTelemetryEventsMonthly.Valid {
			entitlement.MaxTelemetryEventsMonthly = &maxTelemetryEventsMonthly.Int64
		}
		return entitlement, nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return entitlement, nil
	}

	return Entitlement{}, fmt.Errorf("postgres: load entitlement: %w", err)
}

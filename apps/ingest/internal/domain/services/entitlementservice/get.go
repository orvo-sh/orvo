package entitlementservice

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/orvo-sh/orvo/apps/ingest/internal/infra/postgres/db"
)

func (service *service) Get(ctx context.Context, appID string) (Policy, error) {
	if appID == "" {
		return DefaultPolicy(
			"",
			service.defaultLogsRetentionDays,
			service.defaultTracesRetentionDays,
			service.defaultMetricsRetentionDays,
		), nil
	}

	service.mu.RLock()
	if entry, ok := service.cache[appID]; ok && time.Now().Before(entry.expiresAt) {
		service.mu.RUnlock()
		return entry.policy, nil
	}
	service.mu.RUnlock()

	row, err := service.postgres.Queries().GetAppRetentionPolicy(ctx, pgdb.GetAppRetentionPolicyParams{
		ID:                          appID,
		DefaultLogsRetentionDays:    int32(service.defaultLogsRetentionDays),
		DefaultTracesRetentionDays:  int32(service.defaultTracesRetentionDays),
		DefaultMetricsRetentionDays: int32(service.defaultMetricsRetentionDays),
	})
	if err != nil {
		if err == pgx.ErrNoRows {
			return DefaultPolicy(
				"",
				service.defaultLogsRetentionDays,
				service.defaultTracesRetentionDays,
				service.defaultMetricsRetentionDays,
			), nil
		}

		return Policy{}, err
	}

	policy := Policy{
		OrganizationID:                 row.OrganizationID,
		PlanKey:                        row.PlanKey,
		Source:                         row.Source,
		LogsRetentionDays:              int(row.LogsRetentionDays),
		TracesRetentionDays:            int(row.TracesRetentionDays),
		MetricsRetentionDays:           int(row.MetricsRetentionDays),
		LogsMaxIngestBytesPerPeriod:    int8Ptr(row.LogsMaxIngestBytesPerPeriod),
		TracesMaxIngestBytesPerPeriod:  int8Ptr(row.TracesMaxIngestBytesPerPeriod),
		MetricsMaxIngestBytesPerPeriod: int8Ptr(row.MetricsMaxIngestBytesPerPeriod),
	}

	service.mu.Lock()
	service.cache[appID] = cacheEntry{
		policy:    policy,
		expiresAt: time.Now().Add(service.ttl),
	}
	service.mu.Unlock()

	return policy, nil
}

package entitlementservice

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/orvo-sh/orvo/apps/ingest/internal/infra/postgres"
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

type Service interface {
	Get(ctx context.Context, appID string) (Policy, error)
}

type cacheEntry struct {
	policy    Policy
	expiresAt time.Time
}

type service struct {
	postgres *postgres.Client
	logger   *slog.Logger
	ttl      time.Duration

	defaultLogsRetentionDays    int
	defaultTracesRetentionDays  int
	defaultMetricsRetentionDays int

	mu    sync.RWMutex
	cache map[string]cacheEntry
}

func New(
	postgres *postgres.Client,
	logger *slog.Logger,
	ttl time.Duration,
	defaultLogsRetentionDays int,
	defaultTracesRetentionDays int,
	defaultMetricsRetentionDays int,
) Service {
	return &service{
		postgres:                    postgres,
		logger:                      logger,
		ttl:                         ttl,
		defaultLogsRetentionDays:    defaultLogsRetentionDays,
		defaultTracesRetentionDays:  defaultTracesRetentionDays,
		defaultMetricsRetentionDays: defaultMetricsRetentionDays,
		cache:                       make(map[string]cacheEntry),
	}
}

func DefaultPolicy(
	organizationID string,
	defaultLogsRetentionDays int,
	defaultTracesRetentionDays int,
	defaultMetricsRetentionDays int,
) Policy {
	return Policy{
		OrganizationID:       organizationID,
		Source:               "default",
		LogsRetentionDays:    defaultLogsRetentionDays,
		TracesRetentionDays:  defaultTracesRetentionDays,
		MetricsRetentionDays: defaultMetricsRetentionDays,
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
		return policy.LogsRetentionDays
	}
}

func optionalInt64(value int64) *int64 {
	if value == 0 {
		return nil
	}
	return &value
}

func int8Ptr(value pgtype.Int8) *int64 {
	if !value.Valid {
		return nil
	}
	return &value.Int64
}

package billingservice

import (
	"context"
	"log/slog"
	"time"

	"github.com/orvo-sh/orvo/apps/ingest/internal/infra/postgres"
	"github.com/orvo-sh/orvo/apps/ingest/pkg/apperr"
)

type Reservation struct {
	OrganizationID string
	Signal         string
	PeriodStart    time.Time
	PeriodEnd      time.Time
	ReservedBytes  int64
}

type Service interface {
	ReserveSignalUsage(ctx context.Context, organizationID string, signal string, bytes int) (*Reservation, apperr.Error)
	ReleaseSignalUsage(ctx context.Context, reservation *Reservation) error
}

type service struct {
	postgres                    *postgres.Client
	logger                      *slog.Logger
	defaultLogsRetentionDays    int
	defaultTracesRetentionDays  int
	defaultMetricsRetentionDays int
}

func New(
	postgres *postgres.Client,
	logger *slog.Logger,
	defaultLogsRetentionDays int,
	defaultTracesRetentionDays int,
	defaultMetricsRetentionDays int,
) Service {
	return &service{
		postgres:                    postgres,
		logger:                      logger,
		defaultLogsRetentionDays:    defaultLogsRetentionDays,
		defaultTracesRetentionDays:  defaultTracesRetentionDays,
		defaultMetricsRetentionDays: defaultMetricsRetentionDays,
	}
}

type billingState struct {
	PlanKey       string
	Status        string
	IncludedBytes int64
	PeriodStart   time.Time
	PeriodEnd     time.Time
}

type usageRow struct {
	ID            string
	UsedBytes     int64
	IncludedBytes int64
	Notified70At  time.Time
	Notified85At  time.Time
	Notified100At time.Time
}
